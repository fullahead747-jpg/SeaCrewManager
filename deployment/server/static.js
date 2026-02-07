const express = require('express');
const path = require('path');

module.exports = function configureStatic(app) {
  if (process.env.NODE_ENV === 'production') {
    // Serve static files from dist directory
    app.use(express.static(path.join(__dirname, '../dist')));
    
    // Handle client-side routing
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
  }
};
