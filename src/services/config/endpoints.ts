// API endpoint configuration
export const API_ENDPOINTS = {
  // Python Backend (Port 5001)
  PYTHON_BASE_URL: process.env.REACT_APP_PYTHON_BACKEND_URL || 'http://localhost:5001',
  
  // WebSocket Server (Port 3002)
  WS_BASE_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:3002',
  
  // API Proxy (Port 5001)
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
} as const;

export const PYTHON_ENDPOINTS = {
  FILES_NPZ: '/api/files/npz',
  FILES_MP4: '/api/files/mp4',
  CONVERT: '/api/convert',
  PROCESS: '/api/process',
  STREAM: '/api/stream',
} as const;

export const WS_EVENTS = {
  // Client to Server
  CHAT_MESSAGE: 'chat_message',
  GENERATE_REPORT: 'generate_report',
  
  // Server to Client
  CHAT_RESPONSE: 'chat_response',
  REPORT_GENERATED: 'report_generated',
} as const;