@echo off
echo ============================================
echo Starting EchoPilot AI Services
echo ============================================
echo.

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure it.
    echo.
    pause
    exit /b 1
)

REM Check if python_backend/.env exists
if not exist python_backend\.env (
    echo Creating python_backend/.env from example...
    copy python_backend\.env.example python_backend\.env
    echo Please configure python_backend/.env if needed.
    echo.
)

echo Installing Python dependencies...
cd python_backend
pip install -r requirements.txt
cd ..

echo.
echo Starting services...
echo.

REM Start all services using npm scripts
npm run start:all

pause