#!/usr/bin/env python3
"""
Flask backend server for converting NPZ files to MP4 videos
"""

from flask import Flask, send_file, request, jsonify, Response
from flask_cors import CORS
import numpy as np
import cv2
import os
import tempfile
from pathlib import Path
import logging
from datetime import datetime
import base64
from io import BytesIO
import pandas as pd
from typing import Dict, List, Union, Any
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Standardized structure definition (from sample12.py)
standardized_structure = {
    # ----------------------------- General -----------------------------
    "image_quality": ["normal", "poor"],
    "cardiac_rhythm_abnormality": ["normal", "abnormal"],
    "cardiac_rhythm": [
        "normal", "atrial_fibrillation", "atrial_flutter",
        "ventricular_premature_beat", "atrial_premature_beat",
        "paced_rhythm", "other",
    ],
    # --------------------------- LV Geometry ---------------------------
    "lv_geometry": {
        "lv_cavity_size": ["normal", "small", "dilated"],
        "lvh_presence": ["yes", "no"],
        "lvh_pattern": ["normal", "concentric_remodeling", "concentric_hypertrophy", "eccentric_hypertrophy"],
        "increased_lv_wall_thickeness": ["yes", "no"],
        "diffuse_lv_wall_thickening_pattern": ["yes", "no"],
        "asymmetric_lv_wall_thickening_pattern": ["yes", "no"],
        "local_lv_wall_thickening_pattern_septum": ["yes", "no"],
        "local_lv_wall_thickening_pattern_apex": ["yes", "no"],
        "local_lv_wall_thickening_pattern_other": ["yes", "no"],
        "sigmoid_septum_or_basal_or_septal_hypertrophy_presence": ["yes", "no"],
        "papillary_muscle_abnormality": ["yes", "no"],
        "apical_burnout": ["yes", "no"],
        "D_shape": ["yes", "no"],
        "myocardial_texture_abnormality": ["yes", "no"],
        "IVSd": float, "LVEDD": float, "LVPWd": float,
        "IVSs": float, "LVESD": float, "LVPWs": float,
        "rwt": float, "LV Mass": float, "LVOT diameter": float,
    },
    # ---------------------- LV Systolic Function -----------------------
    "lv_systolic_function": {
        "lvef": float, "gls": float,
        "apical_sparing": ["yes", "no"],
        "RWMA": ["yes", "no"],
        "abnormal_septal_motion": ["yes", "no"],
        "global_LV_systolic_function": ["normal", "abnormal"],
        "lv_sec_presence": ["yes", "no"],
        "LV EDV": float, "LV ESV": float,
    },
    # ---------------------- LV Diastolic Function ----------------------
    "lv_diastolic_function": {
        "transmitral_flow_pattern_abnormality": ["normal", "abnormal_relaxation", "pseudo_normal", "restrictive"],
        "pulmonary_venous_flow_pattern_abnormality": ["yes", "no"],
        "diastolic_dysfunction_grade": ["normal", "grade_1", "grade_2", "grade_3"],
        "E-wave Velocity": float, "A-wave Velocity": float, "E/A ratio": float,
        "DT": float, "IVRT": float, "S'": float, "E'": float, "A'": float, "E/E'": float,
    },
    # -------------------- RV Geometry & Function -----------------------
    "rv_geometry_function": {
        "rv_dilation": ["yes", "no"],
        "rvh_presence": ["yes", "no"],
        "rv_dysfunction": ["normal", "mild", "moderate", "severe"],
        "rv_compression_or_constraint": ["yes", "no"],
        "rv_fac": float, "tapse": float,
    },
    # ----------------------------- Atria -------------------------------
    "atria": {
        "la_size": ["normal", "enlarged", "severely_dilated"],
        "ra_size": ["normal", "enlarged", "severely_dilated"],
        "la_sec_presence": ["yes", "no"],
        "interatrial_septum_abnormality": ["yes", "no"],
        "LA diameter": float, "LA volume": float,
    },
    # ------------------------ Aortic Valve (AV) ------------------------
    "av": {
        "degenerative": ["yes", "no"], "calcification": ["yes", "no"],
        "thickening": ["yes", "no"], "sclerosis": ["yes", "no"],
        "rheumatic": ["yes", "no"], "congenital": ["yes", "no"],
        "bicuspid": ["yes", "no"], "quadricuspid": ["yes", "no"],
        "prolapse": ["yes", "no"], "vegetation": ["yes", "no"],
        "prosthetic_valve": ["mechanical", "bioprosthetic", "no"],
        "thrombus_pannus": ["yes", "no"], "uncertain": ["yes", "no"],
        "av_stenosis": ["none", "mild", "moderate", "severe"],
        "av_regurgitation": ["none", "trivial", "mild", "moderate", "severe"],
        "AV Vmax": float, "AV VTI": float, "AV peak PG": float,
        "AV mean PG": float, "AVA": float, "AR PHT": float,
    },
    # Additional categories abbreviated for brevity - add as needed
    "cardiomyopathy": {
        "cardiomyopathy_type": ["no", "hypertrophic", "dilated", "restrictive", "infiltrative"],
        "hypertrophic_type": ["none", "septal", "apical", "mixed", "diffuse", "other"],
    },
}

