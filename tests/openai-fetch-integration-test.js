// Simple OpenAI + ProxyManager integration test
require('dotenv').config();
const OpenAI = require('openai').default;
const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

console.log('🤖 Simple OpenAI SDK + ProxyManager test\n');

// Create ProxyManager
const manager = new ProxyManager(proxiesList);

// Create OpenAI client with our proxy fetch - теперь Headers обрабатываются автоматически!
const openai = new OpenAI({
  apiKey: process.env.CHAT_GPT_API_KEY,
  fetch: manager.request.bind(manager)
});

async function test() {
  try {
    console.log('🔧 Testing OpenAI through proxy...');

    // Simple test - list models
    const models = await openai.models.list();

    console.log('✅ SUCCESS!');
    console.log(`📊 Found ${models.data.length} models`);
    console.log('🎉 ProxyManager works as fetch replacement in OpenAI SDK');
    console.log('🔑 Headers are now automatically converted from Headers object to plain object');

  } catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
