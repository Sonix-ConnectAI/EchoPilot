import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import '../styles/PatientAssessment.css';
import { generateSummary, structurePatientData, extractKeywordsFromSummary } from '../services/openaiService';
import { npzToVideoUrl, cleanupVideoUrl } from '../utils/videoProcessor';
import { getExamEntryById, getTopViewsFromAttention, getVideoSegmentsForViews } from '../utils/dbUtils';

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

// DetailEditor Component for editing patient data - Memoized for performance
const DetailEditor = memo(({ structuredData, patientData, onUpdate, onClose, selectedBlockType, videoSegments, summaryKeywords, highlightedFeature, selectedKeyword, resolveKeyword, mapFeatureToField }) => {
  const [editedStructuredData, setEditedStructuredData] = useState(structuredData || {});
  
  // Get options from standardizedStructure
  const getFieldOptions = (category, field) => {
    const structure = standardizedStructure;
    
    if (typeof structure[category] === 'object' && structure[category][field]) {
      return structure[category][field];
    } else if (Array.isArray(structure[category])) {
      return structure[category];
    }
    return null;
  };

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

  // Save changes
  const handleSave = () => {
    onUpdate(editedStructuredData);
    onClose();
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
      console.log('🔍 Filtering features for selectedKeyword:', selectedKeyword);
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
        
        const originalCount = recommendedFeatures.length;
        recommendedFeatures = recommendedFeatures.filter(feature => 
          mappedFeatures.includes(feature.feature) || keywordObj.key_feature.includes(feature.feature)
        );
        console.log('🔍 Filtered features:', originalCount, '=>', recommendedFeatures.length);
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
                  {item.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                      onChange={(e) => handleFieldChange(fieldCategory, item.feature, e.target.value)}
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

  // Extract measurement fields
  const getMeasurementFields = () => {
    const measurements = [];
    Object.entries(editedStructuredData).forEach(([category, data]) => {
      if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([field, value]) => {
          if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
            measurements.push({ category, field, value });
          }
        });
      }
    });
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
            
            {/* Add common measurement fields if not present */}
            {!editedStructuredData.lv_systolic_function?.lvef && (
              <div className="measurement-field">
                <label>LVEF (%)</label>
                <input
                  type="number"
                  value={editedStructuredData.lv_systolic_function?.lvef || ''}
                  onChange={(e) => handleNumericChange('lv_systolic_function', 'lvef', e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            )}
            {!editedStructuredData.lv_geometry?.LVEDD && (
              <div className="measurement-field">
                <label>LVEDD (mm)</label>
                <input
                  type="number"
                  value={editedStructuredData.lv_geometry?.LVEDD || ''}
                  onChange={(e) => handleNumericChange('lv_geometry', 'LVEDD', e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            )}
            {!editedStructuredData.lv_geometry?.IVSd && (
              <div className="measurement-field">
                <label>IVSd (mm)</label>
                <input
                  type="number"
                  value={editedStructuredData.lv_geometry?.IVSd || ''}
                  onChange={(e) => handleNumericChange('lv_geometry', 'IVSd', e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            )}
                        {!editedStructuredData.lv_geometry?.IVSd && (
              <div className="measurement-field">
                <label>IVSd (mm)</label>
                <input
                  type="number"
                  value={editedStructuredData.lv_geometry?.IVSd || ''}
                  onChange={(e) => handleNumericChange('lv_geometry', 'IVSd', e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            )}
                        {!editedStructuredData.lv_geometry?.IVSd && (
              <div className="measurement-field">
                <label>IVSd (mm)</label>
                <input
                  type="number"
                  value={editedStructuredData.lv_geometry?.IVSd || ''}
                  onChange={(e) => handleNumericChange('lv_geometry', 'IVSd', e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            )}
                        {!editedStructuredData.lv_geometry?.IVSd && (
              <div className="measurement-field">
                <label>IVSd (mm)</label>
                <input
                  type="number"
                  value={editedStructuredData.lv_geometry?.IVSd || ''}
                  onChange={(e) => handleNumericChange('lv_geometry', 'IVSd', e.target.value)}
                  step="0.1"
                  placeholder="0.0"
                />
              </div>
            )}
            
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="editor-actions">
        <button className="btn-reset" onClick={() => setEditedStructuredData(structuredData || {})}>
          Reset
        </button>
        <button className="btn-apply" onClick={handleSave}>
          Apply
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
  const [isChatActive, setIsChatActive] = useState(false);
  const panelTransitionTimeoutRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const chatInputRef = useRef(null);
  const previousFocusRef = useRef(null);
  const hasGeneratedVideosRef = useRef(false);
  
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
    setIsSummaryEditMode(true);
    setEditedSummary(summary || '');
  };

  const handleSummaryCancel = () => {
    setIsSummaryEditMode(false);
    setEditedSummary('');
  };

  const handleSummaryApply = () => {
    setSummary(editedSummary);
    setIsSummaryEditMode(false);
    setEditedSummary('');
  };

  const handleSummaryReset = () => {
    setEditedSummary(summary || '');
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

  // Generate AI summary
  const handleGenerateSummary = async () => {
    // Prevent duplicate execution
    if (isGeneratingSummary) {
      console.log('⚠️ Summary generation already in progress, skipping...');
      return;
    }
    
    // Prevent execution if summary already exists and keywords are extracted
    if (summary && summaryKeywords.length > 0) {
      console.log('⚠️ Summary and keywords already exist, skipping generation...');
      return;
    }
    
    setIsGeneratingSummary(true);
    setError(null);
    
    try {
      console.log('🔄 Starting AI summary generation...');
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


  // Handle proceeding to detailed analysis
  const handleProceed = () => {
    console.log('➡️ Proceeding to detailed analysis with updated data');
    onProceed(patientData);
  };

  // Filter videos based on keyword category and view_attention
  const filterVideosByKeyword = (keywordObj) => {
    if (!allVideosData || allVideosData.length === 0) return [];
    
    // Handle multiple categories
    const categories = Array.isArray(keywordObj.category) ? keywordObj.category : [keywordObj.category];
    
    // Filter videos by keyword categories
    let filtered = allVideosData.filter(video => 
      categories.includes(video.category)
    );
    
    // Sort by weight (view_attention) - highest first
    filtered.sort((a, b) => b.weight - a.weight);
    
    // Return top 5 videos with highest view_attention
    return filtered.slice(0, 5);
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
    
    console.log('🔍 Keyword clicked - uniqueId:', uniqueId);
    
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
    console.log('💬 Key pressed:', event.key, 'Input value:', event.target.value.trim());
    
    if (event.key === 'Enter') {
      event.preventDefault();
      const inputValue = event.target.value.trim();
      
      if (inputValue && !isChatActive) {
        console.log('💬 Activating chat mode with Enter key');
        performChatTransition(true);
        setIsChatActive(true);
        setShowDetailPanel(true); // Auto-show white-panel when chat activates
        // Don't clear input here - let it show in expanded chat
      } else if (inputValue && isChatActive) {
        console.log('💬 Processing message submission');
        // Handle message submission (existing logic)
        handleChatSubmit(event);
      }
    }
  }, [isChatActive, performChatTransition]);

  const handleChatSubmit = useCallback((event) => {
    event.preventDefault();
    const input = chatInputRef.current;
    if (input && input.value.trim()) {
      console.log('💬 Chat message submitted:', input.value);
      // TODO: Handle chat message submission
      input.value = '';
    }
  }, []);

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

  // Close detail panel
  const closeDetailPanel = () => {
    setShowDetailPanelDebounced(false);
    setSelectedKeyword(null);
    setKeywordFilteredVideos([]);
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
    console.log('🎬 generateCategoryBasedVideos called with:');
    console.log('  - examEntryData:', examEntryData);
    console.log('  - keywords:', keywords);
    
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
    });

    console.log('allVideos: ', allVideos);

    // Sort by weight (highest first)
    allVideos.sort((a, b) => b.weight - a.weight);

    // Generate video URLs with proper error handling
    const generateVideoUrls = async (videoList) => {
      const videos = [];
      const publicPath = '/mnt/c/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/public';

      console.log('video: ', videoList[0]);
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
    
    // Store all videos and extract categories
    setAllVideosData(allGeneratedVideos);
    
    // Extract categories and handle general subcategories
    const categories = [...new Set(allGeneratedVideos.map(v => v.category))];
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
    const generalVideos = allGeneratedVideos.slice(0, 10);
    const keywordSpecificVideos = allGeneratedVideos
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
    
    // Sort by weight (highest first) and return top 6
    return filtered
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
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
        .replace(/[“”„‟]/g, '"') // fancy double quotes -> "
        .replace(/[‘’‚‛]/g, "'") // fancy single quotes -> '
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
          
          // Debug: Only log unusual cases
          if (!sentenceMatch && line.length > 10) {
            console.log('🔍 Line without sentence number:', { line: line.substring(0, 50), fallbackNumber: sentenceNumber });
          }
          
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
    console.log('🔍 PatientAssessment useEffect - patient:', patient);
    console.log('🔍 patient.exam_id:', patient.exam_id);
    
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
          console.log('✅ Loaded exam entry with view_attention');
          console.log('🔍 view_attention keys:', entry.view_attention ? Object.keys(entry.view_attention) : 'none');
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
    console.log('🔄 showDetailPanel state changed to:', showDetailPanel);
    console.log('🔄 Current DOM state:');
    console.log('  - main-container classes:', document.querySelector('.main-container')?.className);
    console.log('  - edit-panel classes:', document.querySelector('.edit-panel')?.className);
    console.log('  - isTransitioningRef.current:', isTransitioningRef.current);
    
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
          <div className={`summary-section ${isSummaryEditMode ? 'edit-mode' : ''} ${!summary ? 'empty-summary' : ''}`}>
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
              {summary ? (
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
                  className="summary-action-btn reset-btn"
                  title="Reset summary"
                  onClick={handleSummaryReset}
                >
                  Reset
                </button>
                <button 
                  className="summary-action-btn cancel-btn"
                  title="Cancel changes"
                  onClick={handleSummaryCancel}
                >
                  Cancel
                </button>
                <button 
                  className="summary-action-btn apply-btn"
                  title="Apply changes"
                  onClick={handleSummaryApply}
                >
                  Apply
                </button>
              </div>
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
                  </div>
                  <button 
                    className="chat-close-btn"
                    onClick={() => {
                      console.log('💬 Chat close button clicked - switching to edit mode');
                      performChatTransition(false);
                      setIsChatActive(false);
                      setShowDetailPanel(true); // Show detail panel (edit mode) when chat closes
                      
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
                <div className="chat-messages">
                  {/* Chat messages will be rendered here */}
                  <div className="chat-welcome-message">
                    <div className="ai-message">
                      <div className="ai-avatar">
                        <img src="/logo/plus.PNG" alt="AI" className="ai-logo" />
                      </div>
                      <div className="message-content">
                        Hello! I'm here to help you analyze the echocardiogram findings. Ask me anything about the patient's cardiac condition.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <form className="chatbot-input" onSubmit={handleChatSubmit}>
              <input 
                ref={chatInputRef}
                type="text" 
                placeholder={isChatActive ? "Type your question..." : "Press Enter to start chat..."}
                className="chatbot-input-field"
                onKeyDown={handleKeyDown}
                autoComplete="off"
                aria-label="Press Enter to activate chat mode"
                tabIndex="0"
              />
              <button type="submit" className="send-button" aria-label="Send message">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 10L10 2L18 10L10 18L2 10Z" fill="#14453A"/>
                  <path d="M10 2L10 18M2 10L18 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M6 8L10 4L14 8L10 12L6 8Z" fill="white"/>
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* WHITE PANEL - Chat Mode Background */}
        {isChatActive && (
          <div className="white-panel" aria-hidden="true">
            <div className="white-panel-content">
              <div className="chat-mode-indicator">
                <div className="indicator-icon">
                  <img src="/logo/plus.PNG" alt="AI" className="ai-logo" />
                </div>
                <h3>AI Chat Mode Active</h3>
                <p>The AI assistant is ready to help you analyze the echocardiogram findings.</p>
              </div>
            </div>
          </div>
        )}

        {/* EDIT PANEL - Slides in from right */}
        <div className={`edit-panel ${showDetailPanel ? 'active' : ''} ${isChatActive ? 'chat-mode' : ''}`}
             aria-hidden={isChatActive}>
          <div className="edit-header">
            <h2>EchoPilot Analysis</h2>
          </div>
          
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
            <button className="final-report-button">
              <span>Final Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

PatientAssessment.displayName = 'PatientAssessment';

export default PatientAssessment;