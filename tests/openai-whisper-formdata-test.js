// OpenAI Whisper API + ProxyManager FormData integration test
require('dotenv').config();
const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

console.log('🎵 OpenAI Whisper API + ProxyManager FormData test\n');

// Create ProxyManager with longer timeout for audio processing
const manager = new ProxyManager(proxiesList, {
  config: {
    maxTimeout: 60000, // 60 seconds for audio processing
    healthCheckInterval: 120000,
    changeProxyLoop: 2
  }
});

async function test() {
  try {
    console.log('🔧 Testing audio download and transcription through proxy...');

    // Test audio URL
    const audioUrl = 'https://qfnbybdhzjnhbyncvady.supabase.co/storage/v1/object/public/egesto-public/public/1751742770058.mp3';

    console.log('📥 Downloading audio file...');

    // Download audio using ProxyManager
    const audioRes = await manager.request(audioUrl);
    if (!audioRes.ok) {
      console.error('Failed to download audio', await audioRes.text());
      throw new Error('Failed to download audio');
    }

    console.log(`✅ Audio downloaded successfully (status: ${audioRes.status})`);

    // Get audio data
    const arrayBuffer = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';

    console.log(`📊 Audio size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🎵 Content type: ${contentType}`);

    // Create File object
    const file = new File([arrayBuffer], 'audio.mp3', { type: contentType });

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    console.log('🎙️ Sending to OpenAI Whisper API...');

    // Send to OpenAI Whisper API using ProxyManager
    const openAiRes = await manager.request('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHAT_GPT_API_KEY}`
      },
      body: formData
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAiRes.status} ${openAiRes.statusText}`);
    }

    const transcription = await openAiRes.json();

    console.log('✅ SUCCESS!');
    console.log('🎉 ProxyManager works with FormData and OpenAI Whisper API');
    console.log('📝 Transcription result:');
    console.log(`"${transcription.text}"`);

    // Additional validation
    if (transcription.text && transcription.text.length > 0) {
      console.log('✅ Transcription contains text - test passed!');
    } else {
      console.log('⚠️ Transcription is empty - may indicate an issue');
    }

    // Stop ProxyManager to prevent hanging
    manager.stop();
    process.exit(0);

  } catch (error) {
    console.log('❌ Error:', error.message);

    // Additional error context
    if (error.message.includes('Connection error')) {
      console.log('💡 This may be due to proxy connectivity issues');
    } else if (error.message.includes('401')) {
      console.log('💡 Check your CHAT_GPT_API_KEY in .env file');
    } else if (error.message.includes('429')) {
      console.log('💡 Rate limit exceeded - try again later');
    }

    // Stop ProxyManager to prevent hanging
    manager.stop();
    process.exit(1);
  }
}

// Run test
test().catch(console.error);