app = Flask(__name__)

# Load environment variables (optional)
try:
    from dotenv import load_dotenv  # type: ignore
    # Best-effort load; start_server.py will also load root/backend .env
    load_dotenv()
except Exception as e:  # ModuleNotFoundError or other
    logger.warning(f"Could not load .env via python-dotenv ({e}); continuing with OS environment only")

# CORS configuration from environment
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    CORS(app, origins="*", allow_headers=["Content-Type"], supports_credentials=True)
else:
    origins_list = [origin.strip() for origin in cors_origins.split(',')]
    CORS(app, origins=origins_list, allow_headers=["Content-Type"], supports_credentials=True)

@app.route('/api/convert-npz', methods=['GET'])
def convert_npz_to_mp4():
    """
    Convert NPZ file to MP4 video
    Query parameter: path - Full path to the NPZ file
    """
    try:
        # Get the file path from query parameter
        npz_path = request.args.get('path')
        
        if not npz_path:
            logger.error("No path parameter provided")
            return jsonify({"error": "Missing 'path' parameter"}), 400
        
        logger.info(f"Received request to convert: {npz_path}")
        
        # Check if file exists
        if not os.path.exists(npz_path):
            logger.error(f"File not found: {npz_path}")
            return jsonify({"error": f"File not found: {npz_path}"}), 404
        
        # Check if it's an NPZ file
        if not npz_path.lower().endswith('.npz'):
            logger.error(f"Not an NPZ file: {npz_path}")
            return jsonify({"error": "File must be an NPZ file"}), 400
        
        try:
            # Load NPZ file
            logger.info(f"Loading NPZ file: {npz_path}")
            with np.load(npz_path) as data:
                # Try different possible keys for frames
                frames_key = None
                possible_keys = ['frames', 'video', 'data', 'array', 'arr_0']
                
                for key in possible_keys:
                    if key in data.files:
                        frames_key = key
                        break
                
                # If no standard key found, use the first available key
                if frames_key is None and len(data.files) > 0:
                    frames_key = data.files[0]
                    logger.info(f"Using first available key: {frames_key}")
                
                if frames_key is None:
                    logger.error("No data found in NPZ file")
                    return jsonify({"error": "No data found in NPZ file"}), 400
                
                frames = data[frames_key]
                logger.info(f"Loaded frames with shape: {frames.shape}")
                
                # Validate frames shape
                if frames.ndim < 3:
                    logger.error(f"Invalid frames shape: {frames.shape}")
                    return jsonify({"error": f"Invalid frames shape: {frames.shape}"}), 400
                
                # Handle different frame formats
                if frames.ndim == 3:
                    # Assume shape is (frames, height, width) - grayscale
                    if frames.shape[0] > frames.shape[2]:
                        # Probably (height, width, frames) - transpose
                        frames = np.transpose(frames, (2, 0, 1))
                    # Convert grayscale to BGR
                    frames_bgr = np.stack([frames] * 3, axis=-1)
                elif frames.ndim == 4:
                    # Shape is (frames, height, width, channels)
                    if frames.shape[-1] == 3:
                        # RGB to BGR
                        frames_bgr = frames[..., ::-1]
                    elif frames.shape[-1] == 1:
                        # Grayscale with channel dimension
                        frames_bgr = np.repeat(frames, 3, axis=-1)
                    else:
                        frames_bgr = frames[..., :3]  # Take first 3 channels
                else:
                    logger.error(f"Unsupported frames dimensions: {frames.ndim}")
                    return jsonify({"error": f"Unsupported frames dimensions: {frames.ndim}"}), 400
                
                # Normalize frames to 0-255 range if needed
                if frames_bgr.dtype == np.float32 or frames_bgr.dtype == np.float64:
                    if frames_bgr.max() <= 1.0:
                        frames_bgr = (frames_bgr * 255).astype(np.uint8)
                    else:
                        frames_bgr = frames_bgr.astype(np.uint8)
                elif frames_bgr.dtype != np.uint8:
                    frames_bgr = frames_bgr.astype(np.uint8)
                
                # Create temporary MP4 file
                temp_mp4 = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
                temp_mp4_path = temp_mp4.name
                temp_mp4.close()
                
                logger.info(f"Creating MP4 at: {temp_mp4_path}")
                
                # Video writer settings
                height, width = frames_bgr.shape[1:3]
                fps = 20.0  # 20 FPS for echo videos
                
                # Use H.264 codec
                fourcc = cv2.VideoWriter_fourcc(*'H264')
                out = cv2.VideoWriter(temp_mp4_path, fourcc, fps, (width, height))
                
                if not out.isOpened():
                    # Fallback to XVID if H264 fails
                    logger.warning("H264 codec failed, trying XVID")
                    fourcc = cv2.VideoWriter_fourcc(*'XVID')
                    out = cv2.VideoWriter(temp_mp4_path, fourcc, fps, (width, height))
                
                if not out.isOpened():
                    logger.error("Failed to open video writer")
                    return jsonify({"error": "Failed to create video writer"}), 500
                
                # Write frames
                logger.info(f"Writing {len(frames_bgr)} frames to video")
                for i, frame in enumerate(frames_bgr):
                    out.write(frame)
                
                out.release()
                logger.info("Video creation completed")
                
                # Send file and clean up after response
                def remove_file(response):
                    try:
                        os.remove(temp_mp4_path)
                        logger.info(f"Cleaned up temporary file: {temp_mp4_path}")
                    except Exception as e:
                        logger.error(f"Error removing temporary file: {e}")
                    return response
                
                response = send_file(
                    temp_mp4_path,
                    mimetype='video/mp4',
                    as_attachment=False,
                    download_name=f"{Path(npz_path).stem}.mp4"
                )
                response.call_on_close(lambda: remove_file(response))
                
                return response
                
        except Exception as e:
            logger.error(f"Error processing NPZ file: {str(e)}", exc_info=True)
            return jsonify({"error": f"Error processing NPZ file: {str(e)}"}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "opencv_version": cv2.__version__,
        "numpy_version": np.__version__
    }), 200

