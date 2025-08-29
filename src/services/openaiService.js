// OpenAI API Service for AI Report Generation
// Using backend proxy to avoid CORS issues
const PROXY_URL = process.env.REACT_APP_PROXY_URL;
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3002';

// WebSocket connection management
let wsConnection = null;
let wsMessageQueue = [];
let wsCallbacks = new Map();
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// WebSocket connection management
const initializeWebSocket = () => {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    return wsConnection;
  }

  try {
    wsConnection = new WebSocket(WS_URL);
    
    wsConnection.onopen = () => {
      console.log('WebSocket connected for OpenAI service');
      wsReconnectAttempts = 0;
      
      // Process queued messages
      while (wsMessageQueue.length > 0) {
        const queuedMessage = wsMessageQueue.shift();
        sendWebSocketMessage(queuedMessage);
      }
    };

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsConnection.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      
      if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        wsReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts - 1), 30000);
        
        setTimeout(() => {
          console.log(`Attempting WebSocket reconnection ${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
          initializeWebSocket();
        }, delay);
      }
    };

    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return wsConnection;
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    return null;
  }
};

const sendWebSocketMessage = (message) => {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(message));
  } else {
    // Queue message for later sending
    wsMessageQueue.push(message);
    initializeWebSocket();
  }
};

const handleWebSocketMessage = (data) => {
  const { messageId, type, content, error } = data;
  
  if (error) {
    const callback = wsCallbacks.get(messageId);
    if (callback) {
      callback.reject(new Error(error));
      wsCallbacks.delete(messageId);
    }
    return;
  }

  const callback = wsCallbacks.get(messageId);
  if (callback) {
    if (type === 'stream_chunk') {
      // Handle streaming response
      callback.onChunk?.(content);
    } else if (type === 'stream_end') {
      // Handle completion
      callback.resolve(callback.streamBuffer || content);
      wsCallbacks.delete(messageId);
    } else {
      // Handle regular response
      callback.resolve(content);
      wsCallbacks.delete(messageId);
    }
  }
};

// WebSocket-based AI Report Generation
const generateAIReportWebSocket = async (patientData, options = {}) => {
  return new Promise((resolve, reject) => {
    const messageId = `ai_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let reportData = {
      summary: '',
      conclusion: '',
      recommendation: '',
      keywords: []
    };
    
    let currentSection = '';
    let streamBuffer = '';
    
    const handleStreamChunk = (data) => {
      if (data.type === 'ai_report') {
        switch (data.section) {
          case 'summary':
            reportData.summary += data.content;
            streamBuffer += data.content;
            options.onProgress?.('summary_streaming', data.content);
            break;
          case 'summary_complete':
            reportData.summary = data.content;
            options.onProgress?.('summary_complete', data.content);
            break;
          case 'conclusion':
            reportData.conclusion += data.content;
            options.onProgress?.('conclusion_streaming', data.content);
            break;
          case 'conclusion_complete':
            reportData.conclusion = data.content;
            options.onProgress?.('conclusion_complete', data.content);
            break;
          case 'recommendation':
            reportData.recommendation += data.content;
            options.onProgress?.('recommendation_streaming', data.content);
            break;
          case 'recommendation_complete':
            reportData.recommendation = data.content;
            options.onProgress?.('recommendation_complete', data.content);
            break;
          case 'keywords_complete':
            try {
              const keywordsData = JSON.parse(data.content);
              reportData.keywords = keywordsData.keywords || [];
              options.onProgress?.('keywords_complete', reportData.keywords);
            } catch (e) {
              console.error('Failed to parse keywords:', e);
            }
            break;
        }
      }
    };
    
    wsCallbacks.set(messageId, {
      resolve: () => resolve(reportData),
      reject,
      onChunk: handleStreamChunk,
      streamBuffer
    });

    // Send AI report generation request
    const message = {
      type: 'generate_ai_report',
      patientData: patientData
    };

    sendWebSocketMessage(message);
    
    // Timeout handling
    setTimeout(() => {
      if (wsCallbacks.has(messageId)) {
        wsCallbacks.delete(messageId);
        reject(new Error('WebSocket AI report generation timeout'));
      }
    }, options.timeout || 120000); // 2 minutes timeout for full report
  });
};

