## Echopilot AI — Development Guide

### Overview
Echopilot AI is a React app with a Node.js API, a WebSocket chat server, and an optional Python backend for converting NPZ echo frames to MP4. This guide explains how to install, run, and where OpenAI prompts are defined.

---

## Quick Start

### Prerequisites
- Node.js 18+, npm 8+
- (Optional) Python 3.9+ for `python_backend`

### Install
```bash
cd echopilot-ai
npm install
```

### Environment (optional)
- OpenAI: set `OPENAI_API_KEY` in `.env`
- CORS: `CORS_ORIGINS="*"` to allow all, or specify allowed origins
- WebSocket host/port: `WS_HOST`, `WS_PORT` (default: `0.0.0.0:3002`)

### Run (development)
- All (Frontend + API + WebSocket):
```bash
npm run dev
```
- Option: run Python backend in a separate terminal
```bash
# Terminal 1
npm run dev

# Terminal 2
cd python_backend
python start_server.py
```


### Individual servers
- Frontend (CRA): `npm start`
- API (Node): `npm run api-server`
- WebSocket: `npm run websocket-server`
- Python converter (optional): `npm run python-server`

### Build
```bash
npm run build
```
Output: `echopilot-ai/build/`

---

## OpenAI Tasks & Prompt Locations

All prompts and OpenAI tasks for this app live inside `echopilot-ai`.

- Summary generation
  - Functions: `generateSummary(patientData)`, `generateSummaryFromStructuredData(structuredData)`
  - File: `src/services/openaiService.js`
  - Prompt: inline (`GENERATE_SUMMARY_PROMPT`) passed to `callOpenAI`

- Conclusion generation
  - Function: `generateConclusion(patientData)`
  - File: `src/services/openaiService.js`
  - Prompt: inline system prompt

- Recommendation generation
  - Function: `generateRecommendation(patientData)`
  - File: `src/services/openaiService.js`
  - Prompt: inline system prompt

- Keyword extraction
  - Function: `extractKeywordsFromSummary(summaryText, structPred, examId)`
  - File: `src/services/openaiService.js`
  - Prompt: `KEYWORD_SYS_PROMPT_KO_V6`

- Update structured data from edited summary
  - Function: `updateStructuredDataFromSummary(modifiedSummary, existingStructuredData)`
  - File: `src/services/openaiService.js`
  - Prompt: inline system prompt

- Real‑time chat (WebSocket)
  - Handler: `socket.on('message', ...)`
  - File: `src/server/websocket-server.js`
  - Prompt: runtime‑composed `systemPrompt` with patient context
  - Conversation memory: per‑socket history is included in OpenAI `messages`

- AI report streaming (Summary/Conclusion/Recommendation/Keywords)
  - Event: `socket.on('generate_ai_report', ...)`
  - File: `src/server/websocket-server.js`
  - Prompts: `SUMMARY_SYS_PROMPT`, `CONCLUSION_SYS_PROMPT`, `RECOMMENDATION_SYS_PROMPT`, `KEYWORD_SYS_PROMPT`

Helper:
- `callOpenAI(systemPrompt, userContent, options)` in `src/services/openaiService.js`

---

## External Access Tips
- WebSocket: ensure `WS_HOST=0.0.0.0`, open port (default `3002`) in firewall
- CORS: set `CORS_ORIGINS` to `*` or include your frontend origin
- Frontend external dev server: use `npm run dev:external`


# 외부 실행 방법
# 
# # .env 파일에서 다음 값들을 외부 IP로 변경
# HOST=0.0.0.0
# REACT_APP_PYTHON_BACKEND_URL=http://10.10.21.59:5000
# REACT_APP_API_URL=http://10.10.21.59:5001
# REACT_APP_WS_URL=ws://10.10.21.59:3002
# REACT_APP_API_BASE_URL=http://10.10.21.59:5001
# REACT_APP_PROXY_URL=http://10.10.21.59:5001
# REACT_APP_BACKEND_URL=http://10.10.21.59:5000
# CORS_ORIGINS=http://10.10.21.59:3000
# 
# 
# 2.python backend: python python_backend/start_server.py - 
# 3. Node.js API Proxy Server: npm run api-server
# 4.WebSocket Server: npm run websocket-server
# 5.Frontend: npm run build -> npx serve -s build -l 3000


# local 실행 방법
# 
# 10.10.21.59 -> 127.0.0.1
# 
# python python_backend\start_server.py
# npm run dev:complete