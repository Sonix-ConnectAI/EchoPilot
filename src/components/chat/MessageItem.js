import React from 'react';
import StreamingMessage from './StreamingMessage';

function MessageItem({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div className={`message ${isUser ? 'user-message' : isSystem ? 'system-message' : 'ai-message'}`}>
      <div className="message-avatar">
        {isUser ? 'U' : isSystem ? 'S' : 'AI'}
      </div>
      <div className="message-content">
        <div className="message-author">
          {isUser ? 'User' : isSystem ? 'System' : 'AI Assistant'}
        </div>
        <div className="message-text">
          {message.isStreaming ? (
            <StreamingMessage 
              content={message.content} 
              isStreaming={message.isStreaming}
            />
          ) : (
            message.content
          )}
        </div>
        {message.status === 'sending' && (
          <div className="message-status">Sending...</div>
        )}
        {message.timestamp && (
          <div className="message-timestamp" style={{ 
            fontSize: '0.75rem', 
            color: '#888', 
            marginTop: '4px' 
          }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageItem;