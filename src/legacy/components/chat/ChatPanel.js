import React from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import './Chat.css';

function ChatPanel({ messages, onSendMessage, onFileUpload, isConnected, agentStatus, sessionFiles, socketId }) {
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2 className="chat-title">AI Assistant</h2>
        <div className="chat-status">
          <span className={`status-dot ${isConnected ? 'active' : 'inactive'}`}></span>
          <span className="status-text">
            {isConnected ? (agentStatus || 'Ready') : 'Disconnected'}
          </span>
        </div>
      </div>
      <MessageList messages={messages} />
      <ChatInput 
        onSendMessage={onSendMessage} 
        onFileUpload={onFileUpload}
        disabled={!isConnected}
        sessionFiles={sessionFiles}
        socketId={socketId}
      />
    </div>
  );
}

export default ChatPanel;