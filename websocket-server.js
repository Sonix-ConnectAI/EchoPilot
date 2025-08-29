// 환경 변수 로드
require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');

// OpenAI 설정 - API 키가 없어도 서버는 시작되도록 수정
let openai = null;
try {
  const OpenAI = require('openai');
  
  // 환경 변수 확인
  console.log('Checking OpenAI API Key...');
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
  
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('OpenAI client initialized successfully');
  } else {
    console.warn('OPENAI_API_KEY not found in environment variables');
  }
} catch (error) {
  console.warn('OpenAI client initialization failed:', error.message);
  console.warn('WebSocket server will start but OpenAI features will be disabled');
}

// WebSocket 서버 생성
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// 연결된 클라이언트 관리
const clients = new Map();
let clientIdCounter = 0;

// WebSocket 연결 처리
wss.on('connection', (ws, req) => {
  const clientId = ++clientIdCounter;
  clients.set(clientId, {
    ws,
    id: clientId,
    connectedAt: new Date(),
    lastActivity: new Date()
  });

  console.log(`Client ${clientId} connected from ${req.socket.remoteAddress}`);

  // 클라이언트에 연결 확인 메시지 전송
  ws.send(JSON.stringify({
    type: 'connection_established',
    clientId,
    timestamp: new Date().toISOString()
  }));

  // 메시지 수신 처리
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleMessage(clientId, data);
    } catch (error) {
      console.error('Error processing message:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  // 연결 종료 처리
  ws.on('close', (code, reason) => {
    console.log(`Client ${clientId} disconnected: ${code} - ${reason}`);
    clients.delete(clientId);
  });

  // 에러 처리
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    clients.delete(clientId);
  });
});

// 메시지 처리 함수
async function handleMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  const { messageId, type, data: requestData } = data;

  try {
    switch (type) {
      case 'openai_request':
        await handleOpenAIRequest(client, messageId, requestData);
        break;
      
      case 'ping':
        sendMessage(client.ws, {
          messageId,
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        sendError(client.ws, `Unknown message type: ${type}`, messageId);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(client.ws, error.message, messageId);
  }
}

// OpenAI 요청 처리
async function handleOpenAIRequest(client, messageId, requestData) {
  if (!openai) {
    sendError(client.ws, 'OpenAI API is not configured. Please set OPENAI_API_KEY environment variable.', messageId);
    return;
  }

  const { model, messages, temperature, max_tokens, stream } = requestData;

  try {
    if (stream) {
      // 스트리밍 응답 처리
      await handleStreamingResponse(client, messageId, {
        model,
        messages,
        temperature,
        max_tokens,
        stream: true
      });
    } else {
      // 일반 응답 처리
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens
      });

      const content = completion.choices[0]?.message?.content || '';
      
      sendMessage(client.ws, {
        messageId,
        type: 'response',
        content: content.trim()
      });
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    sendError(client.ws, `OpenAI API error: ${error.message}`, messageId);
  }
}

      // 스트리밍 응답 처리
async function handleStreamingResponse(client, messageId, options) {
  if (!openai) {
    sendError(client.ws, 'OpenAI API is not configured', messageId);
    return;
  }

  try {
    const stream = await openai.chat.completions.create(options);
    
    let fullContent = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        
        // 스트리밍 청크 전송
        sendMessage(client.ws, {
          messageId,
          type: 'stream_chunk',
          content
        });
      }
    }
    
    // 스트리밍 완료 메시지 전송
    sendMessage(client.ws, {
      messageId,
      type: 'stream_end',
      content: fullContent.trim()
    });
    
  } catch (error) {
    console.error('Streaming error:', error);
    sendError(client.ws, `Streaming error: ${error.message}`, messageId);
  }
}

// 메시지 전송 헬퍼 함수
function sendMessage(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// 에러 메시지 전송
function sendError(ws, error, messageId = null) {
  sendMessage(ws, {
    messageId,
    type: 'error',
    error: error
  });
}

// 서버 시작
const PORT = process.env.WS_PORT || 3002;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`OpenAI API configured: ${openai ? 'Yes' : 'No'}`);
  if (!openai) {
    console.log('To enable OpenAI features, set OPENAI_API_KEY environment variable');
  }
});

// 정기적인 연결 상태 체크
setInterval(() => {
  const now = new Date();
  for (const [clientId, client] of clients) {
    const timeSinceLastActivity = now - client.lastActivity;
    
    // 5분 이상 활동이 없으면 연결 종료
    if (timeSinceLastActivity > 5 * 60 * 1000) {
      console.log(`Closing inactive client ${clientId}`);
      client.ws.close(1000, 'Inactive timeout');
      clients.delete(clientId);
    }
  }
  
  console.log(`Active connections: ${clients.size}`);
}, 60000); // 1분마다 체크

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  
  for (const [clientId, client] of clients) {
    client.ws.close(1000, 'Server shutdown');
  }
  
  server.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
