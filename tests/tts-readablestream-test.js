// TTS ReadableStream Test: Test OpenAI TTS API with ProxyManager and ReadableStream functionality
// Run: node tests/tts-readablestream-test.js

require('dotenv').config();
const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');
const fs = require('fs');
const path = require('path');

// ProxyManager configuration for testing
const manager = new ProxyManager(proxiesList, {
  config: {
    healthCheckUrl: 'https://api.ipify.org',
    healthCheckInterval: 30000,
    maxTimeout: 15000,
    changeProxyLoop: 2
  }
});

// Function to validate MP3 file
function isValidMP3Buffer(buffer) {
  // Check MP3 header (ID3v2 or MPEG audio frame sync)
  if (buffer.length < 3) {
    return false;
  }

  // Check for ID3v2 tag (starts with "ID3")
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return true;
  }

  // Check for MPEG audio frame sync (0xFF followed by 0xF*)
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === 0xFF && (buffer[i + 1] & 0xF0) === 0xF0) {
      return true;
    }
  }

  return false;
}

// Function to get file size in a human-readable format
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function testTTSAPI() {
  console.log('🎵 Testing OpenAI TTS API with ProxyManager...\n');

  const apiKey = process.env.CHAT_GPT_API_KEY;
  if (!apiKey) {
    console.error('❌ CHAT_GPT_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Test text for TTS conversion
  const testText = 'Hello, this is a test of the OpenAI Text-to-Speech API using proxy connection.';

  try {
    console.log('📝 Text to convert:', testText);
    console.log('🔊 Voice: nova');
    console.log('📁 Format: mp3\n');

    console.log('🌐 Making TTS request through proxy...');

    const ttsRes = await manager.request('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: testText,
        voice: 'nova',
        response_format: 'mp3'
      })
    });

    console.log('📊 Response status:', ttsRes.status);
    console.log('📋 Response headers:', ttsRes.headers);

    if (!ttsRes.ok) {
      const errorText = await ttsRes.text();
      console.error('❌ OpenAI TTS error:', errorText);
      return;
    }

    console.log('✅ TTS request successful!\n');

    // Test ReadableStream functionality
    console.log('🔄 Testing ReadableStream conversion...');

    const arrayBuffer = await ttsRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('📏 Audio buffer size:', formatFileSize(buffer.length));

    // Validate MP3 format
    const isValidMP3 = isValidMP3Buffer(buffer);
    console.log('🎵 Valid MP3 format:', isValidMP3 ? '✅ Yes' : '❌ No');

    if (!isValidMP3) {
      console.error('❌ Received data is not a valid MP3 file');
      return;
    }

    // Save to disk for manual verification
    const outputDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `tts-test-${timestamp}.mp3`);

    fs.writeFileSync(outputPath, buffer);
    console.log('💾 Audio file saved to:', outputPath);

    // Additional file info
    const stats = fs.statSync(outputPath);
    console.log('📊 File info:');
    console.log('  - Size:', formatFileSize(stats.size));
    console.log('  - Created:', stats.birthtime.toISOString());

    console.log('\n🎉 TTS ReadableStream test completed successfully!');
    console.log('🎧 You can now play the saved MP3 file to verify audio quality.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.code) {
      console.error('   Error code:', error.code);
    }

    if (error.stack) {
      console.error('   Stack trace:', error.stack);
    }
  }
}

async function main() {
  try {
    await testTTSAPI();
  } catch (error) {
    console.error('❌ Main test failed:', error);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    process.exit(0);
  }
}

// Run the test
main().catch(console.error);
