#!/usr/bin/env node

/**
 * Wasl AI Bot - Startup Script
 * Ensures clean start every time
 */

const { exec } = require('child_process');
const { platform } = require('os');

console.log('\n🚀 Starting Wasl AI Bot...\n');

// Kill any existing node processes
const killCommand = platform() === 'win32' 
  ? 'taskkill /F /IM node.exe 2>nul || echo No existing processes'
  : 'pkill -9 node 2>/dev/null || echo "No existing processes"';

exec(killCommand, (error) => {
  if (error && error.code !== 1) {
    console.log('⚠️  Could not kill old processes (might be none)');
  }

  // Wait a moment then start
  setTimeout(() => {
    console.log('✓ Clean slate - starting fresh\n');
    
    // Start the bot
    require('./index.js');
  }, 1000);
});
