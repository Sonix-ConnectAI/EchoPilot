@echo off
echo 🚀 Starting NPZ to MP4 Conversion Backend Server
echo ================================================

echo 📦 Installing dependencies...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo 🌟 Starting server...
python start_server.py

pause