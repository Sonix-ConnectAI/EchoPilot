import React, { useState, useEffect, useRef } from 'react';

function StreamingMessage({ content, isStreaming }) {
  const [displayContent, setDisplayContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const previousContentRef = useRef('');

  useEffect(() => {
    if (!isStreaming) {
      setDisplayContent(content);
      setCurrentIndex(content.length);
      return;
    }

    if (content !== previousContentRef.current) {
      previousContentRef.current = content;
      
      setDisplayContent(content);
      setCurrentIndex(content.length);
      return;
    }

    if (currentIndex < content.length) {
      const timeout = setTimeout(() => {
        setDisplayContent(content.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 20);

      return () => clearTimeout(timeout);
    }
  }, [content, currentIndex, isStreaming]);

  useEffect(() => {
    if (content.length < displayContent.length) {
      setDisplayContent(content);
      setCurrentIndex(content.length);
    }
  }, [content, displayContent.length]);

  return (
    <div className="streaming-message">
      <span>{displayContent}</span>
      {isStreaming && (
        <span className="cursor-blink" style={{
          animation: 'blink 1.2s infinite',
          marginLeft: '2px',
          color: '#5C6BC0'
        }}>▊</span>
      )}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .cursor-blink {
          animation: blink 1.2s infinite;
        }
      `}</style>
    </div>
  );
}

export default StreamingMessage;