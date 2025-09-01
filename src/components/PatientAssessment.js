import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import io from 'socket.io-client';
import '../styles/PatientAssessment.css';
import { generateSummary, structurePatientData, extractKeywordsFromSummary, updateStructuredDataFromSummary, generateSummaryFromStructuredData } from '../services/openaiService';
import { npzToVideoUrl, cleanupVideoUrl } from '../utils/videoProcessor';
import { getExamEntryById} from '../utils/dbUtils';

// Standardized structure for all patient data fields
const standardizedStructure = {
  // ----------------------------- General -----------------------------
  "image_quality": ["normal", "poor"],
  "cardiac_rhythm_abnormality": ["normal", "abnormal"],
  "cardiac_rhythm": [
    "normal",
    "atrial_fibrillation",
    "atrial_flutter",
    "ventricular_premature_beat",
    "atrial_premature_beat",
    "paced_rhythm",
    "other"
  ],
  // --------------------------- LV Geometry ---------------------------
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
    "myocardial_texture_abnormality": ["yes", "no"]
  },
  // ---------------------- LV Systolic Function -----------------------
  "lv_systolic_function": {
    "apical_sparing": ["yes", "no"],
    "RWMA": ["yes", "no"],
    "abnormal_septal_motion": ["yes", "no"],
    "global_LV_systolic_function": ["normal", "abnormal"],
    "lv_sec_presence": ["yes", "no"]
  },
  // ---------------------- LV Diastolic Function ----------------------
  "lv_diastolic_function": {
    "transmitral_flow_pattern_abnormality": ["normal", "abnormal_relaxation", "pseudo_normal", "restrictive"],
    "pulmonary_venous_flow_pattern_abnormality": ["yes", "no"],
    "diastolic_dysfunction_grade": ["normal", "grade_1", "grade_2", "grade_3"]
  },
  // -------------------- RV Geometry & Function -----------------------
  "rv_geometry_function": {
    "rv_dilation": ["yes", "no"],
    "rvh_presence": ["yes", "no"],
    "rv_dysfunction": ["normal", "mild", "moderate", "severe"],
    "rv_compression_or_constraint": ["yes", "no"]
  },
  // ----------------------------- Atria -------------------------------
  "atria": {
    "la_size": ["normal", "enlarged", "severely_dilated"],
    "ra_size": ["normal", "enlarged", "severely_dilated"],
    "la_sec_presence": ["yes", "no"],
    "interatrial_septum_abnormality": ["yes", "no"]
  },
  // ------------------------ Aortic Valve (AV) ------------------------
  "av": {
    "degenerative": ["yes", "no"],
    "calcification": ["yes", "no"],
    "thickening": ["yes", "no"],
    "sclerosis": ["yes", "no"],
    "rheumatic": ["yes", "no"],
    "congenital": ["yes", "no"],
    "bicuspid": ["yes", "no"],
    "quadricuspid": ["yes", "no"],
    "prolapse": ["yes", "no"],
    "vegetation": ["yes", "no"],
    "prosthetic_valve": ["mechanical", "bioprosthetic", "no"],
    "thrombus_pannus": ["yes", "no"],
    "uncertain": ["yes", "no"],
    "av_stenosis": ["none", "mild", "moderate", "severe"],
    "av_regurgitation": ["none", "trivial", "mild", "moderate", "severe"]
  },
  // ------------------------ Mitral Valve (MV) ------------------------
  "mv": {
    "degenerative": ["yes", "no"],
    "rheumatic": ["yes", "no"],
    "calcification": ["yes", "no"],
    "annular_calcification": ["yes", "no"],
    "doming": ["yes", "no"],
    "fish_mouth_appearance": ["yes", "no"],
    "thickening": ["yes", "no"],
    "prolapse": ["yes", "no"],
    "functional": ["yes", "no"],
    "prosthetic_valve": ["mechanical", "bioprosthetic", "no"],
    "annular_ring": ["yes", "no"],
    "vegetation": ["yes", "no"],
    "thrombus_pannus": ["yes", "no"],
    "uncertain": ["yes", "no"],
    "sam": ["yes", "no"],
    "mv_stenosis": ["none", "mild", "moderate", "severe"],
    "mv_regurgitation": ["none", "trivial", "mild", "moderate", "severe"]
  },
  // ---------------------- Tricuspid Valve (TV) -----------------------
  "tv": {
    "functional": ["yes", "no"],
    "coaptation_failure": ["yes", "no"],
    "thickening": ["yes", "no"],
    "prolapse": ["yes", "no"],
    "ebstein_anomaly": ["yes", "no"],
    "prosthetic_valve": ["mechanical", "bioprosthetic", "no"],
    "annular_ring": ["yes", "no"],
    "vegetation": ["yes", "no"],
    "degenerative": ["yes", "no"],
    "thrombus_pannus": ["yes", "no"],
    "uncertain": ["yes", "no"],
    "tv_stenosis": ["none", "mild", "moderate", "severe"],
    "tv_regurgitation": ["none", "trivial", "mild", "moderate", "severe"]
  },
  // --------------------- Pulmonary Valve (PV) ------------------------
  "pv": {
    "thickening": ["yes", "no"],
    "prosthetic_valve": ["mechanical", "bioprosthetic", "no"],
    "uncertain": ["yes", "no"],
    "pv_stenosis": ["none", "mild", "moderate", "severe"],
    "pv_regurgitation": ["none", "trivial", "mild", "moderate", "severe"]
  },
  // ----------------------------- Aorta -------------------------------
  "aorta": {
    "aortic_root_ascending_abnormalities": ["yes", "no"],
    "aortic_arch_abnormalities": ["yes", "no"],
    "abdominal_aorta_abnormalities": ["yes", "no"]
  },
  // ----------------------------- IVC --------------------------------
  "ivc": {
    "ivc_dilation": ["yes", "no"],
    "ivc_plethora": ["yes", "no"]
  },
  // ----------------------- Pulmonary Vessels -------------------------
  "pulmonary_vessels": {
    "pulmonary_hypertension": ["none", "mild", "moderate", "severe"],
    "pulmonary_artery_thrombus": ["yes", "no"],
    "pulmonary_artery_stenosis": ["yes", "no"],
    "pulmonary_artery_dilatation": ["yes", "no"]
  },
  // ---------------------- Pericardial Disease -----------------------
  "pericardial_disease": {
    "effusion_amount": ["none", "small", "moderate", "large"],
    "pericardial_thickening_or_adhesion": ["yes", "no"],
    "hemodynamic_significance": ["yes", "no"],
    "constrictive_physiology": ["yes", "no"],
    "effusive_constrictive": ["yes", "no"],
    "tamponade_physiology": ["none", "early/boarderline", "definite"],
    "epicardial_adipose_tissue": ["none", "small", "moderate", "large"]
  },
  // ------------------------- Cardiomyopathy -------------------------
  "cardiomyopathy": {
    "cardiomyopathy_type": ["no", "hypertrophic", "dilated", "restrictive", "infiltrative"],
    "hypertrophic_type": ["none", "septal", "apical", "mixed", "diffuse", "other"]
  },
  // --------------------- Intracardiac Findings -----------------------
  "intracardiac_findings": {
    "ASD": ["yes", "no"],
    "PFO": ["yes", "no"],
    "VSD": ["yes", "no"],
    "PDA": ["yes", "no"],
    "intracardiac_device": ["none", "pacemaker", "icd", "crt"],
    "LVOT obstruction": ["yes", "no"],
    "RVOT obstruction": ["yes", "no"],
    "mid-cavity obstruction": ["yes", "no"],
    "mass_presence": ["yes", "no"]
  }
};

// Measurement fields extracted from standardizedStructure.js (float type fields only)
const standardizedStructure_measure = {
  // --------------------------- LV Geometry ---------------------------
  "lv_geometry": {
    "IVSd": "float",
    "LVEDD": "float",
    "LVPWd": "float",
    "IVSs": "float",
    "LVESD": "float",
    "LVPWs": "float",
    "rwt": "float",
    "LV Mass": "float",
    "LVOT diameter": "float"
  },
  // ---------------------- LV Systolic Function -----------------------
  "lv_systolic_function": {
    "lvef": "float",
    "gls": "float",
    "LV EDV": "float",
    "LV ESV": "float"
  },
  // ---------------------- LV Diastolic Function ----------------------
  "lv_diastolic_function": {
    "E-wave Velocity": "float",
    "A-wave Velocity": "float",
    "E/A ratio": "float",
    "DT": "float",
    "IVRT": "float",
    "S'": "float",
    "E'": "float",
    "A'": "float",
    "E/E'": "float"
  },
  // -------------------- RV Geometry & Function -----------------------
  "rv_geometry_function": {
    "rv_fac": "float",
    "tapse": "float"
  },
  // ----------------------------- Atria -------------------------------
  "atria": {
    "LA diameter": "float",
    "LA volume": "float"
  },
  // ------------------------ Aortic Valve (AV) ------------------------
  "av": {
    "AV Vmax": "float",
    "AV VTI": "float",
    "AV peak PG": "float",
    "AV mean PG": "float",
    "AVA": "float",
    "AR PHT": "float"
  },
  // ------------------------ Mitral Valve (MV) ------------------------
  "mv": {
    "MV peakPG": "float",
    "MV meanPG": "float",
    "MVA": "float",
    "MR VTI": "float",
    "MR PISA": "float",
    "MR ERO": "float",
    "MR Regurgitant Volume": "float"
  },
  // ---------------------- Tricuspid Valve (TV) -----------------------
  "tv": {
    "TR Vmax": "float",
    "TR VTI": "float"
  },
  // --------------------- Pulmonary Valve (PV) ------------------------
  "pv": {
    "PV Vmax": "float",
    "PV VTI": "float",
    "PV peakPG": "float",
    "PV meanPG": "float"
  },
  // ----------------------- Pulmonary Vessels -------------------------
  "pulmonary_vessels": {
    "rvsp": "float"
  }
};

// Build structured data from flat patientData using standardizedStructure
function buildStructuredFromPatientData(source) {
  if (!source) return null;
  const result = {};
  Object.entries(standardizedStructure).forEach(([category, spec]) => {
    if (Array.isArray(spec)) {
      // top-level classification category uses category key itself
      const val = source[category];
      if (val !== undefined && val !== null && val !== '') {
        result[category] = val;
      }
    } else if (spec && typeof spec === 'object') {
      const nested = {};
      Object.keys(spec).forEach((field) => {
        const v = source[field] !== undefined ? source[field] : source[`${category}//${field}`];
        if (v !== undefined && v !== null && v !== '') {
          nested[field] = v;
        }
      });
      if (Object.keys(nested).length > 0) {
        result[category] = nested;
      }
    }
  });
  return result;
}

