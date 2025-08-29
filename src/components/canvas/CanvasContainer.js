import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import './Canvas.css';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function CanvasContainer({ content, onContentChange, onExecute }) {
  const [htmlCode, setHtmlCode] = useState(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Canvas</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        h1 {
            font-size: 3rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <h1>AI Canvas Ready!</h1>
</body>
</html>`);
  const debouncedHtmlCode = useDebounce(htmlCode, 300);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const editorRef = useRef(null);
  const [renderError, setRenderError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const editorOptions = useMemo(() => ({
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
    formatOnPaste: true,
    formatOnType: true,
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true
    },
    tabSize: 2,
    insertSpaces: true,
    padding: {
      top: 16,
      bottom: 16
    },
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: false,
      verticalScrollbarSize: 17,
      horizontalScrollbarSize: 17
    },
    find: {
      addExtraSpaceOnTop: false,
      autoFindInSelection: 'never',
      seedSearchStringFromSelection: 'always'
    },
    renderLineHighlight: 'line',
    selectionHighlight: false,
    cursorBlinking: 'blink',
    cursorStyle: 'line',
    cursorWidth: 2
  }), []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.focus();
    
    monaco.languages.html.htmlDefaults.setOptions({
      format: {
        tabSize: 2,
        insertSpaces: true,
        wrapLineLength: 120,
        unformatted: 'default"',
        contentUnformatted: 'pre,code,textarea',
        indentInnerHtml: false,
        preserveNewLines: true,
        maxPreserveNewLines: undefined,
        indentHandlebars: false,
        endWithNewline: false,
        extraLiners: 'head, body, /html',
        wrapAttributes: 'auto'
      },
      suggest: {
        html5: true,
        angular1: false,
        ionic: false
      }
    });
  }, []);

  const handleEditorChange = useCallback((value) => {
    const newValue = value || '';
    setHtmlCode(newValue);
    if (onContentChange) {
      onContentChange(newValue);
    }
  }, [onContentChange]);

  useEffect(() => {
    if (content && content.html) {
      if (content.isStreaming) {
        const updateContent = () => {
          setHtmlCode(content.html);
          if (onContentChange) {
            onContentChange(content.html);
          }
        };
        
        const timeoutId = setTimeout(updateContent, 50);
        return () => clearTimeout(timeoutId);
      } else {
        setHtmlCode(content.html);
        if (onContentChange) {
          onContentChange(content.html);
        }
      }
    }
  }, [content, onContentChange]);

  const sandboxedContent = useMemo(() => {
    try {
      setIsLoading(true);
      
      const cspMeta = `<meta http-equiv="Content-Security-Policy" content="
        default-src 'self' data: blob:;
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://cdn.jsdelivr.net https://cdn.jsdelivr.net/npm https://cdnjs.cloudflare.com https://unpkg.com;
        style-src 'self' 'unsafe-inline' https: data:;
        img-src * data: blob:;
        font-src * data: blob:;
        connect-src *;
        frame-src *;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
      ">`;
      
      const parser = new DOMParser();
      let processedHtml = debouncedHtmlCode;
      
      if (debouncedHtmlCode.toLowerCase().includes('<html') || 
          debouncedHtmlCode.toLowerCase().includes('<!doctype')) {
        const doc = parser.parseFromString(debouncedHtmlCode, 'text/html');
        const hasHead = doc.querySelector('head');
        if (hasHead && !doc.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
          hasHead.insertAdjacentHTML('afterbegin', cspMeta);
        }
        processedHtml = doc.documentElement.outerHTML;
      } else {
        processedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${cspMeta}
  <title>Preview</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 10px;
    }
  </style>
</head>
<body>
  ${debouncedHtmlCode}
  <script>
    window.addEventListener('error', (e) => {
      console.error('Runtime error:', e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
    });
  </script>
</body>
</html>`;
      }
      
      setRenderError(null);
      setIsLoading(false);
      return processedHtml;
    } catch (error) {
      console.error('Error processing HTML:', error);
      setRenderError(error.message);
      setIsLoading(false);
      return `
<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body style="font-family: Arial, sans-serif; color: #f44336; padding: 20px;">
  <h2>Preview Error</h2>
  <p>Failed to process HTML: ${error.message}</p>
  <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${debouncedHtmlCode}</pre>
</body>
</html>`;
    }
  }, [debouncedHtmlCode]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setRenderError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setRenderError('Failed to load preview');
  };


  return (
    <div className="canvas-container" ref={containerRef}>
      <div className="canvas-split-container">
        <div className="canvas-editor">
          <div className="canvas-editor-header">
            <span>HTML Editor</span>
          </div>
          <div className="monaco-editor-container">
            <Editor
              height="calc(100% - 40px)"
              defaultLanguage="html"
              value={htmlCode}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={editorOptions}
              loading={<div className="editor-loading">Loading editor...</div>}
            />
          </div>
        </div>
        <div className="canvas-preview">
          <div className="canvas-preview-header">
            <span>Live Preview</span>
            {isLoading && <span className="loading-indicator">Updating...</span>}
            {content?.isStreaming && (
              <span className="streaming-indicator" style={{
                color: '#5C6BC0',
                fontSize: '0.9rem',
                fontWeight: '500',
                animation: 'pulse 1.5s infinite'
              }}>
                Streaming...
              </span>
            )}
          </div>
          <div className="canvas-preview-iframe-container">
            <iframe
              ref={iframeRef}
              title="HTML Preview"
              srcDoc={sandboxedContent}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              className="canvas-preview-iframe"
            />
            {renderError && (
              <div className="canvas-preview-error">
                <strong>Error:</strong> {renderError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CanvasContainer;