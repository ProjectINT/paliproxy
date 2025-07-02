# TTS ReadableStream Test

Этот тест проверяет функциональность ReadableStream с помощью OpenAI Text-to-Speech API через ProxyManager.

## Описание

Тест выполняет следующие операции:

1. **Конфигурация**: Использует ProxyManager для маршрутизации запросов через прокси
2. **TTS запрос**: Отправляет POST запрос к OpenAI TTS API с тестовым текстом
3. **ReadableStream обработка**: Получает ответ как ArrayBuffer и конвертирует в Buffer
4. **Валидация MP3**: Проверяет корректность формата MP3 файла
5. **Сохранение файла**: Записывает аудио файл на диск для ручной проверки

## Требования

- Переменная окружения `CHAT_GPT_API_KEY` должна содержать валидный OpenAI API ключ
- Рабочие прокси в `proxies-list.js`
- Собранный проект (`npm run build`)

## Запуск

```bash
# Стандартный запуск
node tests/tts-readablestream-test.js

# Или через npm script
npm run test:tts
```

## Что проверяет тест

### ReadableStream функциональность
- ✅ Успешный запрос к OpenAI TTS API через прокси
- ✅ Получение бинарных данных как ArrayBuffer
- ✅ Конвертация ArrayBuffer в Buffer
- ✅ Валидация MP3 формата по заголовкам файла

### Технические детали
- **Модель**: `tts-1` (быстрая модель TTS)
- **Голос**: `nova` (женский голос)
- **Формат**: `mp3` (сжатый аудио формат)
- **Тестовый текст**: "Hello, this is a test of the OpenAI Text-to-Speech API using proxy connection."

### Валидация MP3
Тест проверяет корректность MP3 файла двумя способами:
1. **ID3v2 тег**: Проверка заголовка "ID3"
2. **MPEG заголовок**: Поиск sync-паттерна 0xFF + 0xF*

### Вывод
- 📊 Статус ответа и заголовки
- 📏 Размер аудио файла в человекочитаемом формате
- 🎵 Результат валидации MP3
- 💾 Путь к сохраненному файлу
- 📊 Информация о файле (размер, время создания)

## Результат

После успешного выполнения теста в папке `logs/` будет создан MP3 файл с именем формата:
```
tts-test-YYYY-MM-DDTHH-MM-SS-MMMZ.mp3
```

Этот файл можно воспроизвести в любом аудиоплеере для проверки качества звука.

## Пример успешного вывода

```
🎵 Testing OpenAI TTS API with ProxyManager...

📝 Text to convert: Hello, this is a test of the OpenAI Text-to-Speech API using proxy connection.
🔊 Voice: nova
📁 Format: mp3

🌐 Making TTS request through proxy...
📊 Response status: 200
📋 Response headers: { ... }
✅ TTS request successful!

🔄 Testing ReadableStream conversion...
📏 Audio buffer size: 93.28 KB
🎵 Valid MP3 format: ✅ Yes
💾 Audio file saved to: /home/yura/palivpn/logs/tts-test-2025-07-02T20-47-59-076Z.mp3
📊 File info:
  - Size: 93.28 KB
  - Created: 2025-07-02T20:47:59.075Z

🎉 TTS ReadableStream test completed successfully!
🎧 You can now play the saved MP3 file to verify audio quality.
```
