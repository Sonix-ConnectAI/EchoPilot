const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.API_SERVER_PORT || 5001;
const HOST = process.env.API_SERVER_HOST || '0.0.0.0';

// Configure CORS for external access
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://localhost:3000"];

const corsOptions = corsOrigins.includes('*') 
  ? {
      origin: true,
      credentials: true
    }
  : {
      origin: corsOrigins,
      credentials: true
    };

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Proxy server is running' });
});

// OpenAI proxy endpoint
app.post('/api/openai/chat', async (req, res) => {
  try {
    console.log('🤖 Proxying OpenAI request...');
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });
    
    console.log('✅ OpenAI request successful');
    res.json(response.data);
  } catch (error) {
    console.error('❌ OpenAI proxy error:', error.response?.data || error.message);
    
    if (error.response) {
      // Forward OpenAI error response
      res.status(error.response.status).json({
        error: error.response.data,
        message: error.response.data?.error?.message || 'OpenAI API error'
      });
    } else if (error.request) {
      // Network error
      res.status(503).json({
        error: 'Network error',
        message: 'Failed to reach OpenAI API'
      });
    } else {
      // Other errors
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Proxy server running on http://${HOST}:${PORT}`);
  console.log(`📡 OpenAI proxy endpoint: http://${HOST}:${PORT}/api/openai/chat`);
  console.log(`📱 External users can connect using your IP address: http://<YOUR_IP>:${PORT}`);
});