// Prompt templates
const SUMMARY_SYS_PROMPT = `
역할: 당신은 경험 많은 심장내과 전문의로서 심초음파(echocardiography) 검사 결과를 바탕으로 구조화된 심초음파 소견(Summary)을 작성합니다.
작성 지침: Summary는 번호를 매긴 리스트 형태로 작성합니다. Summary에서는 병태생리적 원인과 결과 관계를 명확히 나타내세요(e.g., "~로 인한", "~관련된").
중요 수치(예: LVOT 속도, RVSP, 대동맥 크기, ERO 등)는 반드시 괄호 안에 단위를 포함하여 표기합니다.
전체적으로 간결하고 명료한 표현을 사용합니다. 긴 문장은 피하세요. 작성은 영어로 합니다.

예외 규칙:
환자가 sinus rhythm이 **아닌 경우** (e.g., atrial fibrillation, atrial_flutter, ventricular_premature_beat, atrial_premature_beat, paced_rhythm, other 등)에는 **diastolic dysfunction grade를 기재하지 않습니다.** 대신 Diastolic function assessment is limited due to ~~. 라고 표기합니다.
 
아래 형식을 정확히 따라주세요 (예시 제공):
1. LV size와 geometry
2. LV function (systolic/diastolic)
3. valve function
4. RV function
5. Atira
6. extracardiac (effusion,ivc, pericardial, etc)
7. ~~
...
(필요한만큼 추가)
`;

const CONCLUSION_SYS_PROMPT = `
역할: 당신은 경험 많은 심장내과 전문의로서 심초음파(echocardiography) 검사 결과를 바탕으로 구조화된 심초음파 소견(Conclusion)을 작성합니다.
작성 지침: Conclusion은 번호를 매긴 리스트 형태로 작성합니다. 핵심 이상 소견만 간결히 정리합니다. 전체적으로 간결하고 명료한 표현을 사용합니다. 긴 문장은 피하세요. 작성은 영어로 합니다.
병태생리적 원인과 결과 관계를 명확하다면 그걸 포함하여 글을 간결히 작성하세요(e.g., "~로 인한", "~관련된").
중요 수치는 반드시 괄호 안에 단위를 포함하여 표기합니다.

아래 형식을 정확히 따라주세요 (예시 제공):
Conclusion:
1. Finding A (중요 수치 포함) 관련된 원인 설명
2. Finding B (중요 수치 포함) 로 인한 결과 설명
...
`;

const RECOMMENDATION_SYS_PROMPT = `
제공할 데이터:

심초음파 검사 결과 (표로 제공)

작성 지침:

Clinical Recommendation이라는 제목으로 시작합니다.

간결하면서도 동료 의사가 쉽게 이해할 수 있는 문장으로 작성합니다.

권고사항을 명확히 기술하고, 그 근거로 제공된 데이터를 명시적으로 참조하여 뒷받침합니다.

치료적 결정에 영향을 미치는 중요한 임상적 소견(e.g., 환자의 subjective symptoms 및 echocardiographic findings)을 모두 포함합니다.

최종 권고사항을 명확히 기술하고 근거를 요약적으로 제시합니다.

영어로 작성하며, 명료하고 간결한 문장을 사용합니다.
`;


