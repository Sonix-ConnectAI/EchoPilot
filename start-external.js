#!/usr/bin/env node

const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get network interfaces
function getIPAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name: name,
          address: iface.address
        });
      }
    }
  }
  
  return addresses;
}

// Display connection information
function displayConnectionInfo() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 EchoPilot AI - External Access Configuration');
  console.log('='.repeat(60) + '\n');
  
  const addresses = getIPAddress();
  
  if (addresses.length === 0) {
    console.log('⚠️  No external network interfaces found!');
    console.log('   You may only be able to access this locally.\n');
  } else {
    console.log('📱 Your application will be accessible at:\n');
    
    addresses.forEach(({ name, address }) => {
      console.log(`   Network: ${name}`);
      console.log(`   ✅ Main App:     http://${address}:3000`);
      console.log(`   📡 API Server:   http://${address}:5001`);
      console.log(`   🔌 WebSocket:    ws://${address}:3002`);
      console.log('');
    });
    
    console.log('📋 Share these URLs with external users to connect.\n');
  }
  
  console.log('⚠️  Security Reminders:');
  console.log('   • Only use on trusted networks');
  console.log('   • This configuration is for development only');
  console.log('   • Don\'t expose sensitive data\n');
  
  console.log('='.repeat(60));
}

// Check if .env file exists
function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env file from .env.example...');
    
    if (fs.existsSync(envExamplePath)) {
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      
      // Get first available IP address
      const addresses = getIPAddress();
      if (addresses.length > 0) {
        const ip = addresses[0].address;
        
        // Replace localhost with actual IP in the content
        const updatedContent = envContent
          .replace(/REACT_APP_API_URL=.*/, `REACT_APP_API_URL=http://${ip}:5001`)
          .replace(/REACT_APP_WS_URL=.*/, `REACT_APP_WS_URL=ws://${ip}:3002`);
        
        fs.writeFileSync(envPath, updatedContent);
        console.log(`✅ .env file created with IP address: ${ip}\n`);
      } else {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created (using localhost)\n');
      }
    } else {
      console.log('⚠️  Warning: .env.example not found. Please configure .env manually.\n');
    }
  } else {
    console.log('✅ .env file already exists\n');
  }
}

// Update .env file with current IP
function updateEnvWithIP() {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    const addresses = getIPAddress();
    if (addresses.length > 0) {
      const ip = addresses[0].address;
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Check if we need to update the IP
      if (!envContent.includes(`http://${ip}:`)) {
        console.log(`📝 Updating .env with current IP: ${ip}`);
        
        // Update API and WebSocket URLs
        envContent = envContent
          .replace(/REACT_APP_API_URL=http:\/\/[^:]+:5001/, `REACT_APP_API_URL=http://${ip}:5001`)
          .replace(/REACT_APP_WS_URL=ws:\/\/[^:]+:3002/, `REACT_APP_WS_URL=ws://${ip}:3002`);
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env file updated\n');
      }
    }
  }
}

// Main execution
console.clear();

// Check and create .env if needed
checkEnvFile();

// Update .env with current IP
updateEnvWithIP();

// Display connection information
displayConnectionInfo();

// Start the servers
console.log('🚀 Starting servers for external access...\n');
console.log('Press Ctrl+C to stop all servers\n');
console.log('-'.repeat(60) + '\n');

// Execute the npm script
const child = exec('npm run dev:external', (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`⚠️  Warning: ${stderr}`);
  }
  console.log(stdout);
});

// Pipe the output to console
child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down servers...');
  child.kill();
  process.exit();
});