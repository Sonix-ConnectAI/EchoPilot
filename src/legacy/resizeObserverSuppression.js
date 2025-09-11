/**
 * ResizeObserver Console Noise Suppression
 * 
 * This module globally suppresses specific ResizeObserver-related console messages
 * while preserving all other errors and warnings.
 */

(function() {
  'use strict';

  // Guard against double-wrapping during hot reloads
  if (window.__resizeObserverSuppressionApplied) {
    return;
  }
  window.__resizeObserverSuppressionApplied = true;

  // Helper function to check if message contains ResizeObserver noise
  const isResizeObserverNoise = (message) => {
    if (typeof message !== 'string') {
      // Check if it's an Error object
      if (message && typeof message.message === 'string') {
        message = message.message;
      } else {
        return false;
      }
    }
    return message.includes('ResizeObserver loop') || 
           message.includes('ResizeObserver loop limit exceeded');
  };

  // Wrap console.error
  const originalConsoleError = console.error;
  console.error = function() {
    try {
      const firstArg = arguments[0];
      if (isResizeObserverNoise(firstArg)) {
        return; // Skip logging
      }
      return originalConsoleError.apply(console, arguments);
    } catch (e) {
      // If wrapping fails, fall back to original
      return originalConsoleError.apply(console, arguments);
    }
  };

  // Wrap console.warn
  const originalConsoleWarn = console.warn;
  console.warn = function() {
    try {
      const firstArg = arguments[0];
      if (isResizeObserverNoise(firstArg)) {
        return; // Skip logging
      }
      return originalConsoleWarn.apply(console, arguments);
    } catch (e) {
      // If wrapping fails, fall back to original
      return originalConsoleWarn.apply(console, arguments);
    }
  };


  // Also handle window error events that might contain ResizeObserver errors
  window.addEventListener('error', function(event) {
    try {
      if (event && event.message && isResizeObserverNoise(event.message)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event && event.error && isResizeObserverNoise(event.error)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    } catch (e) {
      // If checking fails, let the error through
    }
  });

})();
