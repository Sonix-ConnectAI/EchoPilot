@echo off
echo ============================================
echo Starting EchoPilot AI for External Access
echo ============================================
echo.

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure it.
    echo.
    echo IMPORTANT: For external access, update these in .env:
    echo   - Replace 127.0.0.1 with your server IP in all REACT_APP_* URLs
    echo   - Example: REACT_APP_API_BASE_URL=http://192.168.1.100:5000
    echo.
    pause
    exit /b 1
)

REM Check if python_backend/.env exists
if not exist python_backend\.env (
    echo Creating python_backend/.env from example...
    copy python_backend\.env.example python_backend\.env
)

echo Installing Python dependencies...
cd python_backend
pip install -r requirements.txt
cd ..

echo.
echo Starting services for external access...
echo.
echo Services will be available at:
echo   - Frontend: http://YOUR_IP:3000
echo   - Python Backend: http://YOUR_IP:5000
echo   - API Proxy: http://YOUR_IP:5001
echo   - WebSocket: ws://YOUR_IP:3002
echo.
echo Make sure Windows Firewall allows these ports!
echo.

REM Start all services with external access
set DANGEROUSLY_DISABLE_HOST_CHECK=true
set HOST=0.0.0.0
npm run start:all-external

pause