// DetailEditor Component for editing patient data - Memoized for performance
const DetailEditor = memo(({ structuredData, patientData, onUpdate, onClose, selectedBlockType, videoSegments, summaryKeywords, highlightedFeature, selectedKeyword, resolveKeyword, mapFeatureToField, onApplyWithSummary }) => {
  const [editedStructuredData, setEditedStructuredData] = useState(structuredData || {});
  const [originalStructuredData, setOriginalStructuredData] = useState(structuredData || {});
  const [hasChanges, setHasChanges] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Keep local state in sync when parent provides/updates structuredData
  useEffect(() => {
    setEditedStructuredData(structuredData || {});
    setOriginalStructuredData(structuredData || {});
    setHasChanges(false);
  }, [structuredData]);

  // Check if there are changes
  useEffect(() => {
    const hasModifications = JSON.stringify(editedStructuredData) !== JSON.stringify(originalStructuredData);
    setHasChanges(hasModifications);
  }, [editedStructuredData, originalStructuredData]);

  // Handle field changes
  const handleFieldChange = (category, field, value) => {
    setEditedStructuredData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  // Handle numeric field changes
  const handleNumericChange = (category, field, value) => {
    const numericValue = value === '' ? null : parseFloat(value);
    handleFieldChange(category, field, numericValue);
  };

  // Apply changes with summary regeneration
  const handleApply = async () => {
    if (onApplyWithSummary) {
      setIsGeneratingSummary(true);
      await onApplyWithSummary(editedStructuredData);
      setIsGeneratingSummary(false);
    } else {
      onUpdate(editedStructuredData);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setEditedStructuredData(originalStructuredData);
    setHasChanges(false);
  };

  // Reset to original
  const handleReset = () => {
    setEditedStructuredData(structuredData || {});
    setOriginalStructuredData(structuredData || {});
    setHasChanges(false);
  };

  // Save changes (legacy support)
  const handleSave = () => {
    handleApply();
  };

  // Render option buttons as dropdown for selections
  const renderOptionButtons = (category, field, options) => {
    if (!options) return null;
    
    // Check if options is an array, if not return null or render as text input
    if (!Array.isArray(options)) {
      // For non-array options (like "float"), render as text input
      let currentValue;
      if (category === field) {
        currentValue = editedStructuredData[category];
      } else {
        currentValue = editedStructuredData[category]?.[field];
      }
      
      return (
        <input
          type="text"
          className="field-input"
          value={currentValue || ''}
          onChange={(e) => {
            console.log('🧪 recommend-set:text', { category, field, value: e.target.value, patientData });
            if (category === field) {
              setEditedStructuredData(prev => ({
                ...prev,
                [category]: e.target.value
              }));
            } else {
              handleFieldChange(category, field, e.target.value);
            }
          }}
          placeholder="Enter value"
        />
      );
    }
    
    // Handle single-field categories (like image_quality, cardiac_rhythm)
    let currentValue;
    if (category === field) {
      // Single field category
      currentValue = editedStructuredData[category];
    } else {
      // Nested field
      currentValue = editedStructuredData[category]?.[field];
    }
    
    // For boolean values (yes/no), render as checkbox
    if (options.length === 2 && options.includes('yes') && options.includes('no')) {
      return (
        <input
          type="checkbox"
          className="field-checkbox"
          checked={currentValue === 'yes'}
          onChange={(e) => {
            const newValue = e.target.checked ? 'yes' : 'no';
            console.log('🧪 recommend-set:checkbox', { category, field, value: newValue, patientData });
            if (category === field) {
              setEditedStructuredData(prev => ({
                ...prev,
                [category]: newValue
              }));
            } else {
              handleFieldChange(category, field, newValue);
            }
          }}
        />
      );
    }
    
    // For other options, render as dropdown
    return (
      <select
        className="field-select"
        value={currentValue || ''}
        onChange={(e) => {
          console.log('🧪 recommend-set:select', { category, field, value: e.target.value, patientData });
          if (category === field) {
            setEditedStructuredData(prev => ({
              ...prev,
              [category]: e.target.value
            }));
          } else {
            handleFieldChange(category, field, e.target.value);
          }
        }}
      >
        <option value="">Select...</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </option>
        ))}
      </select>
    );
  };

  // Render Recommend Feature section
  const renderRecommendFeatureSection = () => {
    if (!summaryKeywords || summaryKeywords.length === 0) return null;
    
    // Extract and deduplicate key features from keywords
    const keyFeatureMap = new Map();
    
    summaryKeywords.forEach((kw, index) => {
      if (kw.key_feature && Array.isArray(kw.key_feature)) {
        kw.key_feature.forEach(feature => {
          if (!keyFeatureMap.has(feature)) {
            keyFeatureMap.set(feature, {
              feature: feature,
              importance: kw.importanceScore || 3,
              category: Array.isArray(kw.category) ? kw.category : [kw.category],
              term: kw.term
            });
          } else {
            // Update importance if higher
            const existing = keyFeatureMap.get(feature);
            if ((kw.importanceScore || 3) > existing.importance) {
              existing.importance = kw.importanceScore || 3;
            }
          }
        });
      }
    });
    
    // Convert to array and sort by importance (highest first)
    let recommendedFeatures = Array.from(keyFeatureMap.values())
      .sort((a, b) => b.importance - a.importance);
    
    // Filter features based on selected keyword
    if (selectedKeyword) {
      // Parse uniqueId format: sentence_number::normalized_keyword
      const [sentenceNumStr, normalizedKeyword] = selectedKeyword.split('::');
      const sentenceNumber = parseInt(sentenceNumStr);
      
      // Resolve keyword using sentence + normalized text
      const keywordObj = resolveKeyword(sentenceNumber, normalizedKeyword);
      
      if (keywordObj && keywordObj.key_feature && Array.isArray(keywordObj.key_feature) && keywordObj.key_feature.length > 0) {
        // Show only the features that are in the selected keyword's key_feature
        // Map feature values to field names if needed
        const mappedFeatures = keywordObj.key_feature.map(feature => {
          const mapped = mapFeatureToField(feature);
          return mapped ? mapped.field : feature;
        });
        
        recommendedFeatures = recommendedFeatures.filter(feature => 
          mappedFeatures.includes(feature.feature) || keywordObj.key_feature.includes(feature.feature)
        );

        // Sort by key_feature order (maintain the order from AI response)
        recommendedFeatures.sort((a, b) => {
          const aIndex = keywordObj.key_feature.indexOf(a.feature);
          const bIndex = keywordObj.key_feature.indexOf(b.feature);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
    } else {
      // If no keyword is selected, show all features from all keywords
      // This ensures all key_feature items are visible
      const allKeyFeatures = new Set();
      summaryKeywords.forEach(kw => {
        if (kw.key_feature && Array.isArray(kw.key_feature)) {
          kw.key_feature.forEach(feature => allKeyFeatures.add(feature));
        }
      });
      
      // Add any missing features from key_feature that might not be in keyFeatureMap
      allKeyFeatures.forEach(feature => {
        if (!recommendedFeatures.find(f => f.feature === feature)) {
          recommendedFeatures.push({
            feature: feature,
            importance: 3,
            category: 'general',
            term: feature
          });
        }
      });
    }
    
    if (recommendedFeatures.length === 0) return null;
    
    return (
      <div className="recommend-feature-section">
        {recommendedFeatures.map((item, index) => {
          // Find the field in the appropriate category
          let fieldCategory = item.category || 'general';
          let currentValue = null;
          let fieldOptions = null;
          
          
          // Check if it's a direct field in standardizedStructure
          if (standardizedStructure[item.feature]) {
            fieldCategory = item.feature;
            currentValue = editedStructuredData[item.feature];
            fieldOptions = standardizedStructure[item.feature];

          } else {
            // Check nested fields with exact match first
            let found = false;
            Object.entries(standardizedStructure).forEach(([cat, fields]) => {
              if (typeof fields === 'object' && !Array.isArray(fields) && fields[item.feature]) {
                fieldCategory = cat;
                currentValue = editedStructuredData[cat]?.[item.feature];
                fieldOptions = fields[item.feature];
                found = true;
              }
            });
            
            // If not found, try case-insensitive match
            if (!found) {
              Object.entries(standardizedStructure).forEach(([cat, fields]) => {
                if (typeof fields === 'object' && !Array.isArray(fields)) {
                  Object.keys(fields).forEach(fieldName => {
                    if (fieldName.toLowerCase() === item.feature.toLowerCase()) {
                      fieldCategory = cat;
                      currentValue = editedStructuredData[cat]?.[fieldName];
                      fieldOptions = fields[fieldName];
                      found = true;
                    }
                  });
                }
              });
            }
            
            // If still not found, check if it's a field value (like "eccentric_hypertrophy" in "lvh_pattern")
            if (!found) {
              Object.entries(standardizedStructure).forEach(([cat, fields]) => {
                if (typeof fields === 'object' && !Array.isArray(fields)) {
                  Object.entries(fields).forEach(([fieldName, fieldValues]) => {
                    if (Array.isArray(fieldValues) && fieldValues.includes(item.feature)) {
                      // This is a field value, not a field name
                      fieldCategory = cat;
                      currentValue = editedStructuredData[cat]?.[fieldName];
                      fieldOptions = fieldValues;
                      found = true;
                      // Update the feature name to the actual field name
                      item.feature = fieldName;
                    }
                  });
                }
              });
            }
            
            // If still not found, log for debugging
            if (!found) {
              console.warn(`Feature not found in standardizedStructure: ${item.feature}`);
            }
          }
          
          return (
            <div 
              key={`${item.feature}-${index}`} 
              id={`feature-${item.feature}`}
              className="recommend-feature-item"
            >
              <div className="feature-row">
                <span className="feature-name">
                  {item.feature
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .replace(/\b(tv|mv|av|pv|ivc|la|ra|lv|rv|lvot|rvot|asd|pfo|vsd|pda|sam|ero|pisa|vti|pht|dt|ivrt|gls|rwt|tapse|fac)\b/gi, (match) => match.toUpperCase())
                  }
                </span>
                {fieldOptions ? (
                  <div className="feature-field">
                    {renderOptionButtons(fieldCategory, item.feature, fieldOptions)}
                  </div>
                ) : (
                  <div className="feature-field">
                    <input
                      type="text"
                      value={currentValue || ''}
                      onChange={(e) => {
                        console.log('🧪 recommend-set:fallback', { category: fieldCategory, field: item.feature, value: e.target.value, patientData });
                        handleFieldChange(fieldCategory, item.feature, e.target.value);
                      }}
                      placeholder="Enter value"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };







  // Removed renderRelevantVideos - videos now shown in main edit panel

  // Extract measurement fields with recommended measurements
  const getMeasurementFields = () => {
    const measurements = [];
    
    // Only add recommended measurements from keywords (not existing measurements)
    if (summaryKeywords && summaryKeywords.length > 0) {
      const recommendedMeasurements = new Map();
      
      // Filter measurements based on selected keyword (like key_feature)
      if (selectedKeyword) {
        // Parse uniqueId format: sentence_number::normalized_keyword
        const [sentenceNumStr, normalizedKeyword] = selectedKeyword.split('::');
        const sentenceNumber = parseInt(sentenceNumStr);
        
        // Resolve keyword using sentence + normalized text
        const keywordObj = resolveKeyword(sentenceNumber, normalizedKeyword);
        
        if (keywordObj && keywordObj.key_measure_feature && Array.isArray(keywordObj.key_measure_feature) && keywordObj.key_measure_feature.length > 0) {
          // Show only the measurements that are in the selected keyword's key_measure_feature
          keywordObj.key_measure_feature.forEach((measureField, index) => {
            // Find the category for this measurement field
            let foundCategory = null;
            Object.entries(standardizedStructure_measure).forEach(([cat, fields]) => {
              if (fields[measureField]) {
                foundCategory = cat;
              }
            });
            
            if (foundCategory) {
              const currentValue = editedStructuredData[foundCategory]?.[measureField];
              recommendedMeasurements.set(measureField, {
                category: foundCategory,
                field: measureField,
                value: currentValue || null,
                importance: keywordObj.importanceScore || 3,
                order: index // Maintain order from key_measure_feature
              });
            }
          });
          
          // Sort by key_measure_feature order (maintain the order from AI response)
          const recommendedArray = Array.from(recommendedMeasurements.values())
            .sort((a, b) => {
              const aIndex = keywordObj.key_measure_feature.indexOf(a.field);
              const bIndex = keywordObj.key_measure_feature.indexOf(b.field);
              if (aIndex === -1 && bIndex === -1) return 0;
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            });
          
          measurements.push(...recommendedArray);
        }
      } else {
        // If no keyword is selected, show all measurements from all keywords
        summaryKeywords.forEach((kw) => {
          if (kw.key_measure_feature && Array.isArray(kw.key_measure_feature)) {
            kw.key_measure_feature.forEach((measureField, index) => {
              if (!recommendedMeasurements.has(measureField)) {
                // Find the category for this measurement field
                let foundCategory = null;
                Object.entries(standardizedStructure_measure).forEach(([cat, fields]) => {
                  if (fields[measureField]) {
                    foundCategory = cat;
                  }
                });
                
                if (foundCategory) {
                  const currentValue = editedStructuredData[foundCategory]?.[measureField];
                  recommendedMeasurements.set(measureField, {
                    category: foundCategory,
                    field: measureField,
                    value: currentValue || null,
                    importance: kw.importanceScore || 3,
                    order: index // Maintain order from key_measure_feature
                  });
                }
              }
            });
          }
        });
        
        // Convert to array and sort by importance and order (like key_feature)
        const recommendedArray = Array.from(recommendedMeasurements.values())
          .sort((a, b) => {
            if (b.importance !== a.importance) {
              return b.importance - a.importance;
            }
            return a.order - b.order;
          });
        
        measurements.push(...recommendedArray);
      }
    }
    
    // If no recommended measurements, add some common ones
    if (measurements.length === 0) {
      // Add common measurement fields if not present
      if (!editedStructuredData.lv_systolic_function?.lvef) {
        measurements.push({
          category: 'lv_systolic_function',
          field: 'lvef',
          value: editedStructuredData.lv_systolic_function?.lvef || null
        });
      }
      if (!editedStructuredData.lv_geometry?.LVEDD) {
        measurements.push({
          category: 'lv_geometry',
          field: 'LVEDD',
          value: editedStructuredData.lv_geometry?.LVEDD || null
        });
      }
      if (!editedStructuredData.lv_geometry?.IVSd) {
        measurements.push({
          category: 'lv_geometry',
          field: 'IVSd',
          value: editedStructuredData.lv_geometry?.IVSd || null
        });
      }
    }
    
    return measurements;
  };

  return (
    <div className="detail-editor">
      <div className="editor-two-column">
        {/* Left Column - Assessment */}
        <div className="editor-column-left">
          <h3>Assessment</h3>
          {renderRecommendFeatureSection()}
        </div>

        {/* Right Column - Measurements */}
        <div className="editor-column-right">
          <h3>Measurements</h3>
          <div className="measurement-fields">
            {getMeasurementFields().map(({ category, field, value }, index) => (
              <div key={`${category}-${field}-${index}`} className="measurement-field">
                <label>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                <input
                  type="number"
                  value={value || ''}
                  onChange={(e) => handleNumericChange(category, field, e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            ))}
            
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="editor-actions">
        <button 
          className="btn-apply" 
          onClick={handleApply}
          disabled={!hasChanges || isGeneratingSummary}
        >
          {isGeneratingSummary ? (
            <>
              <div className="loading-spinner-small"></div>
              <span>Generating Summary...</span>
            </>
          ) : (
            'Apply'
          )}
        </button>
        <button 
          className="btn-cancel" 
          onClick={handleCancel}
          disabled={!hasChanges || isGeneratingSummary}
        >
          Cancel
        </button>
        <button 
          className="btn-reset" 
          onClick={handleReset}
          disabled={isGeneratingSummary}
        >
          Reset
        </button>
      </div>
    </div>
  );
});

DetailEditor.displayName = 'DetailEditor';

// Memoized Line component for efficient summary rendering
const SummaryLine = memo(({ line, sentenceNumber, makeTextClickable }) => {
  return (
    <div className="summary-line">
      {makeTextClickable(line, sentenceNumber)}
    </div>
  );
});

SummaryLine.displayName = 'SummaryLine';

const PatientAssessment = memo(({ patient, onBack, onProceed }) => {
  const [patientData, setPatientData] = useState(patient);
  const [summary, setSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [videoSegments, setVideoSegments] = useState([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [error, setError] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [structuredData, setStructuredData] = useState(null);
  const [selectedBlockType, setSelectedBlockType] = useState(null);
  const [summaryKeywords, setSummaryKeywords] = useState([]);
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  const [keywordErr, setKeywordErr] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [examEntry, setExamEntry] = useState(null);
  const tooltipRef = useRef(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [keywordVideos, setKeywordVideos] = useState([]);
  const [showingVideos, setShowingVideos] = useState(false);
  const [selectedVideoCategory, setSelectedVideoCategory] = useState('all');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [allVideosData, setAllVideosData] = useState([]);
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [highlightedFeature, setHighlightedFeature] = useState(null);
  const [isSummaryEditMode, setIsSummaryEditMode] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [keywordFilteredVideos, setKeywordFilteredVideos] = useState([]);
  const [originalPatientData, setOriginalPatientData] = useState(null); // Backup of original data
  const [isUpdatingStructuredData, setIsUpdatingStructuredData] = useState(false); // Loading state for AI update
  const [isChatActive, setIsChatActive] = useState(false);
  const panelTransitionTimeoutRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const previousFocusRef = useRef(null);
  const hasGeneratedVideosRef = useRef(false);
  
  // Chat and Canvas states
  const [messages, setMessages] = useState([]);
  const [canvasContent, setCanvasContent] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [summaryHeight, setSummaryHeight] = useState(50); // Default height for summary section
  const [isResizing, setIsResizing] = useState(false);

  
  // Connection and Analysis Status States
  const [connectionStatus, setConnectionStatus] = useState(''); // 'Connecting', 'Connected', 'Connection failed', 'Disconnected'
  const [analysisStatus, setAnalysisStatus] = useState(''); // 'Analyzing AI data', 'Analysis failed'
  const [streamingSummary, setStreamingSummary] = useState(''); // For real-time streaming display

  // Resize functionality
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    
    const summaryPanel = document.querySelector('.summary-panel');
    if (!summaryPanel) return;
    
    const panelRect = summaryPanel.getBoundingClientRect();
    const newHeight = e.clientY - panelRect.top;
    
    // Constrain height between 50px and 80% of viewport height
    const maxHeight = Math.floor(window.innerHeight * 0.8);
    const constrainedHeight = Math.max(50, Math.min(maxHeight, newHeight));
    setSummaryHeight(constrainedHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  
  // Cache for regex patterns to avoid recompilation
  const regexCacheRef = useRef(new Map());
  
  // Shared normalization function for consistent string matching
  const normalize = useCallback((str) => {
    if (!str) return '';
    return str
      .normalize('NFKC')
      .replace(/\u00A0/g, ' ') // NBSP -> space
      .replace(/[\u2010-\u2015]/g, '-') // various hyphens -> '-'
      .replace(/[""„‟]/g, '"') // fancy double quotes -> "
      .replace(/[''‚‛]/g, "'") // fancy single quotes -> '
      .replace(/\s+/g, ' ') // collapse whitespace
      .trim()
      .toLowerCase();
  }, []);
  
  // Helper function to resolve keyword by sentence + normalized text
  const resolveKeyword = useCallback((sentenceNumber, normalizedKeyword) => {
    const result = summaryKeywords.find(kw => {
      const kwSentence = kw.sentence_number;
      const kwNormalized = normalize(kw.text || kw.term || '');
      const aliasMatch = kw.aliases && Array.isArray(kw.aliases) && 
        kw.aliases.some(alias => normalize(alias) === normalizedKeyword);
      
      return kwSentence === sentenceNumber && (kwNormalized === normalizedKeyword || aliasMatch);
    });
    
    // Fallback: if sentence-based matching fails, try text-only matching
    if (!result) {
      const fallbackResult = summaryKeywords.find(kw => {
        const kwNormalized = normalize(kw.text || kw.term || '');
        const aliasMatch = kw.aliases && Array.isArray(kw.aliases) && 
          kw.aliases.some(alias => normalize(alias) === normalizedKeyword);
        
        return kwNormalized === normalizedKeyword || aliasMatch;
      });
      
      if (fallbackResult) {
        console.log('🔍 Used fallback matching for:', normalizedKeyword);
        return fallbackResult;
      }
    }
    
    return result;
  }, [summaryKeywords, normalize]);
  
  // Helper function to map key_feature values to field names
  const mapFeatureToField = useCallback((feature) => {
    // Check if it's already a direct field name
    if (standardizedStructure[feature]) {
      return { category: feature, field: feature };
    }
    
    // Search nested structures
    for (const [category, fields] of Object.entries(standardizedStructure)) {
      if (typeof fields === 'object' && !Array.isArray(fields)) {
        // Check if feature is a field name
        if (fields[feature]) {
          return { category, field: feature };
        }
        // Check if feature is a field value
        for (const [fieldName, fieldValues] of Object.entries(fields)) {
          if (Array.isArray(fieldValues) && fieldValues.includes(feature)) {
            return { category, field: fieldName, value: feature };
          }
        }
      }
    }
    return null;
  }, []);
  
  // Memoize merged keywords to avoid recreation on every render
  const mergedKeywords = useMemo(() => {
    if (!summaryKeywords || summaryKeywords.length === 0) return [];
    const toArray = (x) => Array.isArray(x) ? x : (x ? [x] : []);
    return summaryKeywords.map(kw => ({
      ...kw,
      term: kw.term || kw.text || '',
      text: kw.text || kw.term || '',
      aliases: [...toArray(kw.aliases)]
    }));
  }, [summaryKeywords]);
  const hasGeneratedLeftPanelVideosRef = useRef(false);
  const hasGeneratedSummaryRef = useRef(false);

  // Video segment names for echocardiography
  const segmentNames = [
    'PLAX View', 'PSAX Aortic', 'PSAX Mitral', 'PSAX Papillary',
    'Apical 4CH', 'Apical 2CH', 'Apical 3CH', 'Subcostal'
  ];

  // Extract patient info
  const extractPatientInfo = (examId) => {
    const parts = examId.split('__');
    return {
      id: parts[0] || examId,
      date: parts[1] || '',
      fullId: examId
    };
  };

  const patientInfo = extractPatientInfo(patient.exam_id);

  // Summary edit mode functions
  const handleSummaryEdit = () => {
    // Backup original data before editing
    if (!originalPatientData) {
      setOriginalPatientData({
        patientData: { ...patientData },
        structuredData: structuredData ? { ...structuredData } : null,
        summary: summary
      });
    }
    setIsSummaryEditMode(true);
    setEditedSummary(summary || '');
  };

  const handleSummaryCancel = () => {
    // Restore original state on cancel
    if (originalPatientData) {
      setSummary(originalPatientData.summary);
      // Don't restore structuredData and patientData on cancel, only on reset
    }
    setIsSummaryEditMode(false);
    setEditedSummary('');
  };

  // Function to handle keyword extraction
  const handleKeywordExtraction = async (summaryText) => {
    try {
      setIsExtractingKeywords(true);
      setKeywordErr(null);
      
      const result = await extractKeywordsFromSummary(
        summaryText, 
        structuredData, 
        patientData?.exam_id || patient?.exam_id
      );
      
      if (result && result.keywords && Array.isArray(result.keywords)) {
        setSummaryKeywords(result.keywords);
        console.log('✅ Keywords extracted:', result.keywords.length, 'keywords');
        return result.keywords;
      } else {
        setSummaryKeywords([]);
        return [];
      }
    } catch (kwErr) {
      console.error('❌ Failed to extract keywords:', kwErr);
      setKeywordErr(`Failed to extract keywords: ${kwErr.message || 'Unknown error'}`);
      setSummaryKeywords([]);
      return [];
    } finally {
      setIsExtractingKeywords(false);
    }
  };

  const handleSummaryApply = async () => {
    // Apply the modified summary and update structuredData
    setIsUpdatingStructuredData(true);
    setError(null);
    
    try {
      // Update summary
      setSummary(editedSummary);
      
      // Call OpenAI to update structuredData based on modified summary
      console.log('🤖 Calling AI to update structuredData from modified summary...');
      const result = await updateStructuredDataFromSummary(
        editedSummary,
        structuredData || {},
        { debug: true }
      );
      
      if (result.success) {
        console.log('✅ StructuredData updated successfully!');
        console.log('📊 Previous structuredData:', structuredData);
        console.log('🔄 Updates applied:', result.updates);
        console.log('📊 New structuredData:', result.data);
        
        // Log what changed in structuredData
        console.log('🔍 STRUCTUREDDATA CHANGES:');
        Object.entries(result.updates).forEach(([category, fields]) => {
          if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
            Object.entries(fields).forEach(([field, newValue]) => {
              const oldValue = structuredData?.[category]?.[field];
              console.log(`  ${category}.${field}: "${oldValue}" → "${newValue}"`);
            });
          } else {
            const oldValue = structuredData?.[category];
            console.log(`  ${category}: "${oldValue}" → "${fields}"`);
          }
        });
        setStructuredData(result.data);
        
        // Update patientData with new structuredData values
        const flattenedData = {};
        Object.entries(result.data).forEach(([category, value]) => {
          if (typeof value === 'object' && value !== null) {
            // Nested category with fields
            Object.entries(value).forEach(([field, fieldValue]) => {
              // Create both flat and categorized keys
              flattenedData[field] = fieldValue;
              flattenedData[`${category}//${field}`] = fieldValue;
            });
          } else {
            // Direct value
            flattenedData[category] = value;
          }
        });
        
        console.log('🔄 Flattened data for patientData update:', flattenedData);
        
        // Log what will change in patientData
        console.log('🔍 PATIENTDATA CHANGES:');
        Object.entries(flattenedData).forEach(([key, newValue]) => {
          const oldValue = patientData[key];
          if (oldValue !== newValue) {
            console.log(`  ${key}: "${oldValue}" → "${newValue}"`);
          }
        });
        
        setPatientData(prev => {
          const newPatientData = { ...prev, ...flattenedData };
          console.log('📊 Previous patientData:', prev);
          console.log('📊 Updated patientData:', newPatientData);
          return newPatientData;
        });
        
        // Re-extract keywords for the updated summary
        if (editedSummary) {
          console.log('🔑 Re-extracting keywords for updated summary...');
          console.log('📝 Summary for keyword extraction:', editedSummary);
          await handleKeywordExtraction(editedSummary);
        }
        
        // Clear original data backup after successful apply
        setOriginalPatientData(null);
        
      } else {
        console.error('❌ Failed to update structuredData:', result.error);
        setError(`Failed to update data: ${result.error}`);
      }
      
    } catch (err) {
      console.error('❌ Error applying summary changes:', err);
      setError('Failed to apply summary changes. Please try again.');
    } finally {
      setIsUpdatingStructuredData(false);
      setIsSummaryEditMode(false);
      setEditedSummary('');
    }
  };

  const handleSummaryReset = async () => {
    // Reset to original patient data and regenerate everything
    if (originalPatientData) {
      console.log('🔄 Resetting to original patient data...');
      console.log('📊 Original patientData:', originalPatientData.patientData);
      console.log('📊 Original structuredData:', originalPatientData.structuredData);
      console.log('📝 Original summary:', originalPatientData.summary);
      
      // Restore original states
      setPatientData(originalPatientData.patientData);
      setStructuredData(originalPatientData.structuredData);
      setSummary(originalPatientData.summary);
      
      // Clear backup
      setOriginalPatientData(null);
      
      // Exit edit mode
      setIsSummaryEditMode(false);
      setEditedSummary('');
    } else {
      // If no backup, regenerate from initial patient data
      console.log('🔄 Regenerating structuredData from initial patient data...');
      console.log('📊 Initial patient data:', patient);
      const structured = structurePatientData(patient);
      console.log('📊 Newly generated structuredData:', structured);
      setStructuredData(structured);
      setPatientData(patient);
      
      // Reset summary generation flag and regenerate summary
      hasGeneratedSummaryRef.current = false;
      await handleGenerateSummary();
    }
  };



  // Load video segments
  const loadVideoSegments = async () => {
    setIsLoadingVideos(true);
    const segments = [];
    
    try {
      // Create 8 video segments (using the same video for demo purposes)
      for (let i = 0; i < 8; i++) {
        const videoPath = "/videos/26409027(1).dcm.mp4";
        const videoUrl = await npzToVideoUrl(videoPath);
        
        segments.push({
          id: i,
          name: segmentNames[i],
          url: videoUrl,
          confidence: Math.floor(Math.random() * 20) + 80 + '%', // 80-99%
          findings: `Analysis segment ${i + 1}`,
          measurements: generateMockMeasurements(i)
        });
      }
      
      setVideoSegments(segments);
    } catch (err) {
      console.error('Error loading video segments:', err);
      setError('Failed to load video segments');
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Generate mock measurements for demo
  const generateMockMeasurements = (index) => {
    const measurements = [
      [{ label: "LVEDD: 49mm", status: "normal" }, { label: "IVSd: 14mm", status: "abnormal" }],
      [{ label: "Ao Root: 32mm", status: "normal" }, { label: "LA: 45mm", status: "abnormal" }],
      [{ label: "MVA: 3.2cm²", status: "normal" }, { label: "MR: Mild", status: "normal" }],
      [{ label: "LVEF: 57%", status: "normal" }, { label: "WMA: None", status: "normal" }],
      [{ label: "RA: 18cm²", status: "normal" }, { label: "RV: Normal", status: "normal" }],
      [{ label: "LV Vol: 120ml", status: "normal" }, { label: "Strain: -18%", status: "normal" }],
      [{ label: "LVOT: 2.1cm", status: "normal" }, { label: "AS: None", status: "normal" }],
      [{ label: "IVC: 18mm", status: "normal" }, { label: "RAP: 8mmHg", status: "normal" }]
    ];
    return measurements[index] || [];
  };

  // Generate AI summary via WebSocket streaming with proper socket parameter
  const handleGenerateSummaryWS = async (wsSocket) => {
    // Use provided socket or fall back to state socket
    const activeSocket = wsSocket || socket;
    
    // Check if WebSocket is connected
    if (!activeSocket || !activeSocket.connected) {
      console.log('⚠️ WebSocket not connected, waiting for connection...');
      return;
    }
    
    setIsGeneratingSummary(true);
    setError(null);
    setAnalysisStatus('Analyzing AI data');
    setStreamingSummary(''); // Clear streaming summary
    
    try {
      console.log('🔄 Starting AI summary generation via WebSocket...');
      
      // Send summary generation request via WebSocket
      const summaryRequest = {
        type: 'generate_summary',
        patientData: patientData
      };
      
      activeSocket.emit('generate_summary', summaryRequest);
      
      // Clear existing summary to show streaming
      setSummary('');
      
    } catch (err) {
      console.error('❌ Failed to start summary generation:', err);
      setError('Failed to start AI summary generation. Please try again.');
      setAnalysisStatus('Analysis failed');
      setIsGeneratingSummary(false);
    }
  };
  
  // Public wrapper for summary generation
  const handleGenerateSummary = async () => {
    // Prevent duplicate execution using ref
    if (hasGeneratedSummaryRef.current) {
      console.log('⚠️ Summary already generated, skipping...');
      return;
    }
    
    // Prevent duplicate execution
    if (isGeneratingSummary) {
      console.log('⚠️ Summary generation already in progress, skipping...');
      return;
    }
    
    // Prevent execution if summary already exists and keywords are extracted
    if (summary && summaryKeywords.length > 0) {
      console.log('⚠️ Summary and keywords already exist, skipping generation...');
      hasGeneratedSummaryRef.current = true; // Mark as generated
      return;
    }
    
    hasGeneratedSummaryRef.current = true; // Mark as generating
    
    if (socket && socket.connected) {
      await handleGenerateSummaryWS(socket);
    } else {
      console.log('⚠️ WebSocket not connected, falling back to HTTP API');
      await handleGenerateSummaryHTTP();
    }
  };

  
  // Fallback HTTP method for summary generation
  const handleGenerateSummaryHTTP = async () => {
    setIsGeneratingSummary(true);
    setError(null);
    
    try {
      console.log('🔄 Starting AI summary generation via HTTP...');
      console.log('🔍 patientData:', patientData);
      const aiSummary = await generateSummary(patientData);
      setSummary(aiSummary);
      console.log('✅ AI Summary generated');
      
      // Generate structured data for keyword extraction
      const structured = structurePatientData(patientData);
      setStructuredData(structured);
      
      // Extract keywords from the generated summary (only if not already extracted)
      if (aiSummary && summaryKeywords.length === 0) {
        setIsExtractingKeywords(true);
        setKeywordErr(null);
        try {
          console.log('🔑 Extracting keywords...');
          const result = await extractKeywordsFromSummary(aiSummary, structured, patient.exam_id);
          
          if (result && result.keywords && Array.isArray(result.keywords)) {
            setSummaryKeywords(result.keywords);
          } else {
            setSummaryKeywords([]);
          }
        } catch (kwErr) {
          console.error('❌ Failed to extract keywords:', kwErr);
          setKeywordErr(`Failed to extract keywords: ${kwErr.message || 'Unknown error'}`);
          setSummaryKeywords([]);
        } finally {
          setIsExtractingKeywords(false);
        }
      } else if (summaryKeywords.length > 0) {
        console.log('ℹ️ Keywords already extracted, skipping...');
      }
    } catch (err) {
      console.error('❌ Failed to generate summary:', err);
      setError('Failed to generate AI summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };


  // Filter videos based on keyword category and view_attention
  const filterVideosByKeyword = (keywordObj) => {
    if (!allVideosData || allVideosData.length === 0) {
      console.log('❌ No video data available');
      return [];
    }
    
    // Handle multiple categories
    const categories = Array.isArray(keywordObj.category) ? keywordObj.category : [keywordObj.category];
    console.log('🔍 Filtering videos for categories:', categories);
    console.log('📊 Total videos available:', allVideosData.length);
    
    // Filter videos by keyword categories
    let filtered = allVideosData.filter(video => 
      categories.includes(video.category)
    );
    
    console.log('📹 Videos after category filtering:', filtered.length);
    console.log('📹 Category distribution:', filtered.reduce((acc, video) => {
      acc[video.category] = (acc[video.category] || 0) + 1;
      return acc;
    }, {}));
    
    // Sort by weight (view_attention) - highest first
    filtered.sort((a, b) => b.weight - a.weight);
    
    // Remove duplicates based on fname (file name) while maintaining order
    const uniqueVideos = [];
    const seenFnames = new Set();
    
    // Take more videos initially to ensure we get 5 unique ones
    const initialCount = Math.min(filtered.length, 50); // Take up to 50 videos initially
    
    console.log('🔍 Checking first', initialCount, 'videos for uniqueness...');
    
    for (let i = 0; i < initialCount; i++) {
      const video = filtered[i];
      if (!seenFnames.has(video.fname)) {
        seenFnames.add(video.fname);
        uniqueVideos.push(video);
        console.log(`✅ Added unique video ${i + 1}: ${video.fname} (${video.category})`);
        
        // Stop when we have 5 unique videos
        if (uniqueVideos.length >= 5) {
          console.log('🎯 Found 5 unique videos, stopping search');
          break;
        }
      } else {
        console.log(`⚠️ Skipped duplicate video: ${video.fname} (${video.category})`);
      }
    }
    
    console.log('📊 Final unique videos found:', uniqueVideos.length);
    
    // If we don't have enough videos from the specific categories, add videos from other categories
    if (uniqueVideos.length < 5) {
      console.log('⚠️ Not enough videos from specific categories, adding from other categories...');
      
      // Get videos from other categories
      const otherVideos = allVideosData.filter(video => 
        !categories.includes(video.category)
      ).sort((a, b) => b.weight - a.weight);
      
      // Add unique videos from other categories
      for (let i = 0; i < otherVideos.length && uniqueVideos.length < 5; i++) {
        const video = otherVideos[i];
        if (!seenFnames.has(video.fname)) {
          seenFnames.add(video.fname);
          uniqueVideos.push(video);
          console.log(`✅ Added video from other category: ${video.fname} (${video.category})`);
        }
      }
      
      console.log('📊 Final videos after adding from other categories:', uniqueVideos.length);
    }
    
    // Return up to 5 unique videos with highest view_attention
    return uniqueVideos.slice(0, 5);
  };

  // Debounced scroll handler
  const scrollToElementDebounced = (selector, options = {}) => {

    // Clear any pending scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Wait for panel transition to complete before scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      
      // Single requestAnimationFrame is sufficient
      requestAnimationFrame(() => {
        const element = document.querySelector(selector);

        if (element && !isTransitioningRef.current) {
          try {
            element.scrollIntoView({ 
              behavior: 'smooth',
              block: options.block || 'start',
              ...options 
            });
          } catch (error) {
            console.warn('📜 Scroll error:', error);
          }
        } else {
          console.log('📜 Scroll cancelled - element not found or transition in progress');
        }
      });
    }, 650); // Reduced wait time - CSS transition is 600ms
  };

  // Handle keyword click to navigate to feature or select video category
  const handleKeywordClick = (uniqueId, event) => {
    event.stopPropagation(); // Prevent block click
    
    // Prevent concurrent transitions
    if (isTransitioningRef.current) {
      return;
    }
    
    
    // Parse uniqueId format: sentence_number::normalized_keyword
    const [sentenceNumStr, normalizedKeyword] = uniqueId.split('::');
    const sentenceNumber = parseInt(sentenceNumStr);
    
    // Resolve keyword using sentence + normalized text
    const keywordObj = resolveKeyword(sentenceNumber, normalizedKeyword);
    
    // Set the selected keyword (no toggle behavior) - do this first
    setSelectedKeyword(uniqueId);
    
    if (keywordObj) {
      // Always open the detail panel when a keyword is clicked
      if (!showDetailPanel) {
        isTransitioningRef.current = true;
        const structured = structurePatientData(patientData);
        setStructuredData(structured);
        setSelectedBlockType(null);
        
        // Use a small delay to ensure selectedKeyword state has updated
        setTimeout(() => {
          setShowDetailPanelDebounced(true);
        }, 50);
        
        // Reset transition flag after animation
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 650);
      }
      
      // Filter videos based on keyword category when no videos are loaded
      if (allVideosData.length > 0) {
        const filteredVideos = filterVideosByKeyword(keywordObj);
        setKeywordFilteredVideos(filteredVideos);
        
        // Use debounced scroll
        scrollToElementDebounced('.edit-video-section');
      }
      
      // Check if keyword has associated features
      if (keywordObj.key_feature && keywordObj.key_feature.length > 0) {
        // Highlight all features for this keyword
        const features = keywordObj.key_feature;
        if (features.length > 0) {
          // Highlight the first feature for scrolling
          const firstFeature = features[0];

          setHighlightedFeature(firstFeature);
          
          // Use debounced scroll for feature
          scrollToElementDebounced(`#feature-${firstFeature}`, { block: 'center' });
          
          // Remove highlight after delay
          setTimeout(() => {
            setHighlightedFeature(null);
          }, 3000);
        }
      } else if (keywordObj.category) {
        // If no features, fall back to video category selection
        
        // Special handling for general category keywords
        let videoCategory = Array.isArray(keywordObj.category) ? keywordObj.category[0] : keywordObj.category;
        if (['image_quality', 'cardiac_rhythm_abnormality', 'cardiac_rhythm'].includes(videoCategory)) {
          videoCategory = 'general';
        }
        
        setSelectedVideoCategory(videoCategory);
        console.log('📹 Video category selected:', videoCategory);
        
        // Use debounced scroll for video panel
        scrollToElementDebounced('.video-panel');
      }
    } else {
      // Even if keyword resolution fails, still open the panel
      console.warn('⚠️ Failed to resolve keyword, but opening panel anyway');
      if (!showDetailPanel) {
        isTransitioningRef.current = true;
        const structured = structurePatientData(patientData);
        setStructuredData(structured);
        setSelectedBlockType(null);
        
        // Use a small delay to ensure selectedKeyword state has updated
        setTimeout(() => {
          setShowDetailPanelDebounced(true);
        }, 50);
        
        // Reset transition flag after animation
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 650);
      }
    }
  };

  // Debounced panel transition handler
  const setShowDetailPanelDebounced = (value) => {
    
    // Clear any pending transitions
    if (panelTransitionTimeoutRef.current) {
      clearTimeout(panelTransitionTimeoutRef.current);
    }
    
    // Debounce the transition to prevent rapid state changes
    panelTransitionTimeoutRef.current = setTimeout(() => {
    
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        
        setShowDetailPanel(value);
        panelTransitionTimeoutRef.current = null;
        
        // Log after state change with delay
        setTimeout(() => {
          console.log('🔄 DOM state after transition - main-container classes:', document.querySelector('.main-container')?.className);
          console.log('🔄 DOM state after transition - edit-panel classes:', document.querySelector('.edit-panel')?.className);
        }, 50);
      });
    }, 100); // Increased debounce to prevent rapid changes
  };


  // Performance-optimized chat animation control
  const performChatTransition = useCallback((activate) => {
    const summaryPanel = document.querySelector('.summary-panel');
    if (!summaryPanel) return;

    // Step 1: Add animating class and prepare for GPU acceleration
    requestAnimationFrame(() => {
      summaryPanel.classList.add('chat-animating');
      
      // Step 2: Apply the active state
      requestAnimationFrame(() => {
        if (activate) {
          summaryPanel.classList.add('chat-active');
        } else {
          summaryPanel.classList.remove('chat-active');
        }
        
        // Step 3: Clean up after animation completes
        setTimeout(() => {
          summaryPanel.classList.remove('chat-animating');
          
          // Remove will-change properties for memory optimization
          const summarySection = summaryPanel.querySelector('.summary-section');
          const chatbotSection = summaryPanel.querySelector('.chatbot-section');
          
          if (summarySection) summarySection.style.willChange = 'auto';
          if (chatbotSection) chatbotSection.style.willChange = 'auto';
        }, 600); // Match CSS transition duration
      });
    });
  }, []);

  // Chat activation with Enter key only
  const handleKeyDown = useCallback((event) => {
    
    if (event.key === 'Enter') {
      event.preventDefault();
      const inputValue = event.target.value.trim();
      
      if (inputValue && isChatActive) {
        console.log('💬 Processing message submission');
        console.log('🔌 Socket status:', socket ? 'exists' : 'null', 'connected:', socket?.connected, 'isConnected state:', isConnected);
        
        // Send message immediately if chat is already active
        if (socket && socket.connected && isConnected) {
          console.log('✅ WebSocket ready, proceeding with chat');
          handleChatSubmit(event);
        } else {
          console.log('⏳ WebSocket not ready, waiting for connection...');
          const checkConnection = () => {
            if (socket && socket.connected && isConnected) {
              console.log('✅ WebSocket connected, sending message');
              handleChatSubmit(event);
            } else {
              console.log('⏳ Still waiting for connection...');
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        }
      }
    }
  }, [isChatActive, socket, isConnected]);

  // Chat activation with click
  const handleInputClick = useCallback(() => {
    if (!isChatActive) {
      console.log('💬 Activating chat mode with click');
      // Set initial height to 50vh (half of viewport)
      const initialHeight = Math.floor(window.innerHeight * 0.5);
      setSummaryHeight(initialHeight);
      performChatTransition(true);
      setIsChatActive(true);
    }
  }, [isChatActive, performChatTransition]);

  // Auto scroll to bottom when new messages are added
  const scrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, []);

  // Auto scroll when messages change or typing status changes
  useEffect(() => {
    if (isChatActive && (messages.length > 0 || isTyping)) {
      // Small delay to ensure DOM is updated
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isTyping, isChatActive, scrollToBottom]);

  const handleChatSubmit = useCallback((event) => {
    if (event) event.preventDefault();
    const input = chatInputRef.current;
    if (input && input.value.trim()) {
      const messageText = input.value.trim();
      console.log('💬 Chat message submitted:', messageText);
      
      // Add user message to chat history
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Send message through WebSocket
      console.log('🔌 Socket status:', socket ? 'exists' : 'null', 'connected:', socket?.connected, 'isConnected state:', isConnected);
      
      if (socket && socket.connected && isConnected) {
        setIsTyping(true);
        
        const messageData = {
          content: messageText,
          patientData: {
            name: patientData?.patient_name || patientData?.name || 'Unknown Patient',
            age: patientData?.age,
            condition: summary ? 'Has Assessment' : 'No Assessment Yet',
            summary: summary,
            keywords: summaryKeywords,
            structuredData: structuredData
          }
        };
        
        console.log('📤 메시지 전송:', messageData);
        
        socket.emit('message', messageData);
      } else {
        // Fallback if not connected
        console.log('⚠️ Socket not ready, adding to queue or showing error');
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'system',
          content: 'Chat server is not connected. Please wait a moment and try again.',
          timestamp: new Date().toISOString()
        }]);
      }
      
      // Clear input
      input.value = '';
    }
  }, [socket, patientData, summary, structuredData]);

  // Debug AI Canvas visibility
  const debugCanvasVisibility = useCallback(() => {
    console.log('🎨 DEBUG Canvas Visibility:');
    console.log('  - isChatActive:', isChatActive);
    console.log('  - showDetailPanel:', showDetailPanel);
    console.log('  - Condition result:', isChatActive && showDetailPanel);
  }, [isChatActive, showDetailPanel]);

  // Debug on state changes
  useEffect(() => {
    debugCanvasVisibility();
  }, [isChatActive, showDetailPanel, debugCanvasVisibility]);

  // Initialize WebSocket connection and start summary generation on patient selection
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3002';
    console.log('🔌 Connecting to WebSocket immediately:', wsUrl);
    
    // Connect to WebSocket
    
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'], // Allow fallback
      reconnection: true,
      reconnectionAttempts: 10, // Increase attempts
      reconnectionDelay: 500, // Faster reconnection
      timeout: 10000, // Faster timeout
      forceNew: true, // Force new connection
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to chat server');
      setIsConnected(true);
      console.log('🚀 WebSocket ready for chat!');
      // Don't auto-generate summary on connection - only on initial load
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from chat server');
      setIsConnected(false);
    });

    // Handle direct messages (fallback for non-function-calling responses)
    newSocket.on('message', (data) => {
      console.log('🤖 챗봇 답변:', data);
      
      // Only add message if it's not already being streamed or completed
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          // Update existing streaming message instead of adding new one
          return prev.map((msg, index) => 
            index === prev.length - 1 
              ? { ...msg, content: data.content, isStreaming: false }
              : msg
          );
        } else if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isStreaming) {
          // If last message is already completed assistant message, ignore this
          console.log('⚠️ Ignoring duplicate message - last message already completed');
          return prev;
        } else {
          // Add new message
          return [...prev, {
            id: Date.now() + Math.random(),
            role: data.role || 'assistant',
            content: data.content,
            timestamp: new Date().toISOString()
          }];
        }
      });
      setIsTyping(false);
    });

    // Handle streaming events
    newSocket.on('stream_start', (data) => {
      console.log('🌊 Stream started:', data);
      setIsTyping(true);
    });

    // Handle streaming chunks with enhanced processing
    newSocket.on('stream_chunk', (data) => {
      // Handle different types of streaming content
      if (data.type === 'chat' || data.function_name === 'send_chat_message' || data.function_name === 'direct_response') {
        
        // Update chat message content progressively by accumulating chunks
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            // Update existing streaming message
            return prev.map((msg, index) => 
              index === prev.length - 1 
                ? { ...msg, content: msg.content + data.content }
                : msg
            );
          } else {
            // Create new streaming message
            return [...prev, {
              id: Date.now() + Math.random(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date().toISOString(),
              isStreaming: true,
              callId: data.callId
            }];
          }
        });

      } else if (data.type === 'summary') {
        // Handle summary streaming with real-time display
        console.log('📝 Summary chunk received:', data.content);
        setStreamingSummary(prev => prev + data.content);
        setSummary(prev => prev + data.content);
        
      } else if (data.type === 'metadata') {
        console.log('📊 Metadata received:', data.content);
        // Store metadata for later use if needed
      }
    });

    // Handle stream end event with parsed response
    newSocket.on('stream_end', (data) => {
      console.log('✅ Stream end with parsed response:', data);
      setIsTyping(false);
    });
    
    // Handle stream completion
    newSocket.on('stream_complete', (data) => {
      console.log('✅ Stream completed:', data);
      setIsTyping(false);
      
      // Clear analysis status on completion
      if (data.type === 'summary') {
        setAnalysisStatus('');
        setIsGeneratingSummary(false);
        
        // Finalize the summary
        const finalSummary = streamingSummary || summary;
        setSummary(finalSummary);
        
        // Build structured data and extract keywords (only if not already extracted)
        if (finalSummary && summaryKeywords.length === 0) {
          (async () => {
            try {
              const structured = structurePatientData(patientData);
              setStructuredData(structured);
              setIsExtractingKeywords(true);
              setKeywordErr(null);
              const result = await extractKeywordsFromSummary(finalSummary, structured, patient.exam_id);
              if (result && result.keywords && Array.isArray(result.keywords)) {
                setSummaryKeywords(result.keywords);
              } else {
                setSummaryKeywords([]);
              }
            } catch (kwErr) {
              console.error('❌ Failed to extract keywords (WS):', kwErr);
              setKeywordErr(`Failed to extract keywords: ${kwErr.message || 'Unknown error'}`);
              setSummaryKeywords([]);
            } finally {
              setIsExtractingKeywords(false);
            }
          })();
        } else if (summaryKeywords.length > 0) {
          console.log('ℹ️ Keywords already extracted, skipping...');
        }
      }
      
      // Mark the last streaming message as complete
      setMessages(prev => {
        if (prev.length > 0) {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.isStreaming) {
            return prev.map((msg, index) => 
              index === prev.length - 1 
                ? { ...msg, isStreaming: false }
                : msg
            );
          }
        }
        return prev;
      });
    });


    
    // Handle session info
    newSocket.on('session_info', (data) => {
      console.log('📍 Session info:', data);
      // Store session info if needed
    });
    
    // Handle file upload confirmation
    newSocket.on('file_uploaded', (data) => {
      console.log('📁 File uploaded:', data);
      // Update file list if needed
    });

    // Handle stream errors
    newSocket.on('stream_error', (data) => {
      console.error('❌ Stream error:', data);
      setIsTyping(false);
      
      // Update status based on error type
      if (data.type === 'summary') {
        setAnalysisStatus('Analysis failed');
        setIsGeneratingSummary(false);
        setError(`Summary generation failed: ${data.message}`);
      }
      
      // Add error message to chat if it's a chat error
      if (data.type === 'chat') {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          role: 'system',
          content: `Error: ${data.message}`,
          timestamp: new Date().toISOString()
        }]);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Close detail panel
  const closeDetailPanel = () => {
    setShowDetailPanelDebounced(false);
    setSelectedKeyword(null);
    setKeywordFilteredVideos([]);
  };

  // Update patient data from detail panel with summary regeneration
  const updatePatientDataFromDetailWithSummary = async (updatedStructuredData) => {
    try {
      // Store original data for backup
      const originalData = {
        structuredData: structuredData,
        summary: summary,
        patientData: patientData
      };
      
      // Update structured data
      setStructuredData(updatedStructuredData);
      
      // Convert structured data back to patient data format
      const flattenedData = {};
      Object.entries(updatedStructuredData).forEach(([category, value]) => {
        if (typeof value === 'object' && value !== null) {
          // Nested object
          Object.entries(value).forEach(([field, fieldValue]) => {
            flattenedData[field] = fieldValue;
          });
        } else {
          // Direct value
          flattenedData[category] = value;
        }
      });
      
      setPatientData(prev => ({
        ...prev,
        ...flattenedData
      }));
      
      // Generate new summary based on updated structuredData
      setIsGeneratingSummary(true);
      setError(null);
      
      try {
        console.log('📝 Generating new summary from updated structuredData...');
        const newSummary = await generateSummaryFromStructuredData(updatedStructuredData);
        
        if (newSummary) {
          setSummary(newSummary);
          
          // Re-extract keywords for the new summary (only if not already extracted)
          if (summaryKeywords.length === 0) {
            console.log('🔑 Re-extracting keywords for new summary...');
            await handleKeywordExtraction(newSummary);
          } else {
            console.log('ℹ️ Keywords already extracted, skipping...');
          }
          
          console.log('✅ Summary regenerated successfully');
        } else {
          console.warn('⚠️ Failed to generate summary');
          setError('Failed to generate summary from updated data');
        }
      } catch (summaryError) {
        console.error('❌ Error generating summary:', summaryError);
        setError('Failed to generate summary. Changes were saved but summary was not updated.');
        
        // Restore original summary if generation failed
        setSummary(originalData.summary);
      }
      
    } catch (error) {
      console.error('❌ Error updating patient data:', error);
      setError('Failed to update patient data');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Update patient data from detail panel
  const updatePatientDataFromDetail = (updatedStructuredData) => {
    // Update structured data
    setStructuredData(updatedStructuredData);
    
    // Convert structured data back to patient data format
    // This is a simplified conversion - you may need to adjust based on your exact data format
    const flattenedData = {};
    Object.entries(updatedStructuredData).forEach(([category, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Nested object
        Object.entries(value).forEach(([field, fieldValue]) => {
          flattenedData[field] = fieldValue;
        });
      } else {
        // Direct value
        flattenedData[category] = value;
      }
    });
    
    setPatientData(prev => ({
      ...prev,
      ...flattenedData
    }));
    
    // Only regenerate summary if not already generating and no summary exists
    if (!isGeneratingSummary && !summary) {
      handleGenerateSummary();
    } else if (summary) {
      // If summary already exists, just update it without re-extracting keywords
      console.log('📝 Updating existing summary with new data...');
      console.log('🔍 patientData:', patientData);
      console.log('🔍 flattenedData:', flattenedData);
      generateSummary({ ...patientData, ...flattenedData }).then(newSummary => {
        setSummary(newSummary);
        console.log('✅ Summary updated successfully');
      }).catch(err => {
        console.error('❌ Failed to update summary:', err);
      });
    }
  };


  // Generate videos based on keyword categories and view_attention
  const generateCategoryBasedVideos = async (keywords, examEntryData) => {
    
    if (!examEntryData || !examEntryData.view_attention) {
      console.warn('⚠️ generateCategoryBasedVideos: Missing required data');
      console.warn('  - examEntryData:', !!examEntryData);
      console.warn('  - view_attention:', !!examEntryData?.view_attention);
      return { general: [], keyword: [] };
    }

    const viewAttention = examEntryData.view_attention;
    
    // Extract categories from keywords (handle empty keywords array)
    const keywordCategories = keywords && keywords.length > 0 
      ? [...new Set(keywords.map(kw => kw.category))]
      : [];
    
    // Collect all videos from view_attention categories
    const allVideos = [];
    
    // Process view_attention data which has structure like:
    // "atria": [{"view_idx": 13, "view_lbl": "A3C zoomed LV", "weight": 0.016, "fname": "..."}, ...]
    Object.entries(viewAttention).forEach(([category, views]) => {
      if (Array.isArray(views)) {
        views.forEach(viewData => {
          if (viewData && typeof viewData === 'object' && viewData.weight > 0) {
            allVideos.push({
              category: category,
              viewIdx: viewData.view_idx,
              viewLabel: viewData.view_lbl,
              weight: viewData.weight,
              fname: viewData.fname,
              isRelevant: keywordCategories.includes(category)
            });
          }
        });
      }
    });;

    // Sort by weight (highest first)
    allVideos.sort((a, b) => b.weight - a.weight);

    // Generate video URLs with proper error handling
    const generateVideoUrls = async (videoList) => {
      const videos = [];
      const publicPath = '/mnt/c/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/public';

      for (const video of videoList) {
        try {
          let videoUrl;
          let videoPath = video.fname;
          if (videoPath && videoPath.endsWith('.npz')) {
            videoPath = videoPath.replace('.npz', '.mp4');
          }
        
          // Use the converted MP4 path directly
          if (videoPath && videoPath.endsWith('.mp4')) {
            
            videoUrl = videoPath.replace(publicPath, '');;
          } else {
            // Fallback to demo video
            videoUrl = '/videos/26409027(1).dcm.mp4';
            console.log('⚠️ Using fallback demo video');
          }
          
          videos.push({
            category: video.category,
            viewIdx: video.viewIdx,
            viewLabel: video.viewLabel,
            weight: video.weight,
            url: videoUrl,
            fname: video.fname,
            name: video.viewLabel,
            confidence: `${(video.weight * 100).toFixed(1)}%`,
            isDemo: videoUrl === '/videos/26409027(1).dcm.mp4',
            isRelevant: video.isRelevant
          });
        } catch (err) {
          console.error('Failed to process video:', video, err);
          // Still add the video with file path info
          videos.push({
            category: video.category,
            viewIdx: video.viewIdx,
            viewLabel: video.viewLabel,
            weight: video.weight,
            url: null,
            fname: video.fname,
            name: video.viewLabel,
            confidence: `${(video.weight * 100).toFixed(1)}%`,
            isDemo: false,
            isRelevant: video.isRelevant,
            error: true
          });
        }
      }
      return videos;
    };

    // Generate all video URLs
    const allGeneratedVideos = await generateVideoUrls(allVideos);
    
    // Remove duplicates based on fname (file name)
    const uniqueVideos = [];
    const seenFnames = new Set();
    
    allGeneratedVideos.forEach(video => {
      if (!seenFnames.has(video.fname)) {
        seenFnames.add(video.fname);
        uniqueVideos.push(video);
      }
    });
    
    // Store unique videos and extract categories
    setAllVideosData(uniqueVideos);
    
    // Extract categories and handle general subcategories
    const categories = [...new Set(uniqueVideos.map(v => v.category))];
    const processedCategories = categories.map(cat => {
      // Map general subcategories to 'general'
      if (['image_quality', 'cardiac_rhythm_abnormality', 'cardiac_rhythm'].includes(cat)) {
        return 'general';
      }
      return cat;
    });
    
    // Remove duplicates and set available categories
    const uniqueCategories = [...new Set(processedCategories)];
    setAvailableCategories(uniqueCategories);
    
    // Get top 10 videos overall and top 10 keyword-relevant videos
    const generalVideos = uniqueVideos.slice(0, 10);
    const keywordSpecificVideos = uniqueVideos
      .filter(v => v.isRelevant)
      .slice(0, 10);

    return {
      general: generalVideos,
      keyword: keywordSpecificVideos
    };
  };

  // Get filtered videos based on selected category
  const getFilteredVideos = () => {
    if (!allVideosData || allVideosData.length === 0) {
      return videoSegments; // Fallback to default segments
    }
    
    let filtered = allVideosData;
    
    // Filter by category if not "all"
    if (selectedVideoCategory !== 'all') {
      // Special handling for 'general' category
      if (selectedVideoCategory === 'general') {
        // For general category, include videos from image_quality, cardiac_rhythm_abnormality, and cardiac_rhythm
        const generalSubCategories = ['image_quality', 'cardiac_rhythm_abnormality', 'cardiac_rhythm'];
        filtered = allVideosData.filter(v => generalSubCategories.includes(v.category));
      } else {
        filtered = allVideosData.filter(v => v.category === selectedVideoCategory);
      }
    }
    
    // Sort by weight (highest first)
    filtered.sort((a, b) => b.weight - a.weight);
    
    // Remove duplicates based on fname (file name)
    const uniqueVideos = [];
    const seenFnames = new Set();
    
    console.log('🔍 Video-panel filtering for category:', selectedVideoCategory);
    console.log('📊 Total videos before deduplication:', filtered.length);
    
    // Take more videos initially to ensure we get 6 unique ones
    const initialCount = Math.min(filtered.length, 50);
    
    for (let i = 0; i < initialCount; i++) {
      const video = filtered[i];
      if (!seenFnames.has(video.fname)) {
        seenFnames.add(video.fname);
        uniqueVideos.push(video);
        console.log(`✅ Added unique video ${i + 1}: ${video.fname} (${video.category})`);
        
        // Stop when we have 6 unique videos
        if (uniqueVideos.length >= 6) {
          console.log('🎯 Found 6 unique videos, stopping search');
          break;
        }
      } else {
        console.log(`⚠️ Skipped duplicate video: ${video.fname} (${video.category})`);
      }
    }
    
    console.log('📊 Final unique videos found:', uniqueVideos.length);
    
    // If we don't have enough videos from the specific categories, add videos from other categories
    if (uniqueVideos.length < 6) {
      console.log('⚠️ Not enough videos from specific categories, adding from other categories...');
      
      // Get videos from other categories
      const otherVideos = allVideosData.filter(video => {
        if (selectedVideoCategory === 'all') return false;
        if (selectedVideoCategory === 'general') {
          const generalSubCategories = ['image_quality', 'cardiac_rhythm_abnormality', 'cardiac_rhythm'];
          return !generalSubCategories.includes(video.category);
        }
        return video.category !== selectedVideoCategory;
      }).sort((a, b) => b.weight - a.weight);
      
      // Add unique videos from other categories
      for (let i = 0; i < otherVideos.length && uniqueVideos.length < 6; i++) {
        const video = otherVideos[i];
        if (!seenFnames.has(video.fname)) {
          seenFnames.add(video.fname);
          uniqueVideos.push(video);
          console.log(`✅ Added video from other category: ${video.fname} (${video.category})`);
        }
      }
      
      console.log('📊 Final videos after adding from other categories:', uniqueVideos.length);
    }
    
        // Return exactly 6 videos (or fewer if not enough available)
    return uniqueVideos.slice(0, 6);
  };


  // Stabilized helper function to highlight terms with keywords
  const highlightTerms = useCallback((text, keywords, sentenceNumber = null) => {
    if (!text || !keywords || keywords.length === 0) return text;

    // Normalize helper to make matching robust to spaces, NBSP, hyphens, quotes, case
    const normalize = (str) => {
      if (!str) return '';
      return str
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ') // NBSP -> space
        .replace(/[\u2010-\u2015]/g, '-') // various hyphens -> '-'
        .replace(/[""„‟]/g, '"') // fancy double quotes -> "
        .replace(/[''‚‛]/g, "'") // fancy single quotes -> '
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim()
        .toLowerCase();
    };

    // Sort keywords by length (longest first) to avoid partial replacements
    const sortedKeywords = [...keywords].sort((a, b) => 
      (b.term?.length || 0) - (a.term?.length || 0)
    );

    // Build a map of terms to replace including aliases with unique IDs
    const termsToHighlight = [];
    
    sortedKeywords.forEach((kw, kwIndex) => {
      // Use term field, fallback to text field if term is empty
      const keywordText = kw.term || kw.text || '';
      const kwSentence = kw.sentence_number || sentenceNumber || 1;
      
      if (keywordText) {
        const normalizedTerm = normalize(keywordText);
        const uniqueId = `${kwSentence}::${normalizedTerm}`;
        termsToHighlight.push({
          term: keywordText,
          normalizedTerm,
          category: kw.category,
          importance: kw.importance,
          keywordIndex: kwIndex,
          originalKeyword: kw,
          uniqueId
        });
        // Debug: Only log if sentence_number is missing or unusual
        if (!kw.sentence_number) {
          console.warn('⚠️ Missing sentence_number for keyword:', kw);
        }
      }
      if (kw.aliases && Array.isArray(kw.aliases)) {
        kw.aliases.forEach(alias => {
          const normalizedAlias = normalize(alias);
          const uniqueId = `${kwSentence}::${normalizedAlias}`;
          termsToHighlight.push({
            term: alias,
            normalizedTerm: normalizedAlias,
            category: kw.category,
            importance: kw.importance,
            keywordIndex: kwIndex,
            originalKeyword: kw,
            uniqueId
          });
        });
      }
    });

    // Debug: snapshot of terms to highlight (disabled by default for performance)
    // Uncomment for debugging keyword matching issues
    // try {
    //   console.log('termsToHighlight:', termsToHighlight.map(t => ({ term: t.term, idx: t.keywordIndex, id: t.uniqueId })));
    // } catch (_) {}

    // Escape regex special characters
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create regex pattern for all terms with flexible matching for spaces/NBSP and hyphens
    const patterns = termsToHighlight.map(t => {
      const escaped = escapeRegex(t.term);
      // Make spaces flexible (space or NBSP, one or more)
      const flexibleSpaces = escaped.replace(/\\\s+/g, '[\\s\\u00A0]+').replace(/\s+/g, '[\\s\\u00A0]+');
      // Make hyphens flexible (ASCII hyphen or Unicode hyphen range)
      const flexibleHyphens = flexibleSpaces.replace(/\\\-/g, '[-\u2010-\u2015]');
      return flexibleHyphens;
    });
    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');

    // Split text and process
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      // Find matching keyword info using normalized comparison
      const normalizedPart = normalize(part);
      const match = termsToHighlight.find(t => t.normalizedTerm === normalizedPart);
      
      if (match) {
        // Use the original keyword object
        const fullKeyword = match.originalKeyword;
        
        // Get importance score (default to 3 if not available)
        const importanceScore = fullKeyword?.importanceScore || 3;
        
        const hasFeature = fullKeyword && fullKeyword.key_feature && fullKeyword.key_feature.length > 0;
        
        // Check if this specific keyword instance is selected
        const isSelected = selectedKeyword === match.uniqueId;
        
        return (
          <span
            key={`${match.uniqueId}_${index}`}
            className={`kw kw-importance-${importanceScore} underline-keyword clickable-keyword ${hasFeature ? 'has-feature' : ''} ${isSelected ? 'keyword-selected' : ''}`}
            onClick={(e) => handleKeywordClick(match.uniqueId, e)}
            style={{ cursor: 'pointer' }}
            // onMouseEnter={(e) => showTooltipFor(fullKeyword || match, e)}
            // onMouseLeave={hideTooltip}
          >
            {part}
          </span>
        );
      }
      
      return part;
    });
  }, [selectedKeyword, handleKeywordClick]);

  // Stabilized function to make text clickable and highlight keywords
  const makeTextClickable = useCallback((text, sentenceNumber = null) => {
    // In edit mode, don't show highlights
    if (isSummaryEditMode) {
      return <span>{text}</span>;
    }

    // Only show clickable keywords if we have extracted AI keywords
    if (mergedKeywords.length > 0) {
      return highlightTerms(text, mergedKeywords, sentenceNumber);
    }
    
    // If no AI keywords extracted, return plain text
    return <span>{text}</span>;
  }, [isSummaryEditMode, mergedKeywords, highlightTerms]);
  
  // Parse summary and make keywords clickable
  const renderClickableSummary = (summaryText) => {
    if (!summaryText) return null;

    // Parse summary into blocks
    const lines = summaryText.split('\n').filter(line => line.trim());
    const blocks = [];
    let currentBlock = null;

    // Block titles mapping
    const blockTitles = {
      '1.': 'LV Size & Geometry',
      '2.': 'LV Function',
      '3.': 'Valve Function',
      '4.': 'RV Function',
      '5.': 'Atria',
      '6.': 'Extracardiac Findings'
    };

    lines.forEach(line => {
      // Check if this line starts a new numbered section
      const match = line.match(/^(\d+)\.\s+(.+?):\s*(.*)$/);
      if (match) {
        const [, number, title, content] = match;
        const blockTitle = blockTitles[`${number}.`] || title;
        
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        
        currentBlock = {
          title: blockTitle,
          content: content ? [content] : []
        };
      } else if (currentBlock && line.trim()) {
        // Add content to current block
        currentBlock.content.push(line.trim());
      } else if (!currentBlock && line.trim()) {
        // Handle Summary: header or other non-numbered content
        if (!line.toLowerCase().includes('summary:')) {
          if (!currentBlock) {
            currentBlock = {
              title: 'Summary',
              content: []
            };
          }
          currentBlock.content.push(line.trim());
        }
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // In edit mode, show textarea
    if (isSummaryEditMode) {
      return (
        <textarea
          className="summary-edit-textarea"
          value={editedSummary}
          onChange={(e) => setEditedSummary(e.target.value)}
          placeholder="Enter summary content..."
        />
      );
    }

    // Render as simple numbered list with memoized lines
    return (
      <div>
        {lines.filter(line => line.trim()).map((line, index) => {
          // Extract sentence number from line if it starts with a number
          const sentenceMatch = line.match(/^(\d+)\./); 
          const sentenceNumber = sentenceMatch ? parseInt(sentenceMatch[1]) : index + 1;

          
          return (
            <SummaryLine 
              key={index} 
              line={line.trim()} 
              sentenceNumber={sentenceNumber}
              makeTextClickable={makeTextClickable}
            />
          );
        })}
      </div>
    );
  };

  // Load video segments and generate summary on mount
  useEffect(() => {
    
    // Add ResizeObserver error tracking
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('ResizeObserver')) {
        console.log('🚨 ResizeObserver error detected in PatientAssessment:', args);
        console.log('🚨 Current component state:', {
          showDetailPanel,
          isTransitioningRef: isTransitioningRef.current,
          panelTransitionTimeoutRef: panelTransitionTimeoutRef.current,
          scrollTimeoutRef: scrollTimeoutRef.current
        });
      }
      originalError.apply(console, args);
    };
    
    loadVideoSegments();
    
    // Load exam entry first, then generate summary
    const loadExamEntryAndGenerateSummary = async () => {
      try {
        console.log('🔍 Loading exam entry for exam_id:', patient.exam_id);
        const entry = await getExamEntryById(patient.exam_id);
        console.log('🔍 getExamEntryById result:', entry);
        
        if (entry) {
          setExamEntry(entry);
        } else {
          console.warn('⚠️ No exam entry found for exam_id:', patient.exam_id);
        }
      } catch (err) {
        console.error('❌ Failed to load exam entry:', err);
      }
      
          // Generate summary after exam entry is loaded (or attempted)
      handleGenerateSummary();
    };
    
    loadExamEntryAndGenerateSummary();
    
    return () => {
      // Restore original console.error
      console.error = originalError;
      
      // Cleanup video URLs
      videoSegments.forEach(segment => {
        if (segment.url) {
          cleanupVideoUrl(segment.url);
        }
      });
      
      // Cleanup any pending panel transitions
      if (panelTransitionTimeoutRef.current) {
        clearTimeout(panelTransitionTimeoutRef.current);
      }
      
      // Cleanup any pending scroll operations
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // Regenerate videos when examEntry becomes available
  useEffect(() => {
    if (examEntry && summaryKeywords.length > 0 && relatedVideos.length === 0 && !hasGeneratedVideosRef.current) {
      hasGeneratedVideosRef.current = true;
      generateCategoryBasedVideos(summaryKeywords, examEntry).then(videos => {
        setRelatedVideos(videos.general);
        setKeywordVideos(videos.keyword);
      }).catch(err => {
        console.error('❌ Failed to regenerate videos:', err);
        hasGeneratedVideosRef.current = false; // Reset on error
      });
    }
    
    // Also generate videos for left panel if not using keywords
    if (examEntry && examEntry.view_attention && allVideosData.length === 0 && !hasGeneratedLeftPanelVideosRef.current) {
      hasGeneratedLeftPanelVideosRef.current = true;
      generateCategoryBasedVideos([], examEntry).catch(err => {
        console.error('❌ Failed to generate left panel videos:', err);
        hasGeneratedLeftPanelVideosRef.current = false; // Reset on error
      });
    }
  }, [examEntry, summaryKeywords]);

  // Monitor showDetailPanel state changes
  useEffect(() => {
    
    // Log DOM dimensions to track layout changes
    const mainContainer = document.querySelector('.main-container');
    const editPanel = document.querySelector('.edit-panel');
    
    if (mainContainer) {
      const rect = mainContainer.getBoundingClientRect();

    }
    
    if (editPanel) {
      const rect = editPanel.getBoundingClientRect();
      console.log('🔄 edit-panel dimensions:', {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
      });
    }
  }, [showDetailPanel]);

  // Prefill structuredData whenever patientData changes
  useEffect(() => {
    const built = buildStructuredFromPatientData(patientData);
    if (built) setStructuredData(built);
  }, [patientData]);

  return (
    <div className="patient-assessment">


      {/* Top Header */}
      <div className="top-header">
        <div className="header-content">
          <div className="app-icon">
            <img src="/logo/logo.PNG" alt="Sonix Health Logo" className="logo-image" />
          </div>
          <span className="app-name">Sonix Health</span>
        </div>
      </div>

      {/* Left Side Panel */}
      <div className="side-panel">
        <div className="side-panel-content">
          {/* Expand/Collapse Button */}
          <div className="side-panel-toggle">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="#FFFFFF" strokeWidth="2" fill="none"/>
            </svg>
          </div>

          {/* User/Team Button */}
          <div className="side-panel-item" title="Team Management">
            <div className="side-panel-icon user-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" stroke="#FFFFFF" strokeWidth="1.5"/>
                <path d="M0 16C0 12.6863 3.58172 10 8 10C12.4183 10 16 12.6863 16 16" stroke="#FFFFFF" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="side-panel-tooltip">Team Management</span>
          </div>

          {/* Divider */}
          <div className="side-panel-divider"></div>

          {/* AI Assistant */}
          <div className="side-panel-item" title="AI Assistant">
            <div className="side-panel-icon ai-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="#FFFFFF" strokeWidth="1.5"/>
                <text x="10" y="12" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">AI</text>
              </svg>
            </div>
            <span className="side-panel-tooltip">AI Assistant</span>
          </div>

          {/* A/B Testing */}
          <div className="side-panel-item" title="A/B Testing">
            <div className="side-panel-icon ab-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 3H8V17H3V3Z" stroke="#FFFFFF" strokeWidth="1.5"/>
                <path d="M12 3H17V17H12V3Z" stroke="#FFFFFF" strokeWidth="1.5"/>
                <text x="5.5" y="12" fill="#FFFFFF" fontSize="8" fontWeight="bold">A</text>
                <text x="14.5" y="12" fill="#FFFFFF" fontSize="8" fontWeight="bold">B</text>
              </svg>
            </div>
            <span className="side-panel-tooltip">A/B Testing</span>
          </div>

          {/* Gallery/Images */}
          <div className="side-panel-item" title="Gallery">
            <div className="side-panel-icon gallery-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="#FFFFFF" strokeWidth="1.5"/>
                <circle cx="7" cy="7" r="2" stroke="#FFFFFF" strokeWidth="1.5"/>
                <path d="M2 14L6 10L10 14L18 6" stroke="#FFFFFF" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="side-panel-tooltip">Gallery</span>
          </div>
        </div>
      </div>

      {/* Patient Information Panel */}
      <div className="patient-info-container">
        <div className="patient-info-row">
          <div className="patient-info-card">
            <div className="patient-info-item">
              <span className="info-label">Patient ID:</span>
              <span className="info-value">{patientInfo.id || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Name:</span>
              <span className="info-value-bold">{patient.name || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Sex:</span>
              <span className="info-value">{patient.gender || patient.sex || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Age:</span>
              <span className="info-value">{patient.age || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Height:</span>
              <span className="info-value">{patient.height || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Weight:</span>
              <span className="info-value">{patient.weight || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">HR:</span>
              <span className="info-value">{patient.hr || patient.heart_rate || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">BSA:</span>
              <span className="info-value">{patient.bsa || 'N/A'}</span>
            </div>
          </div>

          {/* Right side controls container */}
          <div className="right-controls-container">
            {/* Image Quality Dropdown */}
            <div className="dropdown-card">
              <span className="dropdown-label">Image Quality</span>
              <div className="dropdown-content">
                <span className="dropdown-value">Non-Diagnostic</span>
                <div className="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="#FFFFFF" strokeWidth="2" fill="none"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Cardiac Rhythm Dropdown */}
            <div className="dropdown-card">
              <span className="dropdown-label">Cardiac Rhythm</span>
              <div className="dropdown-content">
                <span className="dropdown-value">Ventricular Premature Beat</span>
                <div className="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="#FFFFFF" strokeWidth="2" fill="none"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* End Exam Button */}
            <div className="end-exam-button" onClick={onBack}>
              <span>End Exam</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className={`main-container ${showDetailPanel ? 'editing' : ''} ${isChatActive ? 'chat-active' : ''}`}>
        {/* VIDEO PANEL - Video Segments */}
        <div className="video-panel">
          <div className="panel-header">
            <div className="panel-title">
              <div className="ai-icon">
                <img src="/logo/plus.PNG" alt="Plus Logo" className="ai-logo" />
              </div>
              <span>EchoPilot Curated Views</span>
            </div>
          </div>
          
          {/* Category Dropdown */}
          {/* {allVideosData.length > 0 && (
            <div className="category-selector">
              <label className="category-label">Filter by Category:</label>
              <select 
                className="category-dropdown"
                value={selectedVideoCategory}
                onChange={(e) => setSelectedVideoCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )} */}
          
          {isLoadingVideos ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading video segments...</p>
            </div>
          ) : (
            <div className="videos-grid">
              {getFilteredVideos().map((video, index) => (
                <div key={index} className="video-card" onClick={() => setExpandedVideo(video)}>
                  <div className="video-container">
                    {video.url ? (
                      <video
                        className="segment-video"
                        src={video.url}
                        autoPlay
                        loop
                        muted
                        controls
                      />
                    ) : (
                      <div className="video-error-placeholder">
                        <div className="error-icon">⚠️</div>
                        <div className="error-text">Video unavailable</div>
                      </div>
                    )}
                  </div>
                  <div className="video-label">
                    <span className="view-name">{video.name || video.viewLabel || 'Unknown View'}</span>
                    <span className="view-weight">• {(video.weight * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SUMMARY PANEL - Editable Summary */}
        <div className={`summary-panel ${isChatActive ? 'chat-active' : ''}`}>
          {/* AI Summary Section */}
          <div 
            className={`summary-section ${isSummaryEditMode ? 'edit-mode' : ''} ${!summary ? 'empty-summary' : ''}`}
            style={isChatActive ? { height: `${summaryHeight}px` } : {}}
          >
            {isChatActive && (
              <div 
                className="resize-handle"
                onMouseDown={handleResizeStart}
              />
            )}
            <div className="panel-header">
              <div className="panel-title">
                <div className="ai-icon">
                  <img src="/logo/plus.PNG" alt="Plus Logo" className="ai-logo" />
                </div>
                <span>Clinical Summary Report</span>
                {isExtractingKeywords && (
                  <div className="keyword-extracting-indicator">
                    <div className="keyword-spinner"></div>
                    <span>Extracting keywords...</span>
                  </div>
                )}
              </div>
              {summary && (
                <button 
                  className="summary-edit-btn"
                  onClick={handleSummaryEdit}
                  title="Edit summary"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5L14.5 4.5L5.5 13.5H2.5V10.5L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.5 4.5L11.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
            
            <div className="summary-content">
              {/* Display streaming summary in real-time */}
              {streamingSummary ? (
                renderClickableSummary(streamingSummary)
              ) : summary ? (
                renderClickableSummary(summary)
              ) : (
                <div className="empty-summary-content">
                  <div className="empty-summary-icon">📋</div>
                  <div className="empty-summary-text">
                    {isGeneratingSummary ? (
                      <div className="generating-summary">
                        <div className="loading-spinner"></div>
                        <span>Generating AI summary...</span>
                      </div>
                    ) : (
                      <div className="no-summary">
                        <span>Loading summary...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Summary Action Buttons - Only show in edit mode */}
            {isSummaryEditMode && (
              <div className="summary-actions">
                <button 
                  className="summary-action-btn apply-btn"
                  title="Apply changes and update data"
                  onClick={handleSummaryApply}
                  disabled={isUpdatingStructuredData}
                >
                  {isUpdatingStructuredData ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M13 3L6 10L3 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Apply</span>
                    </>
                  )}
                </button>
                <button 
                  className="summary-action-btn cancel-btn"
                  title="Cancel editing"
                  onClick={handleSummaryCancel}
                  disabled={isUpdatingStructuredData}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Cancel</span>
                </button>
                <button 
                  className="summary-action-btn reset-btn"
                  title="Reset to original data"
                  onClick={handleSummaryReset}
                  disabled={isUpdatingStructuredData}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 2V8H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 14V8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Reset</span>
                </button>
              </div>
            )}
            
            {/* Resize Handle */}
            {isChatActive && (
              <div 
                className="resize-handle"
                onMouseDown={handleResizeStart}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '8px',
                  cursor: 'ns-resize',
                  background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  zIndex: 10
                }}
              />
            )}
          </div>

          {/* AI Chatbot Section */}
          <div className="chatbot-section"
               aria-expanded={isChatActive}
               aria-hidden={!isChatActive && showDetailPanel}
               aria-live="polite">
            {isChatActive && (
              <div className="chat-messages-area">
                <div className="chat-header">
                  <div className="chat-title">
                    <span>EchoVerse AI Assistant</span>
                    <div className="chat-status">
                      <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                  <button 
                    className="chat-close-btn"
                    onClick={() => {
                      console.log('💬 Chat close button clicked - switching to edit mode');
                      performChatTransition(false);
                      setIsChatActive(false);
              
                      
                      // Clear input and remove focus
                      if (chatInputRef.current) {
                        chatInputRef.current.value = '';
                        chatInputRef.current.blur();
                      }
                      
                      // Reset focus references to prevent auto-focus
                      previousFocusRef.current = null;
                      
                      // Move focus to neutral position
                      document.body.focus();
                    }}
                    aria-label="Close chat and switch to edit mode"
                    title="Close chat and switch to edit mode"
                  >
                    ✕
                  </button>
                </div>
                <div className="chat-messages" ref={chatMessagesRef}>
                  {messages.length === 0 ? (
                    <div className="chat-welcome-message">
                      <div className="ai-message">
                        <div className="ai-avatar">
                          <img src="/logo/plus.PNG" alt="AI" className="ai-logo" />
                        </div>
                        <div className="message-content">
                          안녕하세요! 심초음파 검사 결과를 분석하는 데 도움을 드리겠습니다. 환자의 심장 상태에 대해 무엇이든 물어보세요.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-history">
                      {messages.map((message) => (
                        <div key={message.id} className={`message-item ${message.role}-message`}>
                          <div className="message-avatar">
                            {message.role === 'user' ? (
                              <div className="user-avatar">U</div>
                            ) : (
                              <img src="/logo/plus.PNG" alt="AI" className="ai-logo" />
                            )}
                          </div>
                          <div className="message-content">
                            <div className="message-text" 
                                 dangerouslySetInnerHTML={{ 
                                   __html: message.content
                                     .replace(/\n/g, '<br>')
                                     .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                     .replace(/•/g, '&bull;')
                                     .replace(/⚠️/g, '<span class="warning">⚠️</span>')
                                 }}
                            />
                            <div className="message-timestamp">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="message-item assistant-message typing">
                          <div className="message-avatar">
                            <img src="/logo/plus.PNG" alt="AI" className="ai-logo" />
                          </div>
                          <div className="message-content">
                            <div className="typing-indicator">
                              <span></span><span></span><span></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <form className="chatbot-input" onSubmit={handleChatSubmit}>
              <input 
                ref={chatInputRef}
                type="text" 
                placeholder={isChatActive ? "Type your question..." : "Click to start chat..."}
                className="chatbot-input-field"
                onKeyDown={handleKeyDown}
                onClick={handleInputClick}
                autoComplete="off"
                aria-label="Click to activate chat mode"
                tabIndex="0"
              />
              <button 
                type="button" 
                className="send-button" 
                aria-label="Send message"
                onClick={() => {
                  if (chatInputRef.current) {
                    const inputValue = chatInputRef.current.value.trim();
                    
                    if (inputValue && isChatActive) {
                      // Send message immediately if chat is already active
                      handleChatSubmit();
                    }
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                </svg>
              </button>
            </form>
          </div>
        </div>



        {/* EDIT PANEL - Slides in from right */}
        <div className={`edit-panel ${showDetailPanel ? 'active' : ''}`}>
          <div className="edit-header">
            <button 
              className="back-button"
              onClick={closeDetailPanel}
              title="Back to normal view"
            >
              ← Back
            </button>
            <h2>EchoPilot Analysis</h2>
          </div>
          
          {/* Category Info Section */}
          {keywordFilteredVideos.length > 0 && (
            <div className="edit-category-info">
              <div className="category-info-content">
                <span className="category-label">Selected Categories:</span>
                <div className="category-tags">
                  {[...new Set(keywordFilteredVideos.map(video => video.category))].map((category, index) => (
                    <span key={index} className="category-tag">
                      {category
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                        .replace(/\b(tv|mv|av|pv|ivc|la|ra|lv|rv|lvot|rvot|asd|pfo|vsd|pda|sam|ero|pisa|vti|pht|dt|ivrt|gls|rwt|tapse|fac)\b/gi, (match) => match.toUpperCase())
                      }
                    </span>
                  ))}
                </div>
                <span className="video-count">
                  {keywordFilteredVideos.length} videos selected
                </span>
              </div>
            </div>
          )}
          
          {/* Video Grid Section */}
          <div className="edit-video-section">
            <div className="edit-video-grid">
              {(keywordFilteredVideos.length > 0 ? keywordFilteredVideos : videoSegments.slice(0, 5)).map((video, index) => (
                <div key={index} className={`edit-video-item ${keywordFilteredVideos.length > 0 ? 'keyword-selected' : ''}`}>
                  {video.url ? (
                    <video
                      className="edit-video"
                      src={video.url}
                      autoPlay
                      loop
                      muted
                      controls
                    />
                  ) : (
                    <div className="video-placeholder">
                      <div className="placeholder-icon">🎬</div>
                      <div className="placeholder-text">Video unavailable</div>
                    </div>
                  )}
                  <div className="edit-video-label">
                    {video.name || video.viewLabel || 'Unknown View'}
                    {video.weight && (
                      <span className="video-weight"> ({(video.weight * 100).toFixed(1)}%)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="edit-body-full">
                          {structuredData && (
                <DetailEditor 
                  structuredData={structuredData}
                  patientData={patientData}
                  onUpdate={updatePatientDataFromDetail}
                  onApplyWithSummary={updatePatientDataFromDetailWithSummary}
                  onClose={closeDetailPanel}
                  selectedBlockType={selectedBlockType}
                  videoSegments={videoSegments}
                  summaryKeywords={summaryKeywords}
                  highlightedFeature={highlightedFeature}
                  selectedKeyword={selectedKeyword}
                  resolveKeyword={resolveKeyword}
                  mapFeatureToField={mapFeatureToField}
                />
              )}
          </div>
        </div>
      </div>
      
      {/* Tooltip Component - TEMPORARILY DISABLED */}
      {/* {tooltipData && (
        <div 
          ref={tooltipRef}
          className="keyword-tooltip"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y
          }}
        >
          <div className="tooltip-header">
            <span className="tooltip-keyword">
              {tooltipData.keyword.term || tooltipData.keyword.text}
            </span>
          </div>
          
          <div className="tooltip-section">
            <div className="tooltip-info-line">
              <strong>Category:</strong> {tooltipData.keyword.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div className="tooltip-info-line">
              <strong>Importance:</strong> {tooltipData.keyword.importanceScore || 3}/5
            </div>
          </div>
          
          <div className="tooltip-section">
            <div className="tooltip-section-title">Clinical Significance:</div>
            <div className="tooltip-explanation">
              {tooltipData.clinicalExplanation}
            </div>
          </div>
          
          {tooltipData.supportingData.length > 0 && (
            <div className="tooltip-section">
              <div className="tooltip-section-title">Supporting Patient Data:</div>
              <div className="tooltip-data-list">
                {tooltipData.supportingData.map((data, idx) => (
                  <div key={idx} className="tooltip-data-item">
                    <div className="data-field">{data.field}:</div>
                    <div className="data-value">{data.value}</div>
                    <div className="data-influence">{data.influence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )} */}

      {/* Video Expansion Modal */}
      {expandedVideo && (
        <div className="video-expansion-modal" onClick={() => setExpandedVideo(null)}>
          <div className="expanded-video-container" onClick={(e) => e.stopPropagation()}>
            <div className="expanded-video-header">
              <div className="expanded-video-info">
                <h2 className="expanded-video-name">
                  {expandedVideo.name || expandedVideo.viewLabel}
                </h2>
                <div className="expanded-video-meta">
                  <span className="expanded-confidence">
                    AI Confidence: {expandedVideo.confidence || `${(expandedVideo.weight * 100).toFixed(1)}%`}
                  </span>
                  {expandedVideo.category && (
                    <span className="expanded-confidence">
                      Category: {expandedVideo.category}
                    </span>
                  )}
                  {expandedVideo.isDemo && (
                    <span className="expanded-confidence">Demo Video</span>
                  )}
                </div>
              </div>
              <button className="close-expansion-btn" onClick={() => setExpandedVideo(null)}>
                <span>✕</span> Close
              </button>
            </div>
            
            <div className="expanded-video-content">
              {expandedVideo.url ? (
                <video
                  className="expanded-video"
                  src={expandedVideo.url}
                  autoPlay
                  loop
                  muted
                  controls
                />
              ) : (
                <div className="video-error-placeholder">
                  <div className="error-icon">⚠️</div>
                  <div className="error-text">Video unavailable</div>
                  <div className="file-path">{expandedVideo.fname}</div>
                </div>
              )}
            </div>
            
            {expandedVideo.measurements && expandedVideo.measurements.length > 0 && (
              <div className="expanded-video-details">
                <h3>Measurements</h3>
                <div className="expanded-measurements">
                  {expandedVideo.measurements.map((measurement, idx) => (
                    <span key={idx} className={`measurement-tag ${measurement.status}`}>
                      {measurement.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <div className="footer-content">
          <div className="footer-left"></div>
          <div className="footer-right">
            {/* <button className="final-report-button">
              <span>Final Report</span>
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
});

PatientAssessment.displayName = 'PatientAssessment';

export default PatientAssessment;