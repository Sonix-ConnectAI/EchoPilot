/**
 * Simplified Memory Management System for EchoPilot AI
 * 2-tier storage: Memory (1ms) -> SQLite Database (50ms)
 */
class MemoryManager {
  constructor(config = {}) {
    // Memory storage for current sessions
    this.sessionMemory = new Map();
    
    // Configuration
    this.config = {
      memoryTTL: config.memoryTTL || 3600000, // 1 hour in ms
      maxMemorySize: config.maxMemorySize || 100, // Max sessions in memory
      compressionThreshold: config.compressionThreshold || 200, // Characters
      ...config
    };
    
    // Cleanup interval
    this.startCleanupInterval();
    
    console.log('💾 Memory Manager initialized with 2-tier storage');
  }
  
  /**
   * Analyze query complexity for medical context
   */
  analyzeQueryComplexity(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Simple patterns
    const simplePatterns = [
      /^(hello|hi|hey)/,
      /^(thank|thanks)/,
      /^(yes|no|ok|okay)/,
      /^(what is|what's)/,
      /^(who is|who's)/
    ];
    
    // Complex medical patterns
    const complexPatterns = [
      /(earlier|before|previously|last time)/,
      /(mentioned|said|told|discussed)/,
      /(analyze|analysis|compare|comparison)/,
      /(summarize|summary|overview)/,
      /(all|entire|whole|complete)/,
      /(related|connection|correlation)/,
      /(echocardiography|cardiac|mitral|aortic)/,
      /(assessment|diagnosis|evaluation)/
    ];
    
    // Check for simple patterns
    if (simplePatterns.some(pattern => pattern.test(message))) {
      return { complexity: 'simple', contextSize: 3 };
    }
    
    // Check for complex patterns
    if (complexPatterns.some(pattern => pattern.test(message))) {
      return { complexity: 'complex', contextSize: -1 }; // -1 means all
    }
    
    // Check message length
    if (message.length < 20) {
      return { complexity: 'simple', contextSize: 3 };
    }
    
    if (message.length > 200) {
      return { complexity: 'complex', contextSize: 20 };
    }
    
    return { complexity: 'normal', contextSize: 10 };
  }
  
  /**
   * Store conversation in memory
   */
  async storeConversation(sessionId, messages, complexity = 'normal') {
    const conversation = {
      sessionId,
      messages,
      complexity,
      timestamp: Date.now(),
      tokenCount: this.estimateTokens(messages)
    };
    
    // Store in memory
    this.sessionMemory.set(sessionId, conversation);
    
    // Manage memory size
    if (this.sessionMemory.size > this.config.maxMemorySize) {
      this.evictOldestFromMemory();
    }
    
    return conversation;
  }
  
  /**
   * Retrieve conversation from memory
   */
  async getConversation(sessionId) {
    const startTime = Date.now();
    let conversation = null;
    
    // Check memory
    if (this.sessionMemory.has(sessionId)) {
      conversation = this.sessionMemory.get(sessionId);
    }
    
    const latency = Date.now() - startTime;
    console.log(`📍 Retrieved from memory in ${latency}ms`);
    
    return conversation;
  }
  
  /**
   * Get optimized context based on complexity
   */
  async getOptimizedContext(sessionId, userMessage) {
    const { complexity, contextSize } = this.analyzeQueryComplexity(userMessage);
    const conversation = await this.getConversation(sessionId);
    
    if (!conversation || !conversation.messages) {
      return { messages: [], complexity, model: 'gpt-4.1-2025-04-14', tokenCount: 0 };
    }
    
    let messages = conversation.messages;
    
    // Apply context size limit
    if (contextSize > 0 && messages.length > contextSize) {
      // Keep system message if present
      const systemMessage = messages.find(m => m.role === 'system');
      const recentMessages = messages.slice(-contextSize);
      messages = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
    }
    
    // Compress messages if needed
    if (complexity !== 'complex') {
      messages = this.compressMessages(messages);
    }
    
    // Select model based on complexity and token count
    const tokenCount = this.estimateTokens(messages);
    const model = this.selectModel(complexity, tokenCount);
    
    console.log(`🧠 Context optimized: ${complexity} complexity, ${messages.length} messages, ${tokenCount} tokens, ${model} model`);
    
    return {
      messages,
      complexity,
      model,
      tokenCount,
      contextSize: messages.length
    };
  }
  
  /**
   * Compress messages to reduce tokens
   */
  compressMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'system') return msg; // Don't compress system messages
      
      let content = msg.content;
      
      // Remove unnecessary greetings
      content = content.replace(/^(hello|hi|hey)[,.!]?\s*/gi, '');
      
      // Compress long content
      if (content.length > this.config.compressionThreshold) {
        // Keep first and last parts, summarize middle
        const parts = content.split(/[.!?]\s+/);
        if (parts.length > 3) {
          content = [
            parts.slice(0, 1).join('. '),
            '...',
            parts.slice(-1).join('. ')
          ].join(' ');
        }
      }
      
      return { ...msg, content: content.trim() || msg.content };
    }).filter(msg => 
      // Remove empty or very short messages
      msg.content && msg.content.length > 2
    );
  }
  
  /**
   * Select model based on complexity and tokens
   */
  selectModel(complexity, tokenCount) {
    // Simple queries -> cheaper model
    if (complexity === 'simple' && tokenCount < 1000) {
      return 'gpt-4.1-2025-04-14';
    }
    
    // Complex queries -> better model
    if (complexity === 'complex' || tokenCount > 3000) {
      return process.env.OPENAI_MODEL || 'gpt-4.1-2025-04-14';
    }
    
    // Default to configured model
    return process.env.OPENAI_MODEL || 'gpt-4.1-2025-04-14';
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(messages) {
    if (!messages) return 0;
    
    const text = Array.isArray(messages) 
      ? messages.map(m => typeof m === 'object' ? (m.content || '') : m).join(' ')
      : String(messages);
    
    // Rough estimation: ~4 characters per token for English
    const charsPerToken = 4;
    
    return Math.ceil(text.length / charsPerToken);
  }
  
  /**
   * Generate conversation summary
   */
  async generateSummary(messages) {
    if (!messages || messages.length < 5) return null;
    
    // Extract key points from conversation
    const keyPoints = messages
      .filter(m => m.role === 'assistant')
      .map(m => {
        // Extract first sentence or key information
        const firstSentence = m.content.match(/^[^.!?]+[.!?]/);
        return firstSentence ? firstSentence[0] : m.content.substring(0, 100);
      })
      .slice(-3); // Keep last 3 key points
    
    return keyPoints.join(' ');
  }
  
  /**
   * Evict oldest conversation from memory
   */
  evictOldestFromMemory() {
    let oldest = null;
    let oldestTime = Date.now();
    
    for (const [sessionId, conv] of this.sessionMemory.entries()) {
      if (conv.timestamp < oldestTime) {
        oldest = sessionId;
        oldestTime = conv.timestamp;
      }
    }
    
    if (oldest) {
      this.sessionMemory.delete(oldest);
      console.log(`🗑️ Evicted session ${oldest} from memory`);
    }
  }
  
  /**
   * Cleanup old sessions periodically
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const ttl = this.config.memoryTTL;
      
      // Cleanup memory
      for (const [sessionId, conv] of this.sessionMemory.entries()) {
        if (now - conv.timestamp > ttl) {
          this.sessionMemory.delete(sessionId);
        }
      }
    }, 600000); // Every 10 minutes
  }
  
  /**
   * Get memory statistics
   */
  getStats() {
    return {
      memorySize: this.sessionMemory.size,
      maxMemorySize: this.config.maxMemorySize,
      estimatedMemoryUsage: Array.from(this.sessionMemory.values())
        .reduce((sum, conv) => sum + JSON.stringify(conv).length, 0)
    };
  }
}

module.exports = MemoryManager;