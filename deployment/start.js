const express = require('express');
const path = require('path');

// Import your server
require('./server/index.js');

console.log('CrewTrack Pro started successfully!');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT || 3000);
