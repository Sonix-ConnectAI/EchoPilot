const fs = require('fs');
const path = require('path');

// 기존 .env 파일 읽기 (존재하는 경우)
const envPath = path.join(__dirname, '.env');
let existingEnvContent = '';
let existingApiKey = '';

if (fs.existsSync(envPath)) {
  existingEnvContent = fs.readFileSync(envPath, 'utf8');
  
  // 기존 API 키 추출
  const apiKeyMatch = existingEnvContent.match(/OPENAI_API_KEY\s*=\s*(.+)/);
  if (apiKeyMatch) {
    existingApiKey = apiKeyMatch[1].trim();
    console.log('🔑 Found existing API key, preserving it...');
  }
}

// 개발 모드용 환경 변수 설정 (기존 API 키 보존)
const developmentEnv = `# ===========================================
# Development Mode Configuration
# ===========================================
# Use 127.0.0.1 for local development
HOST=0.0.0.0
PORT=3000

# ===========================================
# API Configuration
# ===========================================
# OpenAI Configuration
OPENAI_API_KEY=${existingApiKey || 'YOUR_OPENAI_API_KEY_HERE'}
DANGEROUSLY_DISABLE_HOST_CHECK=true

# Python Backend (Flask server for NPZ processing)
PYTHON_BACKEND_URL=http://127.0.0.1:5000
PYTHON_BACKEND_PORT=5000
REACT_APP_PYTHON_BACKEND_URL=http://127.0.0.1:5000

# Node.js API Proxy Server (for OpenAI)
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=5001
REACT_APP_API_URL=http://127.0.0.1:5001

# WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=3002
REACT_APP_WS_URL=ws://127.0.0.1:3002

# ===========================================
# CORS Configuration
# ===========================================
# Use * to allow all origins (for development)
CORS_ORIGINS=*

# ===========================================
# Frontend Configuration
# ===========================================
# These will be used by the React app
REACT_APP_API_BASE_URL=http://127.0.0.1:5000
REACT_APP_PROXY_URL=http://127.0.0.1:5001
REACT_APP_BACKEND_URL=http://127.0.0.1:5000

# ===========================================
# Feature Flags
# ===========================================
REACT_APP_USE_REAL_AI=true
REACT_APP_USE_PYTHON_BACKEND=true
REACT_APP_USE_MOCK_DATA=false
REACT_APP_USE_WEBSOCKET=true

# ===========================================
# Development/Production Mode
# ===========================================
NODE_ENV=development
REACT_APP_ENV=development

# ===========================================
# Data Configuration
# ===========================================
REACT_APP_DB_JSON_PATH=/DB_json/eval_result-attn-50-3_local.json

# ===========================================
# Logging Configuration
# ===========================================
REACT_APP_LOG_LEVEL=info
REACT_APP_ENABLE_DEBUG=true

# ===========================================
# Notes for Development Mode
# ===========================================
# This configuration is for local development
# All URLs use 127.0.0.1 (localhost)
# For external access, use start-external.js instead
`;

// .env 파일에 개발 모드 설정 저장
fs.writeFileSync(envPath, developmentEnv);

console.log('✅ Development mode configuration applied!');
console.log('📝 All URLs set to 127.0.0.1 (localhost)');
if (existingApiKey) {
  console.log('🔑 API key preserved from existing configuration');
} else {
  console.log('⚠️ No existing API key found - please set OPENAI_API_KEY in .env');
}
console.log('🚀 You can now run: npm start');
console.log('');
console.log('💡 To switch to external access mode, run: node start-external.js');
