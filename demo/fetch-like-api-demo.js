#!/usr/bin/env node

// Демонстрация нового fetch-like API для ProxyManager
// Run: node demo/fetch-like-api-demo.js

const { ProxyManager } = require('../dist');
const { proxiesList } = require('../proxies-list');

async function main() {
  console.log('🚀 Демонстрация fetch-like API для ProxyManager\n');

  const manager = new ProxyManager(proxiesList, {
    config: {
      healthCheckUrl: 'https://api.ipify.org',
      healthCheckInterval: 30000,
      maxTimeout: 10000,
      changeProxyLoop: 2
    }
  });

  console.log('📝 Примеры использования:\n');

  try {
    // Пример 1: Простой GET запрос (как fetch)
    console.log('1️⃣ Простой GET запрос:');
    const response1 = await manager.request('https://api.ipify.org');
    const ip = await response1.text();
    console.log(`   IP: ${ip.trim()}\n`);

    // Пример 2: GET с опциями (как fetch)
    console.log('2️⃣ GET с заголовками:');
    const response2 = await manager.request('https://ifconfig.me/ip', {
      method: 'GET',
      headers: {
        'User-Agent': 'ProxyManager-Demo/1.0'
      }
    });
    const ip2 = await response2.text();
    console.log(`   IP: ${ip2.trim()}\n`);

    // Пример 3: POST запрос с JSON (как fetch)
    console.log('3️⃣ POST запрос с JSON:');
    const response3 = await manager.request('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello from ProxyManager!',
        timestamp: new Date().toISOString()
      })
    });
    const result = await response3.json();
    console.log(`   ✅ POST успешен! Получен JSON с ${Object.keys(result).length} ключами\n`);

    // Пример 4: Проверка статуса ответа (как fetch)
    console.log('4️⃣ Проверка статуса ответа:');
    const response4 = await manager.request('https://httpbin.org/status/200');
    console.log(`   Status: ${response4.status} ${response4.statusText}`);
    console.log(`   OK: ${response4.ok}\n`);

    console.log('🎉 Все примеры выполнены успешно!');
    console.log('\n💡 Теперь ProxyManager можно использовать как замену fetch():');
    console.log('   fetch(url, options) -> manager.request(url, options)');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    manager.stop();
    process.exit(0);
  }
}

main().catch(console.error);