// Combined function to generate all three reports
export const generateAIReport = async (patientData, options = {}) => {
  try {
  // Check if WebSocket is preferred and available
  // const useWebSocket = options.useWebSocket !== false && 
  //                     typeof WebSocket !== 'undefined' && 
  //                     process.env.REACT_APP_USE_WEBSOCKET === 'true';
  const useWebSocket = false;

  if (useWebSocket) {
    try {
        console.log('Using WebSocket for AI report generation');
        return await generateAIReportWebSocket(patientData, options);
    } catch (wsError) {
        console.warn('WebSocket AI report generation failed, falling back to HTTP:', wsError);
      // Fallback to HTTP
        return await generateAIReportHTTP(patientData, options);
    }
  } else {
      console.log('Using HTTP for AI report generation');
      return await generateAIReportHTTP(patientData, options);
    }
  } catch (error) {
    console.error('=== AI 리포트 생성 실패 ===');
    console.error('에러:', error);
    throw error;
  }
};

// HTTP fallback for AI report generation
const generateAIReportHTTP = async (patientData, options = {}) => {
  const structured = structurePatientData(patientData) || {};
  const userContent = JSON.stringify(structured, null, 2);

  const summary = await callOpenAI(SUMMARY_SYS_PROMPT, userContent, { max_tokens: 3000, temperature: 0.2, ...options });

    return {
    summary
    };
}; 

// WebSocket utility functions
export const getWebSocketStatus = () => {
  if (!wsConnection) return 'disconnected';
  
  switch (wsConnection.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING: return 'closing';
    case WebSocket.CLOSED: return 'disconnected';
    default: return 'unknown';
  }
};

export const forceWebSocketReconnect = () => {
  if (wsConnection) {
    wsConnection.close();
  }
  wsReconnectAttempts = 0;
  return initializeWebSocket();
};

