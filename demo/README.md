# ProxyManager Demo

Эта папка содержит демонстрационные скрипты для ProxyManager.

## fetch-like-api-demo.js

Демонстрирует новый fetch-like API для ProxyManager.

### Запуск

```bash
node demo/fetch-like-api-demo.js
```

### Примеры использования

ProxyManager теперь поддерживает синтаксис, совместимый с fetch API:

```javascript
// Простой GET запрос
const response = await manager.request('https://api.ipify.org');
const text = await response.text();

// GET с опциями
const response = await manager.request('https://ifconfig.me/ip', {
  method: 'GET',
  headers: {
    'User-Agent': 'MyApp/1.0'
  }
});

// POST с JSON
const response = await manager.request('https://httpbin.org/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' })
});

// Проверка статуса
if (response.ok) {
  const data = await response.json();
  console.log(data);
}
```

### Преимущества

- 🔄 **Совместимость с fetch**: Можно легко заменить `fetch()` на `manager.request()`
- 🌐 **Автоматические прокси**: Все запросы автоматически идут через прокси
- 🔧 **Управление ошибками**: Автоматическое переключение между прокси при ошибках
- 📊 **Мониторинг**: Встроенное логирование и мониторинг
