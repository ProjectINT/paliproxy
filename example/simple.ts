#!/usr/bin/env node

/**
 * Простой пример использования PaliVPN класса
 * Показывает основные возможности работы с VPN и выполнения запросов
 */

import PaliVPN from '../src/index';

async function simpleExample() {
    console.log('🚀 Запуск PaliVPN простого примера...\n');
    
    // Создаем экземпляр клиента
    const vpnClient = new PaliVPN();

    try {
        console.log('📡 Проверка IP адреса через VPN...');
        
        // Простой GET запрос для проверки IP
        const ipResponse = await vpnClient.request({
            url: 'https://httpbin.org/ip'
        });
        
        const ipData = await ipResponse.json() as { origin: string };
        console.log('✅ Ваш IP через VPN:', ipData.origin);
        console.log('');

        // Проверка заголовков
        console.log('🔍 Проверка HTTP заголовков...');
        const headersResponse = await vpnClient.request({
            url: 'https://httpbin.org/headers',
            headers: {
                'X-Custom-Header': 'PaliVPN-Test',
                'User-Agent': 'PaliVPN-Example/1.0'
            }
        });
        
        const headersData = await headersResponse.json() as { headers: Record<string, string> };
        console.log('✅ Заголовки запроса:', JSON.stringify(headersData.headers, null, 2));
        console.log('');

        // POST запрос с данными
        console.log('📤 Отправка POST запроса...');
        const postResponse = await vpnClient.request({
            url: 'https://httpbin.org/post',
            method: 'POST',
            body: {
                message: 'Привет от PaliVPN!',
                timestamp: new Date().toISOString(),
                test: true
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const postData = await postResponse.json() as { json: any };
        console.log('✅ Ответ сервера на POST:', JSON.stringify(postData.json, null, 2));
        console.log('');

        // Проверка статуса VPN
        console.log('📊 Статус VPN соединения...');
        console.log('Подключен:', vpnClient.isConnected);
        console.log('Текущий VPN:', vpnClient.currentVPN?.name || 'Нет активного VPN');
        
    } catch (error) {
        console.error('❌ Ошибка при выполнении запроса:', error);
    } finally {
        console.log('\n🛑 Остановка VPN клиента...');
        await vpnClient.stop();
        console.log('✅ VPN клиент остановлен.');
    }
}

// Запускаем пример, если файл запущен напрямую
if (require.main === module) {
    simpleExample().catch(error => {
        console.error('💥 Критическая ошибка:', error);
        process.exit(1);
    });
}

export { simpleExample };
