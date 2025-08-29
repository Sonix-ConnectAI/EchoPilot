# NPZ to MP4 Conversion Backend

This Flask backend server provides an API endpoint to convert NPZ files containing echocardiography video frames to MP4 format.

## Features

- **NPZ to MP4 Conversion**: Converts NumPy compressed files containing video frames to MP4 format
- **CORS Support**: Allows cross-origin requests from the React frontend
- **Automatic Frame Processing**: Handles various frame formats (grayscale, RGB, different shapes)
- **Error Handling**: Comprehensive error handling with detailed logging
- **Temporary File Management**: Automatically cleans up temporary files after serving
- **Health Check Endpoint**: Monitor server status

## Installation

1. **Install Python Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Create Test Data** (optional):
   ```bash
   python create_test_npz.py
   ```

3. **Start the Server**:
   ```bash
   python start_server.py
   ```

## API Endpoints

### Convert NPZ to MP4
- **Endpoint**: `GET /api/convert-npz`
- **Query Parameter**: `path` - Full path to the NPZ file
- **Response**: MP4 video file
- **Content-Type**: `video/mp4`

**Example**:
```
GET http://localhost:5000/api/convert-npz?path=C:/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/26409027/2020-07-14/26409027(5).dcm.npz
```

### Health Check
- **Endpoint**: `GET /api/health`
- **Response**: Server status and version information

**Example Response**:
```json
{
  "status": "healthy",
  "opencv_version": "4.8.1",
  "numpy_version": "1.26.2"
}
```

## NPZ File Format

The server expects NPZ files containing video frames with one of these keys:
- `frames` (preferred)
- `video`
- `data`
- `array`
- `arr_0`

If none of these keys are found, the server uses the first available key.

### Supported Frame Formats

- **3D Arrays**: `(frames, height, width)` - Grayscale
- **4D Arrays**: `(frames, height, width, channels)` - RGB/BGR
- **Data Types**: `uint8`, `float32`, `float64` (automatically normalized)

## Frontend Integration

The React frontend automatically tries to use the backend API and falls back to placeholder videos if the server is not available.

**JavaScript Example**:
```javascript
// The videoProcessor.js automatically handles this
const videoUrl = await npzToVideoUrl(npzPath);
```

## Configuration

### Environment Variables
- `PORT`: Server port (default: 5000)
- `FLASK_DEBUG`: Enable debug mode (default: True)

### Video Settings
- **FPS**: 20 frames per second
- **Codec**: H.264 (falls back to XVID if not available)
- **Quality**: Optimized for echocardiography videos

## Error Handling

The server returns appropriate HTTP status codes:
- `200`: Success - Returns MP4 file
- `400`: Bad request - Missing parameters or invalid file
- `404`: File not found
- `500`: Internal server error

## Testing

1. **Start the server**:
   ```bash
   python start_server.py
   ```

2. **Test health endpoint**:
   ```bash
   curl http://localhost:5000/api/health
   ```

3. **Test conversion** (with test file):
   ```bash
   curl "http://localhost:5000/api/convert-npz?path=C:/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/26409027/2020-07-14/26409027(5).dcm.npz" --output test_video.mp4
   ```

## Logging

The server provides detailed logging for:
- Request processing
- File operations
- Video conversion steps
- Error tracking

Log levels: `INFO`, `WARNING`, `ERROR`

## Dependencies

- **Flask 3.0.0**: Web framework
- **flask-cors 4.0.0**: CORS support
- **numpy 1.26.2**: Array processing
- **opencv-python 4.8.1.78**: Video processing
- **werkzeug 3.0.1**: WSGI utilities

## Production Deployment

For production deployment:

1. **Set environment variables**:
   ```bash
   export FLASK_DEBUG=False
   export PORT=5000
   ```

2. **Use a production WSGI server**:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

3. **Configure reverse proxy** (nginx, Apache, etc.)

## Troubleshooting

### Common Issues

1. **OpenCV codec issues**:
   - Install additional codecs: `pip install opencv-contrib-python`
   - Check available codecs with: `cv2.VideoWriter_fourcc(*'H264')`

2. **File path issues**:
   - Ensure file paths use forward slashes or double backslashes
   - Check file permissions

3. **CORS issues**:
   - Verify frontend origin is allowed
   - Check browser network tab for CORS errors

### Debug Mode

Start with debug logging:
```bash
export FLASK_DEBUG=True
python app.py
```