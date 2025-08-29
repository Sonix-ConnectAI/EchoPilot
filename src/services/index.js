/**
 * AI Services Index - Central export for all AI services
 * Provides easy access to all AI system components
 */

// Core AI Services
export { default as AIService } from './aiService';
export { default as WebSocketService } from './webSocketService';
export { default as ContentGenerator } from './contentGenerator';
export { default as MedicalAnalyzer } from './medicalAnalyzer';
export { default as ResponseParser } from './responseParser';
export { default as CommunicationBridge } from './communicationBridge';

// Legacy services (maintain compatibility)
export { default as OpenAIService } from './openaiService';

/**
 * AI System Manager - High-level orchestrator
 */
class AISystemManager {
  constructor() {
    this.services = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize all AI services
   */
  async initialize() {
    try {
      console.log('🚀 Initializing AI System Manager...');
      
      // Initialize services in order
      const { default: AIService } = await import('./aiService');
      const aiService = new AIService();
      await aiService.initialize();
      this.services.set('ai', aiService);
      
      console.log('✅ AI System Manager initialized');
      this.isInitialized = true;
      
      return this;
      
    } catch (error) {
      console.error('❌ Failed to initialize AI System Manager:', error);
      throw error;
    }
  }

  /**
   * Get a specific service
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Get all services
   */
  getAllServices() {
    return Object.fromEntries(this.services);
  }

  /**
   * Check if system is initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Shutdown all services
   */
  async shutdown() {
    console.log('🔄 Shutting down AI System Manager...');
    
    for (const [name, service] of this.services.entries()) {
      try {
        if (service.destroy) {
          await service.destroy();
        } else if (service.disconnect) {
          await service.disconnect();
        }
        console.log(`✅ ${name} service shutdown`);
      } catch (error) {
        console.error(`❌ Failed to shutdown ${name} service:`, error);
      }
    }
    
    this.services.clear();
    this.isInitialized = false;
    console.log('✅ AI System Manager shutdown complete');
  }
}

export { AISystemManager };

// Create singleton instance
let aiSystemManager = null;

export const getAISystemManager = () => {
  if (!aiSystemManager) {
    aiSystemManager = new AISystemManager();
  }
  return aiSystemManager;
};

// Medical AI specific exports
export const MedicalAISystem = {
  // Medical analysis utilities
  analyzeSymptoms: async (symptoms, patientContext = {}) => {
    const manager = getAISystemManager();
    if (!manager.isReady()) {
      await manager.initialize();
    }
    
    const aiService = manager.getService('ai');
    return await aiService.sendRequest(
      `Analyze these symptoms: ${symptoms.join(', ')}`,
      {
        patientData: patientContext,
        requestType: 'analysis',
        outputFormats: ['text', 'document']
      }
    );
  },

  // Clinical decision support
  getClinicalRecommendations: async (clinicalData, patientContext = {}) => {
    const manager = getAISystemManager();
    if (!manager.isReady()) {
      await manager.initialize();
    }
    
    const aiService = manager.getService('ai');
    return await aiService.sendRequest(
      `Provide clinical recommendations based on: ${JSON.stringify(clinicalData)}`,
      {
        patientData: patientContext,
        requestType: 'analysis',
        outputFormats: ['text', 'document', 'table']
      }
    );
  },

  // Medical visualization
  generateMedicalVisualization: async (dataType, data, options = {}) => {
    const manager = getAISystemManager();
    if (!manager.isReady()) {
      await manager.initialize();
    }
    
    const aiService = manager.getService('ai');
    return await aiService.sendRequest(
      `Create a ${dataType} visualization for this medical data`,
      {
        data,
        requestType: 'visualization',
        outputFormats: ['graph', 'image'],
        ...options
      }
    );
  }
};

// Export default manager
export default getAISystemManager;