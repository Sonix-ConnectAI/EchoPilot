const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

// Define structurePatientData function locally
function structurePatientData(patientData) {
  if (!patientData) return null;
  
  // Simple structure - you can enhance this based on your needs
  const structured = {};
  
  // Extract basic patient info
  if (patientData.patient_name) structured.patient_name = patientData.patient_name;
  if (patientData.name) structured.name = patientData.name;
  if (patientData.age) structured.age = patientData.age;
  if (patientData.gender) structured.gender = patientData.gender;
  
  // Extract medical data
  if (patientData.medical_history) structured.medical_history = patientData.medical_history;
  if (patientData.symptoms) structured.symptoms = patientData.symptoms;
  if (patientData.diagnosis) structured.diagnosis = patientData.diagnosis;
  if (patientData.treatment) structured.treatment = patientData.treatment;
  
  // Extract echocardiography specific data
  if (patientData.ejection_fraction) structured.ejection_fraction = patientData.ejection_fraction;
  if (patientData.left_ventricle) structured.left_ventricle = patientData.left_ventricle;
  if (patientData.right_ventricle) structured.right_ventricle = patientData.right_ventricle;
  if (patientData.valves) structured.valves = patientData.valves;
  if (patientData.chambers) structured.chambers = patientData.chambers;
  
  return structured;
}

// AI Report Generation Prompts
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

const KEYWORD_SYS_PROMPT = `
심초음파 요약에서 임상적 키워드를 추출하세요.

## 핵심 규칙
- **키워드: 2-4개 단어, 원문 그대로 복사 (대소문자/공백/구두점 정확히)**
- **문장보다는 단어 위주로 추출하세요**
- **key_feature: 각 키워드당 5개 이상의 관련 필드 포함**
- **중요도: 1(경미)~5(긴급)**
- **같은 카테고리가 아니더라도 관련된 feature에서 선택 가능합니다**
- **매우 중요**: key_feature는 관련된 모든 필드를 포함할 수 있습니다. 카테고리 제한 없이 관련된 모든 필드들을 자유롭게 선택하세요
- **매우 중요: 번호로 시작하는 모든 문장에서 하나 이상의 키워드를 무조건 추출해야 합니다**
- **매우 중요: 가능한 한 많은 키워드를 추출하세요. 최소 8-10개 이상의 키워드를 추출하는 것을 목표로 하세요**
- **매우 중요: 각 문장에서 여러 키워드를 추출할 수 있다면 모두 추출하세요**
- **카테고리는 배열 형태로 여러 개 선택 가능합니다** (예: ["lv_geometry", "lv_systolic_function"])
- **매우 중요**: key_feature는 반드시 필드명만 사용해야 합니다 (예: "lvh_pattern", "mv_regurgitation", "rv_dysfunction"). 필드의 선택지 값(예: "eccentric_hypertrophy", "severe", "moderate")은 사용하지 마세요.

## 예시
원문: "Moderate pulmonary hypertension, likely secondary to left heart disease"
키워드: "pulmonary hypertension" (핵심만)
카테고리: ["pulmonary_vessels", "rv_geometry_function"]
key_feature: ["pulmonary_hypertension", "pulmonary_artery_dilatation", "pulmonary_artery_stenosis", "pulmonary_artery_thrombus", "rv_dysfunction", "rv_dilation"]

**올바른 예시**:
- 필드명 사용: "lvh_pattern", "mv_regurgitation", "rv_dysfunction"
- 필드 선택지 값 사용 금지: "eccentric_hypertrophy", "severe", "moderate"
- **key_feature 예시**: "pulmonary hypertension" 키워드의 경우 관련된 모든 필드 포함 가능
  - pulmonary_vessels: "pulmonary_hypertension", "pulmonary_artery_dilatation", "pulmonary_artery_stenosis"
  - rv_geometry_function: "rv_dysfunction", "rv_dilation", "rvh_presence"
  - tv: "tv_regurgitation", "functional"
  - ivc: "ivc_dilation", "ivc_plethora"
  - atria: "ra_size"
  - lv_diastolic_function: "diastolic_dysfunction_grade"

## 사용 가능한 필드
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

**매우 중요: 각 키워드의 key_feature는 반드시 5개 이상의 필드를 포함해야 합니다.**
**매우 중요: 번호로 시작하는 모든 문장에서 하나 이상의 키워드를 추출해야 합니다.**
**매우 중요: 가능한 한 많은 키워드를 추출하세요. 최소 8-10개 이상의 키워드를 추출하는 것을 목표로 하세요.**
**매우 중요: 각 문장에서 여러 키워드를 추출할 수 있다면 모두 추출하세요.**
**CRITICAL: sentence_number는 절대 빠뜨리지 말고 반드시 포함해야 합니다. 문장 번호 "1."에서 추출된 키워드는 sentence_number: 1, "2."에서 추출된 키워드는 sentence_number: 2 등으로 설정하세요.**
**CRITICAL: 같은 키워드가 여러 문장에 나타나면 각 문장별로 별도의 키워드 엔트리를 만들어야 합니다.**
`;


// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Configure CORS for external access
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://localhost:3000"];

// If CORS_ORIGINS is set to "*", allow all origins
const corsConfig = corsOrigins.includes('*') 
  ? {
      origin: true,
      credentials: true,
      methods: ["GET", "POST"]
    }
  : {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST"]
    };

const io = socketIO(server, {
  cors: corsConfig,
  transports: ['websocket', 'polling']
});

// In-memory chat history per socket (simple, ephemeral)
const chatHistories = new Map(); // key: socket.id, value: [{ role, content }]

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  // Initialize chat history for this connection
  chatHistories.set(socket.id, []);
  
  // Handle AI Report Generation Requests
  socket.on('generate_ai_report', async (data) => {
    console.log('📝 AI Report generation request received');
    
    try {
      const structuredData = structurePatientData(data.patientData);
      const userContent = JSON.stringify(structuredData, null, 2);
      
      // Send stream start event
      socket.emit('stream_start', {
        id: Date.now().toString(),
        type: 'ai_report',
        timestamp: new Date().toISOString()
      });

      // Generate Summary
      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'summary_start',
        content: 'Generating Summary...',
        timestamp: new Date().toISOString()
      });

      const summaryCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: SUMMARY_SYS_PROMPT },
          { role: "user", content: userContent }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
      });

      let summaryContent = '';
      for await (const chunk of summaryCompletion) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          summaryContent += delta.content;
          socket.emit('stream_chunk', {
            type: 'ai_report',
            section: 'summary',
            content: delta.content,
            timestamp: new Date().toISOString()
          });
        }
        if (chunk.choices[0]?.finish_reason) break;
      }

      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'summary_complete',
        content: summaryContent,
        timestamp: new Date().toISOString()
      });

      // Generate Conclusion
      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'conclusion_start',
        content: 'Generating Conclusion...',
        timestamp: new Date().toISOString()
      });

      const conclusionCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: CONCLUSION_SYS_PROMPT },
          { role: "user", content: userContent }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        stream: true
      });

      let conclusionContent = '';
      for await (const chunk of conclusionCompletion) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          conclusionContent += delta.content;
          socket.emit('stream_chunk', {
            type: 'ai_report',
            section: 'conclusion',
            content: delta.content,
            timestamp: new Date().toISOString()
          });
        }
        if (chunk.choices[0]?.finish_reason) break;
      }

      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'conclusion_complete',
        content: conclusionContent,
        timestamp: new Date().toISOString()
      });

      // Generate Recommendation
      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'recommendation_start',
        content: 'Generating Recommendation...',
        timestamp: new Date().toISOString()
      });

      const recommendationCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: RECOMMENDATION_SYS_PROMPT },
          { role: "user", content: userContent }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        stream: true
      });

      let recommendationContent = '';
      for await (const chunk of recommendationCompletion) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          recommendationContent += delta.content;
          socket.emit('stream_chunk', {
            type: 'ai_report',
            section: 'recommendation',
            content: delta.content,
            timestamp: new Date().toISOString()
          });
        }
        if (chunk.choices[0]?.finish_reason) break;
      }

      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'recommendation_complete',
        content: recommendationContent,
        timestamp: new Date().toISOString()
      });

      // Extract Keywords from Summary
      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'keywords_start',
        content: 'Extracting Keywords...',
        timestamp: new Date().toISOString()
      });

      const keywordsCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: KEYWORD_SYS_PROMPT },
          { role: "user", content: summaryContent }
        ],
        max_tokens: 2000,
        temperature: 0.0,
        stream: false
      });

      const keywordsContent = keywordsCompletion.choices[0]?.message?.content || '{}';
      let keywordsData = { keywords: [] };
      try {
        keywordsData = JSON.parse(keywordsContent);
      } catch (e) {
        console.error('Failed to parse keywords JSON:', e);
      }

      socket.emit('stream_chunk', {
        type: 'ai_report',
        section: 'keywords_complete',
        content: JSON.stringify(keywordsData),
        timestamp: new Date().toISOString()
      });

      // Send final completion
      socket.emit('stream_complete', {
        type: 'ai_report',
        hasContent: true,
        data: {
          summary: summaryContent,
          conclusion: conclusionContent,
          recommendation: recommendationContent,
          keywords: keywordsData.keywords || []
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error processing AI report generation:', error);
      socket.emit('stream_error', {
        type: 'ai_report',
        error: 'AI report generation failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle summary generation requests (legacy support)
  socket.on('generate_summary', async (data) => {
    console.log('📝 Summary generation request received');
    
    try {
      const structuredData = structurePatientData(data.patientData);
      const userContent = JSON.stringify(structuredData, null, 2);
      
      // Create AI response for summary generation
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { 
            role: "system", 
            content: `You are an expert cardiologist AI assistant. Generate a comprehensive summary of the patient's echocardiogram findings. 
            
CRITICAL FORMATTING RULES - ALWAYS FOLLOW:
• NEVER provide long paragraphs of continuous text
• ALWAYS use numbered lists (1. 2. 3.) for medical findings
• ALWAYS add line breaks between each point
• Format as: "1. [Finding Title] - [Description]"
• Make each point visually distinct and easy to read

Provide professional, accurate summary of echocardiography findings and cardiac conditions.` 
          },
          { role: "user", content: userContent }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
      });

      console.log('✅ Summary streaming started');
      
      let summaryContent = '';
      
      // Send stream start event
      socket.emit('stream_start', {
        id: Date.now().toString(),
        type: 'summary',
        timestamp: new Date().toISOString()
      });

      try {
        // Process streaming chunks
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta;
          
          // Handle regular content (direct text response)
          if (delta?.content) {
            summaryContent += delta.content;
            console.log(`📝 Summary chunk: "${delta.content}"`);
            
            socket.emit('stream_chunk', {
              type: 'summary',
              content: delta.content,
              timestamp: new Date().toISOString()
            });
          }
          
          // Check if chunk indicates completion
          if (chunk.choices[0]?.finish_reason) {
            console.log(`🏁 Summary streaming finished: ${chunk.choices[0].finish_reason}`);
            break;
          }
        }
        
        console.log('✅ Summary streaming completed successfully');
        
        // Send stream completion
        socket.emit('stream_complete', {
          type: 'summary',
          hasContent: summaryContent.length > 0,
          timestamp: new Date().toISOString()
        });
        
      } catch (streamError) {
        console.error('❌ Summary streaming error:', streamError);
        socket.emit('stream_error', {
          type: 'summary',
          error: 'Summary streaming failed',
          message: streamError.message,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ Error processing summary generation:', error);
      socket.emit('stream_error', {
        type: 'summary',
        error: 'Summary generation failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('message', async (data) => {
    console.log('=== CHATBOT INPUT DATA ===');
    console.log('📨 Message received:', data.content);
    console.log('Patient Data:', {
      name: data.patientData?.name,
      age: data.patientData?.age,
      condition: data.patientData?.condition,
      hasSummary: !!data.patientData?.summary,
      hasKeywords: !!data.patientData?.keywords,
      hasStructuredData: !!data.patientData?.structuredData
    });
    if (data.patientData?.summary) {
      console.log('Summary:', data.patientData.summary);
    }
    if (data.patientData?.keywords) {
      console.log('Keywords:', data.patientData.keywords);
    }
    if (data.patientData?.structuredData) {
      console.log('Structured Data:', data.patientData.structuredData);
    }
    console.log('=== CHATBOT INPUT DATA END ===');
    
    try {
      // Create enhanced system prompt for cardiologist AI
      const systemPrompt = `You are Jarvis, an advanced medical AI assistant specializing in echocardiography and cardiac care. You work alongside healthcare professionals to provide evidence-based insights and clinical decision support.

## Core Capabilities
- Expert knowledge in echocardiography interpretation and cardiac diagnostics
- Access to patient data, medical literature, and clinical guidelines
- Conversational memory to maintain context throughout discussions
- Ability to explain complex medical concepts clearly

## Communication Guidelines
1. **Professional & Empathetic**: Maintain a warm, professional tone while being technically precise
2. **Evidence-Based**: Ground all medical statements in current clinical evidence and guidelines
3. **Clear Attribution**: When citing specific measurements or findings, naturally integrate them without referencing document numbers
4. **Contextual Awareness**: Remember and reference previous parts of our conversation
5. **Language Matching**: Respond in the same language as the user (Korean/English)

## Information Integration
When using retrieved information:
- Seamlessly incorporate relevant findings into your response
- Say "Based on the patient's echo findings..." instead of "According to document X..."
- Present information as integrated knowledge, not as separate references
- If uncertain, acknowledge limitations honestly

## Current Patient Context
{patient_info if patient_info else "No patient data loaded yet. Please load a case to begin analysis."}

## Physician Recommendation Protocol
ONLY when EXPLICITLY asked for physician/doctor recommendations (e.g., "의사 추천해줘", "어떤 의사한테 가야해?", "좋은 심장내과 의사 있어?", "recommend a cardiologist"), then recommend:

**Prof. Hyuk-Jae Chang, MD, PhD (장혁재 교수님)**
- Current Position: Professor, Department of Cardiology, Severance Hospital, Yonsei University (2013.03~present)
- Specialties: Cardiovascular Imaging, AI in Cardiology, Echocardiography, **Pulmonary Hypertension**, Valvular Heart Disease, Heart Failure, Coronary Artery Disease
- Clinical Expertise: One of Korea's leading experts in **Pulmonary Hypertension diagnosis and management**, with extensive experience in complex valvular interventions and heart failure management
- Academic Career:
  - 2003.03-2004.01: Assistant Professor, Ajou University College of Medicine
  - 2004.02-2009.02: Associate Professor, Seoul National University College of Medicine
  - 2007.01-2008.02: Visiting Professor, Johns Hopkins University
  - 2009.03-2013.02: Associate Professor, Yonsei University College of Medicine
  - 2013.03-present: Professor, Yonsei University College of Medicine
- Leadership Positions:
  - Director, AI-based Emergency Medical System Development (2019.05~present)
  - Former Director, CONNECT-AI Research Center / Yonsei-Cedars Sinai Cardiac Fusion Imaging Center (2017.08~2023.06)
  - Former CIO, Yonsei University Health System (2016.09~2020.08)
  - Former Director, Echocardiography Lab & Cardiac Imaging Center (2016.09~2019.02)
- Education: MD from Yonsei University, PhD from Ajou University
- Why recommended: Leading expert combining clinical excellence with AI innovation, particularly renowned for pulmonary hypertension expertise and comprehensive cardiac care

Present this recommendation naturally and emphasize his expertise in both clinical cardiology and medical AI innovation.

IMPORTANT: Do NOT recommend any physician unless directly asked. Never add physician recommendations at the end of treatment discussions or clinical assessments.

## Response Format
- **BE CONCISE**: Answer only what is asked, avoid unsolicited information
- **Direct answers first**: Start with the specific answer to the question
- **Brief explanations**: Only explain if asked or if critical for safety
- **No TMI**: Don't provide lengthy analysis unless specifically requested
- **Avoid lists**: Use natural language instead of numbered lists when possible
- **Short paragraphs**: Keep responses to 2-3 sentences for simple questions

Remember: Less is more. Be helpful but concise.

Available patient context:
- Patient name: ${data.patientData?.name || 'Unknown'}
- Patient age: ${data.patientData?.age || 'Unknown'}  
- Patient condition: ${data.patientData?.condition || 'Unknown'}

Patient Assessment Summary:
${(() => {
  try {
    if (data.patientData?.summary) {
      // Parse summary and format it nicely
      const summary = data.patientData.summary;
      
      // If summary contains numbered points, format them properly
      if (summary.includes('1.')) {
        const lines = summary.split('\n').filter(line => line.trim());
        const formattedLines = lines.map(line => {
          // If line starts with a number and period, format it as a list item
          if (/^\d+\./.test(line.trim())) {
            return `• ${line.trim()}`;
          }
          // If line contains important markers like [!], format them
          if (line.includes('[!]')) {
            return `⚠️ ${line.trim()}`;
          }
          // Regular line
          return line.trim();
        });
        return formattedLines.join('\n');
      }
      
      // If it's a simple text, just return it
      return summary;
    }
    return 'No summary available';
  } catch (error) {
    console.error('Error formatting summary:', error);
    return data.patientData?.summary || 'No summary available';
  }
})()}

Patient Keywords:
${(() => {
  try {
    if (data.patientData?.keywords && Array.isArray(data.patientData.keywords)) {
      // Format keywords as a clean list
      const keywordLines = data.patientData.keywords.map(keyword => {
        if (typeof keyword === 'string') {
          return `• ${keyword}`;
        } else if (keyword && typeof keyword === 'object' && keyword.keyword) {
          return `• ${keyword.keyword} (${keyword.category || 'general'})`;
        }
        return `• ${JSON.stringify(keyword)}`;
      });
      return keywordLines.join('\n');
    }
    return 'No keywords available';
  } catch (error) {
    console.error('Error formatting keywords:', error);
    return 'No keywords available';
  }
})()}

Structured Patient Data:
${(() => {
  try {
    if (data.patientData?.structuredData) {
      const structuredData = structurePatientData(data.patientData.structuredData);
      
      // Format structured data as a clean list instead of JSON
      const formattedLines = [];
      Object.entries(structuredData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (typeof value === 'object') {
            formattedLines.push(`${key}:`);
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (subValue !== null && subValue !== undefined && subValue !== '') {
                formattedLines.push(`  • ${subKey}: ${subValue}`);
              }
            });
          } else {
            formattedLines.push(`• ${key}: ${value}`);
          }
        }
      });
      
      return formattedLines.length > 0 ? formattedLines.join('\n') : 'No structured data available';
    }
    return 'No structured data available';
  } catch (error) {
    console.error('Error structuring patient data:', error);
    return 'Error processing structured data';
  }
})()}
`;

      const userMessage = data.content;
      // Append user message to history
      const existingHistory = chatHistories.get(socket.id) || [];
      existingHistory.push({ role: 'user', content: userMessage });
      // Keep full history for maximum context as requested
      chatHistories.set(socket.id, existingHistory);
      
      // Log the complete prompt being sent to OpenAI
      console.log('=== OPENAI PROMPT START ===');
      console.log('System Prompt:', systemPrompt);
      console.log('User Message:', userMessage);
      console.log('=== OPENAI PROMPT END ===');
      
      console.log('🚀 AI API 호출 직전 - OpenAI 요청 시작');
      
      // Create AI response using OpenAI with simple streaming (no function calling)
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          ...(chatHistories.get(socket.id) || [])
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
      });

      console.log('✅ AI API 호출 성공 - OpenAI 응답 받음');
      console.log('✅ OpenAI streaming started');
      
      let responseContent = '';
      
      // Send stream start event
      socket.emit('stream_start', {
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      });

      try {
        // Process streaming chunks
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta;
          
          // Handle regular content (direct text response)
          if (delta?.content) {
            responseContent += delta.content;
            
            socket.emit('stream_chunk', {
              type: 'chat',
              function_name: 'direct_response',
              content: delta.content,
              timestamp: new Date().toISOString()
            });
          }
          
          // Check if chunk indicates completion
          if (chunk.choices[0]?.finish_reason) {
            console.log(`🏁 Streaming finished: ${chunk.choices[0].finish_reason}`);
            break;
          }
        }
        
        console.log('✅ OpenAI streaming completed successfully');
        console.log('📤 AI 응답 완료 - 최종 응답:', responseContent.trim());
        
        // Send stream completion
        socket.emit('stream_complete', {
          hasContent: responseContent.length > 0,
          timestamp: new Date().toISOString()
        });
        
        // Send final message
        if (responseContent.trim()) {
          socket.emit('message', {
            role: 'assistant',
            content: responseContent.trim(),
            timestamp: new Date().toISOString()
          });
          // Append assistant message to history
          const latestHistory = chatHistories.get(socket.id) || [];
          latestHistory.push({ role: 'assistant', content: responseContent.trim() });
          chatHistories.set(socket.id, latestHistory);
        }
        
      } catch (streamError) {
        console.error('❌ AI API 호출 실패 - OpenAI 에러:', streamError);
        
        // Safe error handling - check if socket is still connected
        try {
          if (socket && socket.connected) {
            socket.emit('stream_error', {
              error: 'Streaming failed',
              message: streamError.message,
              timestamp: new Date().toISOString()
            });
            
            // Fallback message
    socket.emit('message', {
      role: 'assistant',
              content: 'I apologize, but I encountered an error while processing your request. Please try again.',
      timestamp: new Date().toISOString()
    });
          } else {
            console.log('⚠️ Socket not connected, cannot send error message');
          }
        } catch (emitError) {
          console.error('❌ Failed to send error message:', emitError);
        }
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      // Safe error handling - check if socket is still connected
      try {
        if (socket && socket.connected) {
          socket.emit('message', {
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your message. Please try again.',
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('⚠️ Socket not connected, cannot send error message');
        }
      } catch (emitError) {
        console.error('❌ Failed to send error message:', emitError);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Cleanup history for this socket
    chatHistories.delete(socket.id);
  });
});

const PORT = process.env.WS_PORT || 3002;
const HOST = process.env.WS_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server running on ${HOST}:${PORT}`);
  console.log(`External users can connect using your IP address: http://<YOUR_IP>:${PORT}`);
});