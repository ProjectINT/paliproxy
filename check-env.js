#!/usr/bin/env node
// Проверка версии Node.js и возможностей запуска TypeScript

const fs = require('fs');
const path = require('path');

console.log('🔍 PaliVPN Environment Check');
console.log('============================');

// Проверка версии Node.js
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
console.log(`📦 Node.js version: ${nodeVersion}`);

if (majorVersion >= 20) {
    console.log('✅ Node.js version is compatible for native TypeScript support');
} else if (majorVersion >= 18) {
    console.log('⚠️  Node.js version supports tsx but lacks native TypeScript support');
} else {
    console.log('❌ Node.js version is too old. Please upgrade to Node.js 18+');
}

// Проверка наличия tsx
try {
    const tsxPath = require.resolve('tsx');
    console.log(`✅ tsx is installed: ${tsxPath}`);
} catch {
    console.log('❌ tsx is not installed. Run: npm install tsx');
}

// Проверка наличия TypeScript
try {
    const tscPath = require.resolve('typescript');
    console.log(`✅ TypeScript is installed: ${tscPath}`);
} catch {
    console.log('❌ TypeScript is not installed. Run: npm install typescript');
}

// Проверка конфигурации
const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
    console.log('✅ tsconfig.json found');
} else {
    console.log('⚠️  tsconfig.json not found');
}

console.log('\n🚀 Recommended commands:');
console.log('  npm start        # Run with tsx (recommended)');
console.log('  npm run dev      # Development mode with watch');
console.log('  npm run build    # Compile TypeScript');
console.log('  npm test         # Run tests');

console.log('\n🔧 Alternative commands:');
if (majorVersion >= 20) {
    console.log('  npm run start:native    # Use Node.js native TS support (experimental)');
}
console.log('  npm run start:compiled  # Use compiled JS version');
