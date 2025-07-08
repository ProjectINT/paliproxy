// FormData debugging test to understand the issue
require('dotenv').config();
const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

console.log('🔍 FormData Debug Test\n');

const manager = new ProxyManager(proxiesList, {
  config: {
    maxTimeout: 30000
  }
});

async function testFormDataHandling() {
  try {
    console.log('🧪 Testing FormData handling...');

    // Create simple FormData
    const formData = new FormData();
    formData.append('test', 'value');
    formData.append('number', '123');

    console.log('📝 FormData created:', {
      constructor: formData.constructor.name,
      isFormData: formData instanceof FormData,
      hasEntries: typeof formData.entries === 'function'
    });

    // Test with httpbin.org echo service
    console.log('🌐 Sending FormData to httpbin.org/post...');

    const response = await manager.request('https://httpbin.org/post', {
      method: 'POST',
      body: formData
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Response data:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Response error:', errorText);
    }

  } catch (error) {
    console.log('❌ Error in FormData test:', error.message);
    console.log('📍 Error details:', error);
  }
}

async function testFileUpload() {
  try {
    console.log('\n🗂️ Testing File upload...');

    // Create a simple text file
    const fileContent = 'This is a test file content for debugging';
    const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', 'Test file upload');

    console.log('📄 File created:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    const response = await manager.request('https://httpbin.org/post', {
      method: 'POST',
      body: formData
    });

    console.log('📊 File upload response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ File upload result:', JSON.stringify(result.files, null, 2));
      console.log('✅ Form data:', JSON.stringify(result.form, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ File upload error:', errorText);
    }

  } catch (error) {
    console.log('❌ Error in file upload test:', error.message);
    console.log('📍 Error details:', error);
  }
}

async function runTests() {
  await testFormDataHandling();
  await testFileUpload();
}

runTests().catch(console.error);
