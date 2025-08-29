const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // HTTP API → 5001
  app.use('/api', createProxyMiddleware({
    target: 'http://127.0.0.1:5001',
    changeOrigin: true,
  }));

  // WebSocket → 3002
  app.use('/ws', createProxyMiddleware({
    target: 'ws://127.0.0.1:3002',
    changeOrigin: true,
    ws: true,
  }));
};