export const getWebSocketStats = () => {
  return {
    status: getWebSocketStatus(),
    reconnectAttempts: wsReconnectAttempts,
  };
};

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
    "myocardial_texture_abnormality": ["yes", "no"],
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
    "apical_sparing": ["yes", "no"],
    "RWMA": ["yes", "no"],
    "abnormal_septal_motion": ["yes", "no"],
    "global_LV_systolic_function": ["normal", "abnormal"],
    "lv_sec_presence": ["yes", "no"],
    "LV EDV": "float",
    "LV ESV": "float"
  },
  // ---------------------- LV Diastolic Function ----------------------
  "lv_diastolic_function": {
    "transmitral_flow_pattern_abnormality": ["normal", "abnormal_relaxation", "pseudo_normal", "restrictive"],
    "pulmonary_venous_flow_pattern_abnormality": ["yes", "no"],
    "diastolic_dysfunction_grade": ["normal", "grade_1", "grade_2", "grade_3"],
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
    "rv_dilation": ["yes", "no"],
    "rvh_presence": ["yes", "no"],
    "rv_dysfunction": ["normal", "mild", "moderate", "severe"],
    "rv_compression_or_constraint": ["yes", "no"],
    "rv_fac": "float",
    "tapse": "float"
  },
  // ----------------------------- Atria -------------------------------
  "atria": {
    "la_size": ["normal", "enlarged", "severely_dilated"],
    "ra_size": ["normal", "enlarged", "severely_dilated"],
    "la_sec_presence": ["yes", "no"],
    "interatrial_septum_abnormality": ["yes", "no"],
    "LA diameter": "float",
    "LA volume": "float"
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
    "av_regurgitation": ["none", "trivial", "mild", "moderate", "severe"],
    "AV Vmax": "float",
    "AV VTI": "float",
    "AV peak PG": "float",
    "AV mean PG": "float",
    "AVA": "float",
    "AR PHT": "float"
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
    "mv_regurgitation": ["none", "trivial", "mild", "moderate", "severe"],
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
    "tv_regurgitation": ["none", "trivial", "mild", "moderate", "severe"],
    "TR Vmax": "float",
    "TR VTI": "float"
  },
  // --------------------- Pulmonary Valve (PV) ------------------------
  "pv": {
    "thickening": ["yes", "no"],
    "prosthetic_valve": ["mechanical", "bioprosthetic", "no"],
    "uncertain": ["yes", "no"],
    "pv_stenosis": ["none", "mild", "moderate", "severe"],
    "pv_regurgitation": ["none", "trivial", "mild", "moderate", "severe"],
    "PV Vmax": "float",
    "PV VTI": "float",
    "PV peakPG": "float",
    "PV meanPG": "float"
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
    "pulmonary_artery_dilatation": ["yes", "no"],
    "rvsp": "float"
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

const flattenSpecs = (struct) => {
  const rows = [];
  
  for (const [cat, spec] of Object.entries(struct)) {
    if (Array.isArray(spec)) {
      // classification (top-level)
      rows.push({
        Category: cat,
        Field: cat,
        Type: spec.join(", "),
        Value: null
      });
    } else if (typeof spec === 'object' && spec !== null) {
      // nested fields
      for (const [field, typ] of Object.entries(spec)) {
        rows.push({
          Category: cat,
          Field: field,
          Type: Array.isArray(typ) ? typ.join(", ") : "float",
          Value: null
        });
      }
    }
  }
  
  return rows;
};

const extractValue = (val, mode) => {
  if (typeof val !== 'object' || val === null) {
    return val;
  }
  
  if (mode === 'pred' || mode === 'pred_label') {
    return val.pred_label || null;
  }
  if (mode === 'true' || mode === 'true_label') {
    return val.true_label || null;
  }
  if (['pred_label', 'true_label', 'pred', 'true', 'prob'].includes(mode)) {
    return val[mode] || null;
  }
  
  return null;
};

const fillFromSample = (analysisDf, sample, mode) => {
  return analysisDf.map(row => {
    const k1 = row.Field;
    const k2 = `${row.Category}//${row.Field}`;
    const rawVal = sample[k1] || sample[k2] || null;
    
    let value = extractValue(rawVal, mode);
    
    // Special cases like Python version
    if (row.Category.toLowerCase() === 'cardiomyopathy' && row.Field === 'cardiomyopathy_type') {
      value = extractValue(rawVal, 'true_label');
    } else if (row.Category.toLowerCase() === 'lv_geometry' && row.Field === 'lvh_presence') {
      value = extractValue(rawVal, 'true_label');
    } else {
      value = extractValue(rawVal, mode);
    }
    
    return { ...row, Value: value };
  });
};

const dfToNestedDict = (df) => {
  const result = {};
  
  
  for (const r of df) {
    if (r.Value === null || r.Value === "" || r.Value === undefined) {
      continue;
    }
    
    const { Category: cat, Field: field, Value: val } = r;
    
    if (!result[cat]) {
      result[cat] = {};
    }
    result[cat][field] = val;
  }
  
  return result;
};


export const structurePatientData = (patientData) => {
  try {
    // Step 1: Initialize with standardized structure (equivalent to Python's _flatten_specs)
    const analysisDf = flattenSpecs(standardizedStructure);
    
    // Step 2: Populate with patient data (equivalent to Python's _fill_from_sample)
    const populatedDf = fillFromSample(analysisDf, patientData, 'pred');

    // Step 3: Convert to final struct_pred format (equivalent to Python's _df_to_nested_dict)
    const structPred = dfToNestedDict(populatedDf);
    
    return structPred;
  } catch (error) {
    console.error('Error in struct_pred generation:', error);
    // Fallback to empty structure
    return {};
  }
};

// Thin wrappers to keep backward compatibility
export const generateSummary = async (patientData, options = {}) => {
  const useWebSocket = false;
  const report = await generateAIReport(patientData, { useWebSocket, ...options });
  return report.summary || '';
};

export const generateConclusion = async (patientData, options = {}) => {
  const useWebSocket = false;
  const report = await generateAIReport(patientData, { useWebSocket, ...options });
  return report.conclusion || '';
};

export const generateRecommendation = async (patientData, options = {}) => {
  const useWebSocket = false;
  const report = await generateAIReport(patientData, { useWebSocket, ...options });
  return report.recommendation || '';
};

// Minimal proxy-based OpenAI caller for keyword extraction only
async function callOpenAI(systemPrompt, userContent, options = {}) {
  const body = {
    model: options.model || 'gpt-4.1-2025-04-14',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: options.temperature ?? 0.0,
    max_tokens: options.max_tokens ?? 1024
  };
  
  const resp = await fetch(`${PROXY_URL}/api/openai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });


  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI proxy error ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim?.() || '';
}

const KEYWORD_SYS_PROMPT_KO_V6 = `
심초음파 요약에서 임상적 키워드를 추출하세요.

## 핵심 규칙
- **키워드: 원문에서 2~5개의 단어를 그대로 추출해야 함 (대소문자/공백/구두점 정확히/재구성 금지)**
- **매우 중요: 문장에 있는 키워드를 그대로 복사해서 가져와야 합니다. 절대 다른 표현으로 바꾸지 마세요**
- **문장보다는 단어 위주로 추출하세요**
- **key_feature: 각 키워드당 5개 이상의 관련 필드 포함**
- **중요도: 1(경미)~5(긴급)**
- **카테고리는 배열 형태로 여러 개 선택 가능합니다** (예: ["lv_geometry", "lv_systolic_function"])

- **매우 중요**: key_feature는 관련된 모든 필드를 포함할 수 있습니다. 카테고리 제한 없이 관련된 모든 필드들을 자유롭게 선택하세요
- **매우 중요**: 한 문장에서 필수적으로 하나 이상의 키워드를 무조건 추출해야 합니다**
- **매우 중요**: 문장 번호 "1."에서 추출된 키워드는 sentence_number: 1, "2."에서 추출된 키워드는 sentence_number: 2 등으로 설정하세요.**
- **매우 중요**: 같은 키워드가 여러 문장에 나타나면 각 문장별로 별도의 키워드 엔트리를 만들어야 합니다.**

## 예시
원문: "Moderate pulmonary hypertension, likely secondary to left heart disease"
키워드: "pulmonary hypertension" (핵심만)
카테고리: ["pulmonary_vessels", "rv_geometry_function"]
key_feature: ["pulmonary_hypertension", "pulmonary_artery_dilatation", "pulmonary_artery_stenosis", "pulmonary_artery_thrombus", "rv_dysfunction", "rv_dilation"]


## 사용 가능한 카테고리 별 필드 
lv_geometry: lv_cavity_size, lvh_presence, lvh_pattern, increased_lv_wall_thickeness, diffuse_lv_wall_thickening_pattern, asymmetric_lv_wall_thickening_pattern, local_lv_wall_thickening_pattern_septum, local_lv_wall_thickening_pattern_apex, local_lv_wall_thickening_pattern_other, sigmoid_septum_or_basal_or_septal_hypertrophy_presence, papillary_muscle_abnormality, apical_burnout, D_shape, myocardial_texture_abnormality
lv_systolic_function: apical_sparing, RWMA, abnormal_septal_motion, global_LV_systolic_function, lv_sec_presence
lv_diastolic_function: transmitral_flow_pattern_abnormality, pulmonary_venous_flow_pattern_abnormality, diastolic_dysfunction_grade
rv_geometry_function: rv_dilation, rvh_presence, rv_dysfunction, rv_compression_or_constraint
atria: la_size, ra_size, la_sec_presence, interatrial_septum_abnormality
av: degenerative, calcification, thickening, sclerosis, rheumatic, congenital, bicuspid, quadricuspid, prolapse, vegetation, prosthetic_valve, thrombus_pannus, uncertain, av_stenosis, av_regurgitation
mv: degenerative, rheumatic, calcification, annular_calcification, doming, fish_mouth_appearance, thickening, prolapse, functional, prosthetic_valve, annular_ring, vegetation, thrombus_pannus, uncertain, sam, mv_stenosis, mv_regurgitation
tv: functional, coaptation_failure, thickening, prolapse, ebstein_anomaly, prosthetic_valve, annular_ring, vegetation, degenerative, thrombus_pannus, uncertain, tv_stenosis, tv_regurgitation
pv: thickening, prosthetic_valve, uncertain, pv_stenosis, pv_regurgitation
aorta: aortic_root_ascending_abnormalities, aortic_arch_abnormalities, abdominal_aorta_abnormalities
ivc: ivc_dilation, ivc_plethora
pulmonary_vessels: pulmonary_hypertension, pulmonary_artery_thrombus, pulmonary_artery_stenosis, pulmonary_artery_dilatation
pericardial_disease: effusion_amount, pericardial_thickening_or_adhesion, hemodynamic_significance, constrictive_physiology, effusive_constrictive, tamponade_physiology, epicardial_adipose_tissue
cardiomyopathy: cardiomyopathy_type, hypertrophic_type
intracardiac_findings: ASD, PFO, VSD, PDA, intracardiac_device, LVOT obstruction, RVOT obstruction, mid-cavity obstruction, mass_presence

## 출력 형식
{
  "keywords": [
    {
      "text": "키워드명",
      "sentence_number": 키워드가 추출된 문장 번호 (문장의 제일 앞에 있는 번호, 예: "1.", "2.", "3." 등 - 반드시 숫자로 입력)
      "category": ["카테고리1", "카테고리2", ...],
      "importance": 1-5,
      "key_feature": ["필드1", "필드2", "필드3", "필드4", "필드5", ... (각 키워드당 최소 5개 이상)]
    }
  ]
}

`;

// New function to update structuredData based on modified summary
const UPDATE_STRUCTURED_DATA_PROMPT = `
Role: You are a cardiologist AI specialized in analyzing echocardiogram results.

Task: Based on the provided modified summary content, update the structuredData values while maintaining the exact nested structure format.

Input Data:
- Modified summary content
- Existing structuredData structure
- Standardized structure definition

Requirements:
1. Identify all medical findings mentioned in the modified summary
2. Map these findings to corresponding structuredData fields using the standardized structure
3. Set appropriate values from the predefined options for each field
4. Maintain the exact nested structure format - DO NOT flatten the structure
5. Only update fields that are mentioned in the summary
6. Keep existing values for fields not mentioned in the summary
7. For numeric fields, extract exact values if mentioned, otherwise keep existing
8. For categorical fields, select the most appropriate option from the predefined list

Standardized Structure Reference:
- lv_geometry: { lv_cavity_size, lvh_presence, lvh_pattern, increased_lv_wall_thickeness, etc. }
- lv_systolic_function: { RWMA, abnormal_septal_motion, global_LV_systolic_function, lvef, etc. }
- lv_diastolic_function: { transmitral_flow_pattern_abnormality, diastolic_dysfunction_grade }
- rv_geometry_function: { rv_dilation, rvh_presence, rv_dysfunction }
- atria: { la_size, ra_size, la_sec_presence, interatrial_septum_abnormality }
- av: { degenerative, calcification, av_stenosis, av_regurgitation, etc. }
- mv: { degenerative, mv_stenosis, mv_regurgitation, annular_ring, etc. }
- tv: { functional, tv_stenosis, tv_regurgitation, annular_ring, etc. }
- pv: { thickening, pv_stenosis, pv_regurgitation }
- aorta: { aortic_root_ascending_abnormalities }
- ivc: { ivc_dilation, ivc_plethora }
- pulmonary_vessels: { pulmonary_hypertension, pulmonary_artery_dilatation }
- pericardial_disease: { effusion_amount, pericardial_thickening_or_adhesion, etc. }
- cardiomyopathy: { cardiomyopathy_type, hypertrophic_type }
- intracardiac_findings: { ASD, PFO, VSD, PDA, intracardiac_device, etc. }
- image_quality: ["normal", "poor"]
- cardiac_rhythm: ["normal", "atrial_fibrillation", "atrial_flutter", etc.]
- cardiac_rhythm_abnormality: ["normal", "abnormal"]

Output Format:
Return a JSON object with the SAME NESTED STRUCTURE as the input structuredData, with updated values based on the summary.
Only include categories and fields that need to be updated.
Maintain the exact structure - categories as objects with nested fields.

Example:
If summary mentions "moderate mitral regurgitation", update:
{
  "mv": {
    "mv_regurgitation": "moderate"
  }
}

If summary mentions "LVEF 45%", update:
{
  "lv_systolic_function": {
    "lvef": 45,
    "global_LV_systolic_function": "abnormal"
  }
}

If summary mentions "dilated LV with eccentric hypertrophy", update:
{
  "lv_geometry": {
    "lv_cavity_size": "dilated",
    "lvh_presence": "yes",
    "lvh_pattern": "eccentric_hypertrophy"
  }
}

CRITICAL: Always maintain the nested structure. Do not flatten or change the structure format.
`;

export const updateStructuredDataFromSummary = async (modifiedSummary, existingStructuredData, options = {}) => {
  try {
    console.log('🔄 Updating structuredData from modified summary...');
    
    const userContent = JSON.stringify({
      summary: modifiedSummary,
      existing_structured_data: existingStructuredData,
      standardized_structure: standardizedStructure
    }, null, 2);
    
    const response = await callOpenAI(
      UPDATE_STRUCTURED_DATA_PROMPT,
      userContent,
      { 
        max_tokens: 3000, 
        temperature: 0.1, 
        model: 'gpt-4.1-2025-04-14',
        ...options 
      }
    );
    
    try {
      // Parse the response
      let updatedData;
      try {
        updatedData = JSON.parse(response);
      } catch (_) {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/g);
        if (jsonMatch) {
          updatedData = JSON.parse(jsonMatch[jsonMatch.length - 1]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      }
      
      // Merge with existing data
      const mergedData = { ...existingStructuredData };
      
      // Deep merge the updates
      for (const [category, fields] of Object.entries(updatedData)) {
        if (!mergedData[category]) {
          mergedData[category] = {};
        }
        
        // Handle both object and direct value assignments
        if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
          // It's a nested object with multiple fields
          for (const [field, value] of Object.entries(fields)) {
            mergedData[category][field] = value;
          }
        } else {
          // It's a direct value assignment (for top-level categories)
          mergedData[category] = fields;
        }
      }
      
      console.log('✅ StructuredData updated successfully');
      console.log('📊 Original structuredData:', existingStructuredData);
      console.log('🔄 AI suggested updates:', updatedData);
      console.log('📊 Final merged structuredData:', mergedData);
      
      // Log specific changes
      console.log('🔍 DETAILED CHANGES:');
      for (const [category, fields] of Object.entries(updatedData)) {
        if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
          for (const [field, newValue] of Object.entries(fields)) {
            const oldValue = existingStructuredData[category]?.[field];
            if (oldValue !== newValue) {
              console.log(`  ${category}.${field}: "${oldValue}" → "${newValue}"`);
            }
          }
        } else {
          const oldValue = existingStructuredData[category];
          if (oldValue !== fields) {
            console.log(`  ${category}: "${oldValue}" → "${fields}"`);
          }
        }
      }
      return {
        success: true,
        data: mergedData,
        updates: updatedData
      };
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response:', response);
      return {
        success: false,
        error: 'Failed to parse AI response',
        data: existingStructuredData
      };
    }
    
  } catch (error) {
    console.error('Failed to update structuredData:', error);
    return {
      success: false,
      error: error.message,
      data: existingStructuredData
    };
  }
};

// Function to generate summary from structuredData
export const generateSummaryFromStructuredData = async (structuredData, options = {}) => {
  try {
    console.log('📝 Generating summary from structuredData...');
    
    const GENERATE_SUMMARY_PROMPT = `
역할: 당신은 경험 많은 심장내과 전문의로서 심초음파(echocardiography) 검사 결과를 바탕으로 구조화된 심초음파 소견(Summary)을 작성합니다.

작성 지침: 
- Summary는 번호를 매긴 리스트 형태로 작성합니다
- 병태생리적 원인과 결과 관계를 명확히 나타내세요(e.g., "~로 인한", "~관련된")
- 중요 수치(예: LVOT 속도, RVSP, 대동맥 크기, ERO 등)는 반드시 괄호 안에 단위를 포함하여 표기합니다
- 전체적으로 간결하고 명료한 표현을 사용합니다
- 긴 문장은 피하세요
- 작성은 영어로 합니다

예외 규칙:
환자가 sinus rhythm이 아닌 경우 (e.g., atrial fibrillation, atrial_flutter, ventricular_premature_beat, atrial_premature_beat, paced_rhythm, other 등)에는 diastolic dysfunction grade를 기재하지 않습니다. 대신 "Diastolic function assessment is limited due to [rhythm type]"라고 표기합니다.

아래 형식을 정확히 따라주세요:
1. LV size and geometry
2. LV function (systolic/diastolic)
3. Valve function
4. RV function
5. Atria
6. Extracardiac findings (effusion, IVC, pericardial, etc)
(필요한만큼 추가)

입력된 structuredData를 분석하여 의미있는 소견들을 위 형식에 맞춰 작성하세요.
`;
    
    const userContent = JSON.stringify(structuredData, null, 2);
    
    const response = await callOpenAI(
      GENERATE_SUMMARY_PROMPT,
      userContent,
      { 
        max_tokens: 2000, 
        temperature: 0.3,
        model: 'gpt-4.1-2025-04-14',
        ...options 
      }
    );
    
    console.log('✅ Summary generated successfully from structuredData');
    return response;
    
  } catch (error) {
    console.error('Failed to generate summary from structuredData:', error);
    throw error;
  }
};

export const extractKeywordsFromSummary = async (summaryText, structPred = {}, examId = null, options = {}) => {
  try {
    const userPayload = JSON.stringify({ summary: summaryText, struct_pred: structPred, exam_id: examId });
    const response = await callOpenAI(KEYWORD_SYS_PROMPT_KO_V6, userPayload, { max_tokens: 5000, temperature: 0.0, ...options });
    try {
      // Robust parsing: accept raw JSON, fenced code blocks, or loose text with JSON inside
      const extractJsonString = (text) => {
        if (!text) return null;
        // 1) ```json ... ``` block
        const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
        if (fence && fence[1]) return fence[1].trim();
        // 2) First JSON object substring (greedy minimal)
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          return text.slice(start, end + 1);
        }
        return null;
      };

      console.log('🛰️ [extractKeywordsFromSummary] response:', response);

      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (_) {
        const jsonStr = extractJsonString(response);
        if (!jsonStr) throw _;
        parsed = JSON.parse(jsonStr);
      }
      // keep key_feature entries as provided (no underscore conversion)
      const passthrough = (parsed.keywords || []).map(k => ({
        ...k,
        key_feature: Array.isArray(k.key_feature) ? k.key_feature : []
      }));
      return { keywords: passthrough, suggestions: parsed.suggestions || [], warnings: parsed.warnings || [] };
    } catch (e) {
      if (options && options.debug) {
        console.error('Keyword JSON parse failed. Raw response:', response);
      }
      return { keywords: [], suggestions: [], warnings: [] };
    }
  } catch (error) {
    console.error('extractKeywordsFromSummary failed:', error);
    return { keywords: [], suggestions: [], warnings: [] };
  }
};