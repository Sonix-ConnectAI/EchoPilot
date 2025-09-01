// 환경 변수 로드
require('dotenv').config();

const { createServer } = require('http');
const { Server } = require('socket.io');

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
  console.warn('Socket.IO server will start but OpenAI features will be disabled');
}

// HTTP 서버 생성
const httpServer = createServer();

// Socket.IO 서버 생성 (CORS 허용)
const io = new Server(httpServer, {
  cors: {
    origin: "*", // 모든 origin 허용
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 연결된 클라이언트 관리
const clients = new Map();
let clientIdCounter = 0;

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  const clientId = ++clientIdCounter;
  clients.set(clientId, {
    socket,
    id: clientId,
    connectedAt: new Date(),
    lastActivity: new Date()
  });

  console.log(`Client ${clientId} connected from ${socket.handshake.address}`);

  // 클라이언트에 연결 확인 메시지 전송
  socket.emit('connection_established', {
    clientId,
    timestamp: new Date().toISOString()
  });

  // 메시지 수신 처리
  socket.on('message', async (data) => {
    try {
      await handleMessage(clientId, data);
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { error: 'Invalid message format' });
    }
  });

  // OpenAI 요청 처리
  socket.on('openai_request', async (data) => {
    try {
      await handleOpenAIRequest(clientId, data);
    } catch (error) {
      console.error('Error handling OpenAI request:', error);
      socket.emit('error', { error: error.message });
    }
  });

  // ping/pong 처리
  socket.on('ping', () => {
    socket.emit('pong', {
      timestamp: new Date().toISOString()
    });
  });

  // 연결 종료 처리
  socket.on('disconnect', (reason) => {
    console.log(`Client ${clientId} disconnected: ${reason}`);
    clients.delete(clientId);
  });

  // 에러 처리
  socket.on('error', (error) => {
    console.error(`Socket error for client ${clientId}:`, error);
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
        client.socket.emit('pong', {
          messageId,
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        client.socket.emit('error', { 
          messageId, 
          error: `Unknown message type: ${type}` 
        });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    client.socket.emit('error', { messageId, error: error.message });
  }
}

// OpenAI 요청 처리
async function handleOpenAIRequest(client, messageId, requestData) {
  if (!openai) {
    client.socket.emit('error', { 
      messageId, 
      error: 'OpenAI API is not configured. Please set OPENAI_API_KEY environment variable.' 
    });
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
      
      client.socket.emit('response', {
        messageId,
        content: content.trim()
      });
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    client.socket.emit('error', { 
      messageId, 
      error: `OpenAI API error: ${error.message}` 
    });
  }
}

// 스트리밍 응답 처리
async function handleStreamingResponse(client, messageId, options) {
  if (!openai) {
    client.socket.emit('error', { 
      messageId, 
      error: 'OpenAI API is not configured' 
    });
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
        client.socket.emit('stream_chunk', {
          messageId,
          content
        });
      }
    }
    
    // 스트리밍 완료 메시지 전송
    client.socket.emit('stream_end', {
      messageId,
      content: fullContent.trim()
    });
    
  } catch (error) {
    console.error('Streaming error:', error);
    client.socket.emit('error', { 
      messageId, 
      error: `Streaming error: ${error.message}` 
    });
  }
}

// 서버 시작
const PORT = process.env.WS_PORT || 3002;
const HOST = process.env.WS_HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`Socket.IO server running on ${HOST}:${PORT}`);
  console.log(`OpenAI API configured: ${openai ? 'Yes' : 'No'}`);
  if (!openai) {
    console.log('To enable OpenAI features, set OPENAI_API_KEY environment variable');
  }
  console.log(`External users can connect using http://<YOUR_IP>:${PORT}`);
});

// 정기적인 연결 상태 체크
setInterval(() => {
  const now = new Date();
  for (const [clientId, client] of clients) {
    const timeSinceLastActivity = now - client.lastActivity;
    
    // 5분 이상 활동이 없으면 연결 종료
    if (timeSinceLastActivity > 5 * 60 * 1000) {
      console.log(`Closing inactive client ${clientId}`);
      client.socket.disconnect(true);
      clients.delete(clientId);
    }
  }
  
  console.log(`Active connections: ${clients.size}`);
}, 60000); // 1분마다 체크

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Socket.IO server...');
  
  for (const [clientId, client] of clients) {
    client.socket.disconnect(true);
  }
  
  httpServer.close(() => {
    console.log('Socket.IO server closed');
    process.exit(0);
  });
});
