import React, { useState, useRef, useEffect } from 'react';

function ChatInput({ onSendMessage, onFileUpload, disabled, sessionFiles = [], socketId }) {
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [referencedFiles, setReferencedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((input.trim() || selectedFile) && !disabled && !isUploading) {
      if (selectedFile) {
        const uploadSuccess = await handleFileUpload(selectedFile);
        if (!uploadSuccess) {
          console.log('Message not sent due to file upload failure');
          return;
        }
      }
      
      onSendMessage(input, selectedFile, referencedFiles);
      
      setInput('');
      setSelectedFile(null);
      setReferencedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || isUploading) return;
    
    setIsUploading(true);
    try {
      if (onFileUpload) {
        const uploadSuccess = await onFileUpload(file);
        if (uploadSuccess) {
          console.log('File uploaded successfully, ready for message sending');
          return uploadSuccess;
        } else {
          console.log('File upload failed, keeping file selected for retry');
          return false;
        }
      }
    } catch (error) {
      console.error('File upload error in ChatInput:', error);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleFileReference = (fileId) => {
    setReferencedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  const insertFileReference = (file) => {
    setInput(prev => prev + ` @${file.name} `);
    toggleFileReference(file.id);
    setShowFileList(false);
    textareaRef.current?.focus();
  };

  const selectAllFiles = () => {
    const allFileIds = sessionFiles.map(file => file.id);
    setReferencedFiles(allFileIds);
  };

  const clearAllFiles = () => {
    setReferencedFiles([]);
  };

  return (
    <div className="chat-input-section">
      {sessionFiles.length > 0 && (
        <div className="session-files-bar">
          <button
            type="button"
            className="toggle-files-btn"
            onClick={() => setShowFileList(!showFileList)}
            title="View uploaded files"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="13 2 13 9 20 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="file-count">
              {sessionFiles.length} files
              {referencedFiles.length > 0 && (
                <span className="referenced-count"> ({referencedFiles.length} selected)</span>
              )}
            </span>
          </button>
          
          {showFileList && (
            <div className="session-files-dropdown">
              <div className="dropdown-header">
                <span>Uploaded Files</span>
                <div className="header-actions">
                  {sessionFiles.length > 1 && (
                    <>
                      <button 
                        className="action-btn"
                        onClick={referencedFiles.length === sessionFiles.length ? clearAllFiles : selectAllFiles}
                        title={referencedFiles.length === sessionFiles.length ? "Clear all selections" : "Select all files"}
                      >
                        {referencedFiles.length === sessionFiles.length ? "Clear All" : "Select All"}
                      </button>
                    </>
                  )}
                  <button 
                    className="close-btn"
                    onClick={() => setShowFileList(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="files-list">
                {sessionFiles.map(file => (
                  <div 
                    key={file.id} 
                    className={`file-item ${referencedFiles.includes(file.id) ? 'selected' : ''}`}
                  >
                    <div className="file-details">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div className="file-actions">
                      <button
                        className="reference-btn"
                        onClick={() => insertFileReference(file)}
                        title="Reference in message"
                      >
                        @
                      </button>
                      <button
                        className={`select-btn ${referencedFiles.includes(file.id) ? 'selected' : ''}`}
                        onClick={() => toggleFileReference(file.id)}
                        title="Include file content"
                      >
                        {referencedFiles.includes(file.id) ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {referencedFiles.length > 0 && (
        <div className="referenced-files-bar">
          <div className="referenced-header">
            <span className="label">Referenced files ({referencedFiles.length}):</span>
            {referencedFiles.length > 1 && (
              <button 
                className="clear-all-refs-btn"
                onClick={clearAllFiles}
                title="Clear all referenced files"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="referenced-files-list">
            {referencedFiles.map(fileId => {
              const file = sessionFiles.find(f => f.id === fileId);
              return file ? (
                <span key={fileId} className="referenced-file-chip">
                  {file.name}
                  <button 
                    className="remove-ref-btn"
                    onClick={() => toggleFileReference(fileId)}
                  >
                    ✕
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
      
      <form className="chat-input-container" onSubmit={handleSubmit}>
        {selectedFile && (
          <div className="file-upload-preview">
            <div className="file-info">
              {selectedFile.type.startsWith('image/') ? (
                <div className="image-preview">
                  <img 
                    src={URL.createObjectURL(selectedFile)} 
                    alt={selectedFile.name}
                    className="preview-image"
                  />
                  <div className="image-info">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </>
              )}
            </div>
            {!isUploading && (
              <button 
                type="button" 
                className="remove-file-btn"
                onClick={removeFile}
              >
                ✕
              </button>
            )}
            {isUploading && (
              <div className="upload-progress">
                <div className="loading-spinner"></div>
                <span>Uploading...</span>
              </div>
            )}
          </div>
        )}
        
        <div className="chat-input-wrapper">
          <button
            type="button"
            className="file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            title="Upload new file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? "Connecting..." : 
              sessionFiles.length > 0 ? "Type a message..." :
              "Type a message or upload a file..."
            }
            rows={1}
            disabled={disabled}
          />
          
          <button 
            type="submit" 
            className="send-button"
            disabled={(!input.trim() && !selectedFile && referencedFiles.length === 0) || disabled || isUploading}
          >
            {isUploading ? (
              <div className="loading-spinner"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.csv,.json,.xml,.html,.md,.py,.js,.ts,.java,.cpp,.c,.sql,.log,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.svg"
          style={{ display: 'none' }}
        />
      </form>
    </div>
  );
}

export default ChatInput;