@app.route('/api/echo', methods=['GET', 'POST'])
def echo():
    """Simple echo endpoint for connectivity testing"""
    try:
        payload = {}
        if request.method == 'GET':
            payload = request.args.to_dict(flat=True)
        else:
            try:
                payload = request.get_json(silent=True) or {}
                print("payload", payload)
            except Exception:
                payload = {}

        return jsonify({
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "numpy_version": np.__version__,
            "opencv_version": cv2.__version__,
            "echo": payload
        }), 200
    except Exception as e:
        logger.error(f"Echo error: {str(e)}", exc_info=True)
        return jsonify({"error": f"Echo error: {str(e)}"}), 500

@app.route('/api/inspect-npz', methods=['GET'])
def inspect_npz():
    """Inspect an NPZ file and return metadata (keys, shapes, dtypes)."""
    try:
        npz_path = request.args.get('path')

        if not npz_path:
            return jsonify({"error": "Missing 'path' parameter"}), 400

        info = {
            "path": npz_path,
            "exists": os.path.exists(npz_path),
            "is_npz": npz_path.lower().endswith('.npz')
        }

        if not info["exists"]:
            return jsonify(info | {"error": "File not found"}), 404

        if not info["is_npz"]:
            return jsonify(info | {"error": "File must be an NPZ file"}), 400

        try:
            size_bytes = os.path.getsize(npz_path)
        except Exception:
            size_bytes = None

        with np.load(npz_path) as data:
            keys = list(data.files)
            key_to_meta = {}
            for key in keys:
                try:
                    arr = data[key]
                    key_to_meta[key] = {
                        "shape": tuple(int(x) for x in arr.shape),
                        "dtype": str(arr.dtype),
                        "ndim": int(arr.ndim)
                    }
                except Exception as e:
                    key_to_meta[key] = {"error": f"Failed to read: {str(e)}"}

        return jsonify({
            "status": "ok",
            "path": os.path.abspath(npz_path),
            "size_bytes": size_bytes,
            "keys": keys,
            "meta": key_to_meta
        }), 200
    except Exception as e:
        logger.error(f"Inspect NPZ error: {str(e)}", exc_info=True)
        return jsonify({"error": f"Inspect NPZ error: {str(e)}"}), 500

