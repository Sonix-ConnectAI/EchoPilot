# EchoPilot AI - Setup Guide for Local and Remote Access

## Prerequisites
- Node.js (v14 or higher)
- Python 3.8 or higher
- npm or yarn
- Windows 10 PowerShell

## Quick Start

### 1. Install Dependencies
```bash
# Install Node.js dependencies
npm ci

# Install Python dependencies
cd python_backend
pip install -r requirements.txt
cd ..
```

### 2. Configure Environment Variables

#### For Local Access Only:
```bash
# Copy the example environment files
copy .env.example .env
copy python_backend\.env.example python_backend\.env
```

#### For Remote/LAN Access:
1. Copy the environment files as above
2. Edit `.env` and update all `REACT_APP_*` URLs:
   - Replace `127.0.0.1` with your server's IP address
   - Example: `REACT_APP_API_BASE_URL=http://192.168.1.100:5000`

### 3. Build the Frontend
```bash
npm run build:frontend
```

### 4. Start All Services

#### Option A: Using Batch Files (Recommended for Windows)
```bash
# For local access:
start-all.bat

# For remote access:
start-all-external.bat
```

#### Option B: Using npm Scripts
```bash
# For local access:
npm run start:all

# For remote access (allows external connections):
npm run start:all-external
```

#### Option C: Start Services Individually
```bash
# Terminal 1: Python Backend
npm run start:backend

# Terminal 2: Node.js API Proxy
npm run start:server

# Terminal 3: WebSocket Server
npm run start:websocket

# Terminal 4: React Frontend
npm start
```

## Service Endpoints

### Local Access:
- Frontend: http://localhost:3000
- Python Backend: http://localhost:5000
- API Proxy: http://localhost:5001
- WebSocket: ws://localhost:3002

### Remote Access:
- Frontend: http://<YOUR_IP>:3000
- Python Backend: http://<YOUR_IP>:5000
- API Proxy: http://<YOUR_IP>:5001
- WebSocket: ws://<YOUR_IP>:3002

## Windows Firewall Configuration

For remote access, you need to allow inbound connections on the following ports:

### Using PowerShell (Run as Administrator):
```powershell
# Allow React dev server
New-NetFirewallRule -DisplayName "EchoPilot Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow

# Allow Python backend
New-NetFirewallRule -DisplayName "EchoPilot Python Backend" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow

# Allow Node.js API server
New-NetFirewallRule -DisplayName "EchoPilot API Server" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow

# Allow WebSocket server
New-NetFirewallRule -DisplayName "EchoPilot WebSocket" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow
```

### Or Using Windows Defender Firewall GUI:
1. Open Windows Defender Firewall with Advanced Security
2. Click "Inbound Rules" → "New Rule"
3. Select "Port" → TCP → Specific local ports: 3000,5000,5001,3002
4. Allow the connection
5. Apply to all profiles
6. Name it "EchoPilot AI Services"

## Environment Variables Reference

### Main .env File
```env
# Server Binding
HOST=0.0.0.0                    # Bind to all interfaces for external access
PORT=3000                        # Frontend port

# Backend Services
PYTHON_BACKEND_PORT=5000         # Python Flask server port
API_SERVER_HOST=0.0.0.0         # Node.js proxy server host
API_SERVER_PORT=5001            # Node.js proxy server port
WS_HOST=0.0.0.0                 # WebSocket server host
WS_PORT=3002                    # WebSocket server port

# Frontend Configuration (update IPs for remote access)
REACT_APP_API_BASE_URL=http://127.0.0.1:5000
REACT_APP_API_URL=http://127.0.0.1:5001
REACT_APP_WS_URL=ws://127.0.0.1:3002

# CORS (use * for development, specific origins for production)
CORS_ORIGINS=*

# OpenAI API
OPENAI_API_KEY=your_api_key_here
```

### Python Backend .env
```env
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5000
FLASK_DEBUG=True
CORS_ORIGINS=*
```

## Troubleshooting

### Cannot Access from Another Machine
1. Check Windows Firewall rules (see above)
2. Verify all services are binding to `0.0.0.0`, not `localhost` or `127.0.0.1`
3. Confirm the server's IP address: `ipconfig` in PowerShell
4. Update `.env` with correct IP addresses for `REACT_APP_*` variables

### CORS Errors
1. Ensure `CORS_ORIGINS=*` in both `.env` files for development
2. For production, specify exact origins: `CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000`

### Python Backend Not Starting
1. Ensure Python 3.8+ is installed: `python --version`
2. Install dependencies: `pip install -r python_backend/requirements.txt`
3. Check if port 5000 is already in use: `netstat -an | findstr :5000`

### WebSocket Connection Failed
1. Check if WebSocket server is running on port 3002
2. Verify `REACT_APP_WS_URL` matches your server's IP
3. Ensure firewall allows WebSocket connections

## Production Deployment

For production deployment:
1. Build the frontend: `npm run build:frontend`
2. Serve the `build` folder with a static file server
3. Use environment-specific `.env` files
4. Configure CORS to only allow specific origins
5. Use HTTPS/WSS for secure connections
6. Consider using a reverse proxy (nginx, Apache) for better performance

## Available npm Scripts

```json
"build:frontend"      # Build React app for production
"start:backend"       # Start Python Flask server
"start:server"        # Start Node.js API proxy
"start:websocket"     # Start WebSocket server
"start:all"          # Start all services concurrently
"start:all-external" # Start all services for external access
```

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│ React App    │────▶│ API Proxy   │
│             │     │ (Port 3000)  │     │ (Port 5001) │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │Python Backend│     │  OpenAI API │
                    │ (Port 5000)  │     │  (External) │
                    └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  WebSocket   │
                    │ (Port 3002)  │
                    └──────────────┘
```

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure all required ports are available and not blocked
4. Check that all services are running (use Task Manager or `netstat -an`)