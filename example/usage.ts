import PaliVPN from '../src/index';

/**
 * Пример использования PaliVPN класса
 */
async function example() {
    // Создаем экземпляр клиента
    const vpnClient = new PaliVPN();

    try {
        // Выполняем запрос через VPN
        const response = await vpnClient.request({
            url: 'https://httpbin.org/ip',
            method: 'GET'
        });

        const data = await response.json();
        console.log('Response:', data);

        // Выполняем POST запрос
        const postResponse = await vpnClient.request({
            url: 'https://httpbin.org/post',
            method: 'POST',
            body: { message: 'Hello from PaliVPN!' },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const postData = await postResponse.json();
        console.log('POST Response:', postData);

    } catch (error) {
        console.error('Request failed:', error);
    } finally {
        // Останавливаем VPN клиент
        await vpnClient.stop();
    }
}

// Запускаем пример
if (require.main === module) {
    example().catch(console.error);
}

export { example };
