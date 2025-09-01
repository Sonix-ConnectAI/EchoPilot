#!/usr/bin/env python3
"""
Startup script for the NPZ to MP4 conversion server
"""

import subprocess
import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = BASE_DIR.parent.resolve()


def check_dependencies():
    """Check if required Python packages are installed"""
    try:
        import flask
        import flask_cors
        import numpy
        import cv2
        print("✅ All dependencies are available")
        print(f"   Flask: {flask.__version__}")
        print(f"   NumPy: {numpy.__version__}")
        print(f"   OpenCV: {cv2.__version__}")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

def create_test_data():
    """Create test NPZ file if it doesn't exist"""
    test_npz_path = PROJECT_ROOT / "26409027/2020-07-14/26409027(5).dcm.npz"
    
    if not os.path.exists(test_npz_path):
        print("📁 Creating test NPZ file...")
        try:
            subprocess.run([sys.executable, "create_test_npz.py"], check=True, cwd=str(BASE_DIR))
            print("✅ Test NPZ file created successfully")
        except subprocess.CalledProcessError:
            print("❌ Failed to create test NPZ file")
            return False
    else:
        print(f"✅ Test NPZ file exists: {os.path.abspath(str(test_npz_path))}")
    
    return True

def main():
    """Main startup function"""
    print("🚀 Starting NPZ to MP4 Conversion Server")
    print("=" * 50)
    # Load environment variables from backend and project root .env files, if available
    try:
        from dotenv import load_dotenv
        backend_env = BASE_DIR / ".env"
        root_env = PROJECT_ROOT / ".env"
        if root_env.exists():
            load_dotenv(dotenv_path=str(root_env), override=False)
        if backend_env.exists():
            load_dotenv(dotenv_path=str(backend_env), override=True)
        print("🔧 Loaded environment from .env files (root and backend, if present)")
    except Exception as e:
        # Continue even if python-dotenv is not installed
        print(f"⚠️  Could not load .env files automatically ({e}). Proceeding with OS environment.")
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Create test data
    if not create_test_data():
        print("⚠️  Warning: Could not create test data")
    
    # Print server information
    print("\n📡 Server Information:")
    print("   URL: http://localhost:5000")
    print("   Health Check: http://localhost:5000/api/health")
    print("   API Endpoint: http://localhost:5000/api/convert-npz?path=<NPZ_FILE_PATH>")
    
    print("\n🧪 Test URL:")
    test_path = os.path.abspath(str(PROJECT_ROOT / "26409027/2020-07-14/26409027(5).dcm.npz"))
    print(f"   http://localhost:5000/api/convert-npz?path={test_path}")
    
    print("\n🔧 Environment:")
    print(f"   Python: {sys.version}")
    print(f"   Working Directory: {os.getcwd()}")
    
    print("\n" + "=" * 50)
    print("Starting Flask server...")
    
    # Start the Flask app
    try:
        from app import app
        host = os.environ.get("FLASK_RUN_HOST", "0.0.0.0")
        port = int(os.environ.get("FLASK_RUN_PORT", "5000"))
        debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
        print(f"🌐 Binding Flask on {host}:{port} (debug={debug})")
        app.run(host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()