@app.route('/api/list', methods=['GET'])
def list_files():
    """List files under a root directory filtered by extensions.

    Query params:
      - root: directory to list
      - ext: comma-separated extensions without dot (default: npz,mp4)
      - recursive: true/false (default: false)
      - limit: max number of results (default: 200)
    """
    try:
        root = request.args.get('root')
        if not root:
            return jsonify({"error": "Missing 'root' parameter"}), 400

        root = os.path.abspath(root)
        if not os.path.exists(root) or not os.path.isdir(root):
            return jsonify({"error": f"Directory not found: {root}"}), 404

        ext_param = request.args.get('ext', 'npz,mp4')
        allowed_exts = set([
            e.strip().lower().lstrip('.') for e in ext_param.split(',') if e.strip()
        ])
        recursive = request.args.get('recursive', 'false').lower() == 'true'
        try:
            limit = int(request.args.get('limit', '200'))
        except ValueError:
            limit = 200

        results = []
        if recursive:
            for dirpath, _, filenames in os.walk(root):
                for fname in filenames:
                    if allowed_exts and fname.lower().split('.')[-1] not in allowed_exts:
                        continue
                    full = os.path.join(dirpath, fname)
                    results.append(full)
                    if len(results) >= limit:
                        break
                if len(results) >= limit:
                    break
        else:
            for fname in os.listdir(root):
                full = os.path.join(root, fname)
                if os.path.isfile(full):
                    if allowed_exts and fname.lower().split('.')[-1] not in allowed_exts:
                        continue
                    results.append(full)
                    if len(results) >= limit:
                        break

        return jsonify({
            "status": "ok",
            "root": root,
            "count": len(results),
            "files": results
        }), 200
    except Exception as e:
        logger.error(f"List files error: {str(e)}", exc_info=True)
        return jsonify({"error": f"List files error: {str(e)}"}), 500

# Helper functions for struct_pred generation (ported from sample12.py)
def _flatten_specs(struct: dict) -> pd.DataFrame:
    """Convert standardized_structure to DataFrame format"""
    rows = []
    for cat, spec in struct.items():
        if isinstance(spec, list):      # classification (top-level)
            rows.append({"Category": cat,
                         "Field": cat,
                         "Type": ", ".join(spec),
                         "Value": None})
        elif isinstance(spec, dict):    # nested fields
            for field, typ in spec.items():
                rows.append({"Category": cat,
                             "Field": field,
                             "Type": ", ".join(typ) if isinstance(typ, list) else "float",
                             "Value": None})
    return pd.DataFrame(rows)

def _extract_value(val, mode: str):
    """Extract value based on mode from potentially nested dict structure"""
    if not isinstance(val, dict):
        return val
    
    if mode in ("pred", "pred_label"):
        return val.get("pred_label", None)
    if mode in ("true", "true_label"):
        return val.get("true_label", None)
    if mode in ("pred_label", "true_label", "pred", "true", "prob"):
        return val.get(mode)
    return None

def _fill_from_sample(df: pd.DataFrame, sample: dict, mode: str) -> pd.DataFrame:
    """Fill DataFrame with values from sample data based on mode"""
    out = df.copy()
    for i, row in out.iterrows():
        k1 = row["Field"]
        k2 = f'{row["Category"]}//{row["Field"]}'
        raw_val = sample.get(k1, sample.get(k2, None))
        
        # Special handling for certain fields
        if (row["Category"].lower() == "cardiomyopathy" and
            row["Field"] == "cardiomyopathy_type"):
            out.at[i, "Value"] = _extract_value(raw_val, "true_label")
        elif (row["Category"].lower() == "lv_geometry" and
              row["Field"] == "lvh_presence"):
            out.at[i, "Value"] = _extract_value(raw_val, "true_label")
        else:
            out.at[i, "Value"] = _extract_value(raw_val, mode)
    return out

def _df_to_nested_dict(df: pd.DataFrame) -> dict:
    """Convert DataFrame to nested dictionary structure"""
    result: Dict[str, Dict[str, Union[str, float, int]]] = {}
    for _, r in df.iterrows():
        if r["Value"] in (None, "", np.nan):
            continue
        cat, field, val = r["Category"], r["Field"], r["Value"]
        result.setdefault(cat, {})[field] = val
    return result

def _load_db_backend(db_json_path: str) -> List[dict]:
    """Load and process DB JSON file (simplified version without streamlit dependencies)"""
    try:
        with open(db_json_path, 'r') as f:
            raw = json.load(f)
        
        # Flatten groups similar to original but simplified
        groups: List[List[dict]] = []
        if isinstance(raw, dict):
            for v in raw.values():
                groups.append(v if isinstance(v, list) else [v])
        else:
            groups.append(raw)
        
        out = []
        for grp in groups:
            for e in grp:
                vids = e["video_npz"]
                metas = e.get("meta_json")
                
                # Convert to lists
                vids = [vids] if isinstance(vids, (str, Path)) else vids
                metas = [metas] if isinstance(metas, (str, Path)) or metas is None else metas
                if metas is None: 
                    metas = [None] * len(vids)
                
                for vid_str, meta_str in zip(vids, metas):
                    # Path conversion (adjust as needed for your environment)
                    vid_path = str(vid_str).replace("/mnt", "//10.10.10.10/NAS02").replace("/", "\\")
                    meta_path = str(meta_str).replace("/mnt", "//10.10.10.10/NAS02").replace("/", "\\") if meta_str else None
                    
                    new_entry = e.copy()
                    new_entry["video_npz"] = vid_path
                    new_entry["meta_json"] = meta_path
                    out.append(new_entry)
        
        return out
    except Exception as e:
        logger.error(f"Error loading DB file: {str(e)}")
        raise

