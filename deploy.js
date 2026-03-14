#!/usr/bin/env node
// Multi-Platform Publisher - Deploy script (backend only)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT = 'multi-platform-publisher';
const REPO_URL = 'https://github.com/maichanks/multi-platform-publisher.git';
const INSTALL_DIR = path.join(process.env.HOME || '/home/admin', '.openclaw', 'workspace', 'projects', PROJECT);

console.log(`📢 Deploying ${PROJECT} (MCP service)...`);

// 1. Clone
if (!fs.existsSync(INSTALL_DIR)) {
  console.log('📥 Cloning repository...');
  execSync(`git clone ${REPO_URL} "${INSTALL_DIR}"`, { stdio: 'inherit' });
} else {
  console.log('✅ Already exists, skipping clone');
}

// 2. Install backend dependencies
console.log('📦 Installing backend dependencies...');
const backendDir = path.join(INSTALL_DIR, 'backend');
try {
  execSync('pnpm install', { cwd: backendDir, stdio: 'inherit' });
} catch (e) {
  console.log('pnpm not found, trying npm...');
  execSync('npm install', { cwd: backendDir, stdio: 'inherit' });
}

// 3. Copy backend .env example
const envExample = path.join(backendDir, '.env.example');
const envTarget = path.join(backendDir, '.env');
if (fs.existsSync(envExample) && !fs.existsSync(envTarget)) {
  console.log('🔧 Creating backend/.env from example...');
  fs.copyFileSync(envExample, envTarget);
  console.log('⚠️ ACTION REQUIRED: Please edit backend/.env if using real APIs:');
  console.log('   - DATABASE_URL (default: file:./data.db)');
  console.log('   - REDIS_URL');
  console.log('   - Platform credentials (XHS_COOKIE, TWITTER_API_KEY, etc.)');
} else {
  console.log('✅ backend/.env already exists');
}

// 4. Done
console.log('\n✅ Deployment complete!');
console.log('\n📝 Next steps:');
console.log('   1. Configure backend/.env if needed');
console.log('   2. Start backend (development):');
console.log(`      cd ${backendDir} && node mock-server.js`);
console.log('   3. Open frontend (optional):');
console.log(`      cd ${path.join(INSTALL_DIR, 'frontend')} && pnpm install && pnpm run dev`);
console.log('   4. For production, see docs/DEPLOYMENT.md');
console.log('   5. Integrate with OpenClaw via MCP (see README)');
