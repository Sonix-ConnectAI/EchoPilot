# EchoPilot AI Proxy Server

This proxy server handles OpenAI API calls to bypass CORS restrictions in the browser.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env` if needed
   - Update `OPENAI_API_KEY` with your actual API key
   - Default port is 5001

3. **Run the Server**
   ```bash
   # Production mode
   npm start
   
   # Development mode (with auto-restart)
   npm run dev
   ```

## Endpoints

- `GET /health` - Health check endpoint
- `POST /api/openai/chat` - OpenAI chat completions proxy

## Troubleshooting

### CORS Error
If you still get CORS errors:
1. Ensure the server is running on the correct port (5001)
2. Check that the frontend is configured to use the correct proxy URL
3. Try accessing http://localhost:5001/health to verify the server is running

### Connection Refused
If the frontend can't connect:
1. Make sure the server is running
2. Check firewall settings
3. Verify the port isn't being used by another service

### API Key Issues
If you get authentication errors:
1. Verify your OpenAI API key is valid
2. Check that the API key has sufficient credits
3. Ensure the API key is properly set in the .env file

## Frontend Configuration

The frontend will automatically use the proxy server. You can configure the proxy URL by setting the `REACT_APP_PROXY_URL` environment variable in the frontend's `.env` file:

```
REACT_APP_PROXY_URL=http://localhost:5001
```