def _fetch_preds_backend(entry: dict) -> dict:
    """Fetch predictions from entry (simplified - just returns the entry as-is)"""
    return entry

@app.route('/api/generate-struct-pred', methods=['POST'])
def generate_struct_pred():
    """
    Generate structured predictions from DB JSON file and exam_id.
    
    POST Body (JSON):
    {
        "exam_id": "exam_123",
        "mode": "pred_label"  // optional, defaults to "pred_label"
    }
    
    Returns structured predictions in the same format as sample12.py
    """
    try:
        data = request.get_json()
        print("data: ", data)
        if not data:
            return jsonify({"error": "Missing JSON data"}), 400
        
        # Resolve DB JSON path relative to project root, allow env override
        db_json_path_env = os.environ.get('DB_JSON_PATH')
        if db_json_path_env and db_json_path_env.strip():
            db_json_path = db_json_path_env.strip()
        else:
            project_root = Path(__file__).resolve().parent.parent
            db_json_path = str(project_root / 'DB_json' / 'eval_result-attn-50-3_local.json')
        exam_id = data.get('exam_id')
        mode = data.get('mode', 'pred_label')
        
        if not db_json_path:
            return jsonify({"error": "Missing 'db_json_path' in request"}), 400
        if not exam_id:
            return jsonify({"error": "Missing 'exam_id' in request"}), 400
        
        logger.info(f"Generating struct_pred for exam_id: {exam_id} from DB: {db_json_path}")
        
        # Step 1: Load DB
        if not os.path.exists(db_json_path):
            return jsonify({"error": f"DB file not found: {db_json_path}"}), 404
        
        db_entries = _load_db_backend(db_json_path)
        logger.info(f"Loaded {len(db_entries)} entries from DB")
        
        # Step 2: Find entry by exam_id
        entry = None
        for e in db_entries:
            if e.get("exam_id") == exam_id:
                entry = e
                break
        
        if entry is None:
            return jsonify({"error": f"Exam ID '{exam_id}' not found in DB"}), 404
        
        logger.info(f"Found entry for exam_id: {exam_id}")
        
        # Step 3: Fetch predictions (_fetch_preds equivalent)
        preds = _fetch_preds_backend(entry)
        
        # Step 4: Create analysis DataFrame
        analysis_df = _flatten_specs(standardized_structure)
        
        # Step 5: Fill from sample (_fill_from_sample)
        filled_df = _fill_from_sample(analysis_df, preds, mode)
        
        # Step 6: Convert to nested dict (_df_to_nested_dict)
        struct_pred = _df_to_nested_dict(filled_df)
        
        # Prepare response
        response_data = {
            "status": "ok",
            "exam_id": exam_id,
            "mode": mode,
            "struct_pred": struct_pred,
            "total_fields": len(filled_df),
            "filled_fields": len([v for v in filled_df["Value"] if v is not None and v != ""]),
            "processing_info": {
                "db_entries_count": len(db_entries),
                "entry_found": True,
                "prediction_keys": list(preds.keys()) if isinstance(preds, dict) else "entry_as_dict"
            }
        }
        
        logger.info(f"Generated struct_pred with {len(struct_pred)} categories")
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating struct_pred: {str(e)}", exc_info=True)
        return jsonify({"error": f"Error generating struct_pred: {str(e)}"}), 500

@app.route('/api/preprocess', methods=['POST'])
def preprocess_data():
    """Preprocess NPZ data for frontend video display.
    
    POST Body (JSON):
    {
        "path": "path/to/file.npz",
        "options": {
            "resize": [224, 224],           // target size [width, height]
            "normalize": "0-1",             // "0-1", "z-score", "minmax", or null
            "denoise": "gaussian",          // "gaussian", "median", "bilateral", or null
            "contrast": 1.2,                // contrast factor (1.0 = no change)
            "brightness": 0.1,              // brightness offset (-1 to 1)
            "frame_range": [0, 10],         // extract specific frame range [start, end]
            "downsample": 2,                // temporal downsampling factor
            "format": "video_frames",       // "video_frames", "mp4_blob", "stream_url"
            "fps": 20,                      // frames per second for video playback
            "max_frames": 30                // maximum frames to return (for performance)
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing JSON data"}), 400
        
        npz_path = data.get('path')
        if not npz_path:
            return jsonify({"error": "Missing 'path' in request"}), 400
        
        if not os.path.exists(npz_path) or not npz_path.lower().endswith('.npz'):
            return jsonify({"error": "Invalid NPZ file path"}), 400
        
        options = data.get('options', {})
        logger.info(f"Preprocessing {npz_path} with options: {options}")
        
        # Load NPZ file
        with np.load(npz_path) as npz_data:
            # Find frames key (same logic as convert endpoint)
            frames_key = None
            for key in ['frames', 'video', 'data', 'array', 'arr_0']:
                if key in npz_data.files:
                    frames_key = key
                    break
            if frames_key is None and len(npz_data.files) > 0:
                frames_key = npz_data.files[0]
            
            if frames_key is None:
                return jsonify({"error": "No data found in NPZ file"}), 400
            
            frames = npz_data[frames_key].copy()
            original_shape = frames.shape
            logger.info(f"Loaded frames: {original_shape}, dtype: {frames.dtype}")
        
        # Apply preprocessing steps
        processed_frames = frames
        processing_log = []
        
        # 1. Frame range extraction
        frame_range = options.get('frame_range')
        if frame_range and len(frame_range) == 2:
            start, end = max(0, frame_range[0]), min(len(processed_frames), frame_range[1])
            processed_frames = processed_frames[start:end]
            processing_log.append(f"Extracted frames {start}:{end}")
        
        # 2. Temporal downsampling
        downsample = options.get('downsample', 1)
        if downsample > 1:
            processed_frames = processed_frames[::downsample]
            processing_log.append(f"Downsampled by factor {downsample}")
        
        # 3. Ensure proper format (frames, height, width) or (frames, height, width, channels)
        if processed_frames.ndim == 3:
            # Assume (frames, height, width) - add channel dimension
            processed_frames = np.expand_dims(processed_frames, axis=-1)
        elif processed_frames.ndim == 4 and processed_frames.shape[0] < processed_frames.shape[-1]:
            # Probably (height, width, channels, frames) - transpose
            processed_frames = np.transpose(processed_frames, (3, 0, 1, 2))
        
        # 4. Resize frames
        resize = options.get('resize')
        if resize and len(resize) == 2:
            width, height = resize
            resized_frames = []
            for frame in processed_frames:
                if frame.shape[-1] == 1:  # Grayscale
                    resized = cv2.resize(frame.squeeze(-1), (width, height))
                    resized = np.expand_dims(resized, axis=-1)
                else:  # Multi-channel
                    resized = cv2.resize(frame, (width, height))
                resized_frames.append(resized)
            processed_frames = np.array(resized_frames)
            processing_log.append(f"Resized to {width}x{height}")
        
        # 5. Normalize data types
        if processed_frames.dtype != np.uint8:
            if processed_frames.dtype in [np.float32, np.float64]:
                if processed_frames.max() <= 1.0:
                    processed_frames = (processed_frames * 255).astype(np.uint8)
                else:
                    processed_frames = np.clip(processed_frames, 0, 255).astype(np.uint8)
            else:
                processed_frames = processed_frames.astype(np.uint8)
            processing_log.append("Converted to uint8")
        
        # 6. Contrast and brightness adjustment
        contrast = options.get('contrast', 1.0)
        brightness = options.get('brightness', 0.0)
        if contrast != 1.0 or brightness != 0.0:
            processed_frames = processed_frames.astype(np.float32)
            processed_frames = processed_frames * contrast + brightness * 255
            processed_frames = np.clip(processed_frames, 0, 255).astype(np.uint8)
            processing_log.append(f"Adjusted contrast: {contrast}, brightness: {brightness}")
        
        # 7. Denoising
        denoise = options.get('denoise')
        if denoise:
            denoised_frames = []
            for frame in processed_frames:
                if denoise == 'gaussian':
                    denoised = cv2.GaussianBlur(frame, (5, 5), 0)
                elif denoise == 'median':
                    if frame.shape[-1] == 1:
                        denoised = cv2.medianBlur(frame.squeeze(-1), 5)
                        denoised = np.expand_dims(denoised, axis=-1)
                    else:
                        denoised = frame  # Median blur works on single channel
                elif denoise == 'bilateral':
                    if frame.shape[-1] == 1:
                        denoised = cv2.bilateralFilter(frame.squeeze(-1), 9, 75, 75)
                        denoised = np.expand_dims(denoised, axis=-1)
                    else:
                        denoised = cv2.bilateralFilter(frame, 9, 75, 75)
                else:
                    denoised = frame
                denoised_frames.append(denoised)
            processed_frames = np.array(denoised_frames)
            processing_log.append(f"Applied {denoise} denoising")
        
        # 8. Normalization
        normalize = options.get('normalize')
        if normalize:
            processed_frames_float = processed_frames.astype(np.float32)
            if normalize == '0-1':
                processed_frames_float = processed_frames_float / 255.0
                processing_log.append("Normalized to [0, 1]")
            elif normalize == 'z-score':
                mean = np.mean(processed_frames_float)
                std = np.std(processed_frames_float)
                processed_frames_float = (processed_frames_float - mean) / (std + 1e-8)
                processing_log.append(f"Z-score normalized (mean={mean:.2f}, std={std:.2f})")
            elif normalize == 'minmax':
                min_val, max_val = np.min(processed_frames_float), np.max(processed_frames_float)
                processed_frames_float = (processed_frames_float - min_val) / (max_val - min_val + 1e-8)
                processing_log.append(f"MinMax normalized (min={min_val:.2f}, max={max_val:.2f})")
        else:
            processed_frames_float = processed_frames.astype(np.float32)
        
        # Prepare response based on format
        output_format = options.get('format', 'video_frames')
        fps = options.get('fps', 20)
        max_frames = options.get('max_frames', 30)
        
        # Limit frames for performance
        display_frames = processed_frames[:min(max_frames, len(processed_frames))]
        
        response_data = {
            "status": "ok",
            "original_shape": original_shape,
            "processed_shape": processed_frames.shape,
            "processing_steps": processing_log,
            "video_info": {
                "total_frames": len(processed_frames),
                "display_frames": len(display_frames),
                "fps": fps,
                "duration": len(processed_frames) / fps,
                "resolution": f"{processed_frames.shape[2]}x{processed_frames.shape[1]}"
            },
            "stats": {
                "min": float(np.min(processed_frames_float)),
                "max": float(np.max(processed_frames_float)),
                "mean": float(np.mean(processed_frames_float)),
                "std": float(np.std(processed_frames_float))
            }
        }
        
        if output_format == 'video_frames':
            # 비디오 재생을 위한 프레임 시퀀스 반환
            encoded_frames = []
            frame_timings = []  # 각 프레임의 타이밍 정보
            
            for i, frame in enumerate(display_frames):
                # 그레이스케일 처리
                if frame.shape[-1] == 1:
                    img = frame.squeeze(-1)
                    # 그레이스케일을 RGB로 변환
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                else:
                    # BGR을 RGB로 변환
                    img = frame
                    if img.shape[-1] == 3:
                        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # JPEG로 인코딩 (PNG보다 작은 사이즈)
                is_success, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if is_success:
                    img_base64 = base64.b64encode(buffer).decode('utf-8')
                    encoded_frames.append(f"data:image/jpeg;base64,{img_base64}")
                    frame_timings.append(i / fps)  # 각 프레임의 시간 위치
            
            response_data["frames"] = encoded_frames
            response_data["frame_timings"] = frame_timings
            response_data["playback_info"] = {
                "auto_play": True,
                "loop": True,
                "frame_interval": 1000 / fps  # 밀리초 단위
            }
        
        elif output_format == 'mp4_blob':
            # MP4 blob 생성 (메모리 효율적)
            temp_mp4 = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
            temp_mp4_path = temp_mp4.name
            temp_mp4.close()
            
            # MP4 생성
            height, width = display_frames.shape[1:3]
            fourcc = cv2.VideoWriter_fourcc(*'H264')
            out = cv2.VideoWriter(temp_mp4_path, fourcc, fps, (width, height))
            
            for frame in display_frames:
                if frame.shape[-1] == 1:
                    # 그레이스케일을 BGR로 변환
                    frame_bgr = cv2.cvtColor(frame.squeeze(-1), cv2.COLOR_GRAY2BGR)
                else:
                    frame_bgr = frame
                out.write(frame_bgr)
            
            out.release()
            
            # 임시 파일 ID 생성
            import uuid
            temp_id = str(uuid.uuid4())
            
            # 파일을 메모리에 로드하고 base64로 인코딩
            with open(temp_mp4_path, 'rb') as f:
                video_data = f.read()
            
            video_base64 = base64.b64encode(video_data).decode('utf-8')
            response_data["video_blob"] = f"data:video/mp4;base64,{video_base64}"
            
            # 임시 파일 정리
            os.remove(temp_mp4_path)
            
        elif output_format == 'base64':
            # 기존 base64 방식 (호환성 유지)
            sample_frames = display_frames[:min(5, len(display_frames))]
            encoded_frames = []
            
            for i, frame in enumerate(sample_frames):
                if frame.shape[-1] == 1:
                    img = frame.squeeze(-1)
                else:
                    img = frame
                    if img.shape[-1] == 3:
                        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                is_success, buffer = cv2.imencode(".png", img)
                if is_success:
                    img_base64 = base64.b64encode(buffer).decode('utf-8')
                    encoded_frames.append(f"data:image/png;base64,{img_base64}")
            
            response_data["frames"] = encoded_frames
            response_data["total_frames"] = len(processed_frames)
        
        elif output_format == 'download_url':
            # Save processed data as NPZ and return download URL
            temp_npz = tempfile.NamedTemporaryFile(suffix='.npz', delete=False)
            np.savez_compressed(temp_npz.name, frames=processed_frames_float)
            temp_npz.close()
            
            # Note: In a real app, you'd need a file serving mechanism
            response_data["download_path"] = temp_npz.name
            response_data["note"] = "Temporary file created - implement file serving endpoint"
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Preprocessing error: {str(e)}", exc_info=True)
        return jsonify({"error": f"Preprocessing error: {str(e)}"}), 500

@app.route('/api/stream-video', methods=['GET'])
def stream_video():
    """
    Real-time video streaming from NPZ file for frontend display.
    Query parameters:
    - path: NPZ file path
    - fps: frames per second (default: 20)
    - resize: format "widthxheight" like "224x224"
    - quality: JPEG quality 1-100 (default: 85)
    """
    try:
        npz_path = request.args.get('path')
        if not npz_path or not os.path.exists(npz_path):
            return jsonify({"error": "Invalid NPZ file path"}), 400
        
        fps = int(request.args.get('fps', 20))
        quality = int(request.args.get('quality', 85))
        resize_param = request.args.get('resize')  # "224x224" format
        
        logger.info(f"Streaming video from: {npz_path} at {fps} FPS")
        
        def generate_frames():
            try:
                with np.load(npz_path) as npz_data:
                    # Find frames key
                    frames_key = None
                    for key in ['frames', 'video', 'data', 'array', 'arr_0']:
                        if key in npz_data.files:
                            frames_key = key
                            break
                    if frames_key is None and len(npz_data.files) > 0:
                        frames_key = npz_data.files[0]
                    
                    if frames_key is None:
                        yield b'--frame\r\nContent-Type: text/plain\r\n\r\nError: No data in NPZ\r\n'
                        return
                    
                    frames = npz_data[frames_key]
                    
                    # Process each frame
                    for i, frame in enumerate(frames):
                        try:
                            # Ensure proper format
                            if frame.ndim == 2:
                                # Grayscale - convert to RGB
                                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
                            elif frame.ndim == 3:
                                if frame.shape[-1] == 1:
                                    frame_rgb = cv2.cvtColor(frame.squeeze(-1), cv2.COLOR_GRAY2RGB)
                                elif frame.shape[-1] == 3:
                                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                                else:
                                    frame_rgb = frame[:, :, :3]
                            else:
                                continue
                            
                            # Normalize to 0-255 if needed
                            if frame_rgb.dtype != np.uint8:
                                if frame_rgb.max() <= 1.0:
                                    frame_rgb = (frame_rgb * 255).astype(np.uint8)
                                else:
                                    frame_rgb = np.clip(frame_rgb, 0, 255).astype(np.uint8)
                            
                            # Resize if requested
                            if resize_param:
                                try:
                                    width, height = map(int, resize_param.split('x'))
                                    frame_rgb = cv2.resize(frame_rgb, (width, height))
                                except ValueError:
                                    pass  # Skip resize if format is invalid
                            
                            # Encode to JPEG
                            success, buffer = cv2.imencode('.jpg', frame_rgb, 
                                                         [cv2.IMWRITE_JPEG_QUALITY, quality])
                            
                            if success:
                                frame_data = buffer.tobytes()
                                headers = (
                                     b'--frame\r\n'
                                     + b'Content-Type: image/jpeg\r\n'
                                     + f'X-Frame-Index: {i}\r\n'.encode('ascii')
                                     + f'X-Frame-Timestamp: {i/fps:.3f}\r\n'.encode('ascii')
                                     + b'\r\n'
                                 )
                                yield headers + frame_data + b'\r\n'
                            
                            # Control frame rate with delay would be handled client-side
                            
                        except Exception as frame_error:
                            logger.error(f"Error processing frame {i}: {frame_error}")
                            continue
                            
            except Exception as e:
                logger.error(f"Stream generation error: {e}")
                yield b'--frame\r\nContent-Type: text/plain\r\n\r\nStream error\r\n'
        
        return Response(
            generate_frames(),
            mimetype='multipart/x-mixed-replace; boundary=frame',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Video-FPS': str(fps),
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        logger.error(f"Stream video error: {str(e)}", exc_info=True)
        return jsonify({"error": f"Stream video error: {str(e)}"}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # Run the Flask app
    host = os.environ.get('FLASK_RUN_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_RUN_PORT', os.environ.get('PORT', 5000)))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    logger.info(f"Starting Flask server on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"CORS origins: {cors_origins}")
    logger.info(f"OpenCV version: {cv2.__version__}")
    logger.info(f"NumPy version: {np.__version__}")
    
    app.run(
        host=host,
        port=port,
        debug=debug
    )


