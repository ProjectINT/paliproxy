# CHANGELOG - Serverless Support

## Новая функциональность: Поддержка Serverless

### 🎯 Цель
Добавлена возможность использования PaliVPN в serverless функциях без необходимости чтения файловой системы. Теперь VPN конфигурации можно передавать напрямую при инициализации.

### 🔧 Изменения в коде

#### 1. Обновлен тип `AppConfig` (`src/types.ts`)
```typescript
export interface AppConfig {
    // ...existing fields...
    vpnConfigs?: VPNConfig[]; // Новое поле для предопределенных VPN конфигураций
}
```

#### 2. Обновлен конструктор `PaliVPN` (`src/index.ts`)
```typescript
constructor(config?: Partial<AppConfig>, vpnConfigs?: VPNConfig[])
```
- Добавлен второй параметр для передачи VPN конфигураций
- Если переданы VPN конфигурации, они добавляются в конфиг

#### 3. Добавлен статический метод `withVPNConfigs()` (`src/index.ts`)
```typescript
static withVPNConfigs(vpnConfigs: VPNConfig[], config?: Partial<AppConfig>): PaliVPN
```
- Удобный способ создания экземпляра с предопределенными конфигурациями

#### 4. Обновлен `VPNManager.loadVPNConfigs()` (`src/manager.ts`)
```typescript
private async loadVPNConfigs(): Promise<void> {
    // Если VPN конфигурации переданы в config, используем их
    if (this.config.vpnConfigs && this.config.vpnConfigs.length > 0) {
        this.vpnList = [...this.config.vpnConfigs];
        logger.info(`Using ${this.vpnList.length} provided VPN configurations`);
        return;
    }
    
    // Иначе загружаем из файловой системы (legacy режим)
    // ...
}
```

### 📁 Новые файлы

#### 1. `example/serverless.ts`
- Примеры использования в AWS Lambda, Vercel Edge Functions
- Демонстрация работы с переменными окружения
- Обработка ошибок в serverless контексте

#### 2. `SERVERLESS_EXAMPLES.md`
- Подробная документация по serverless использованию
- Примеры для разных платформ (AWS, Vercel, Netlify, Cloudflare)
- Конфигурационные паттерны и best practices

### 📝 Обновленная документация

#### 1. `README.md`
- Добавлен раздел "Serverless поддержка"
- Примеры использования в Lambda и Edge Functions

#### 2. `USAGE.md`
- Обновлен с информацией о новых методах
- Примеры serverless использования

#### 3. `example/usage.ts`
- Добавлены новые функции: `serverlessExample()`, `minimalExample()`
- Поддержка аргументов командной строки для выбора режима

#### 4. `package.json`
- Новые npm скрипты:
  - `npm run example:serverless`
  - `npm run example:minimal`
  - `npm run example:serverless-demo`

### 🎯 Способы использования

#### Способ 1: Статический метод (рекомендуется)
```typescript
const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs, config);
```

#### Способ 2: Через конструктор
```typescript
const vpnClient = new PaliVPN(config, vpnConfigs);
// или
const vpnClient = new PaliVPN({ vpnConfigs: vpnConfigs, ...config });
```

### ✅ Тестирование

Все новые функции протестированы:
- `npm run example:minimal` - успешно
- `npm run example:serverless` - успешно
- Проверка типов TypeScript - без ошибок

### 🚀 Преимущества

1. **Serverless ready** - работает в Lambda, Edge Functions и других serverless окружениях
2. **Без файловой системы** - VPN конфигурации передаются в памяти
3. **Обратная совместимость** - старый способ загрузки из файлов продолжает работать
4. **Гибкость** - поддержка переменных окружения и разных способов конфигурации
5. **Type Safety** - полная поддержка TypeScript

### 📋 Пример AWS Lambda

```typescript
const vpnConfigs = [
    {
        name: 'lambda-vpn',
        config: process.env.VPN_CONFIG!,
        priority: 1,
        active: false
    }
];

export const handler = async (event, context) => {
    const vpnClient = PaliVPN.withVPNConfigs(vpnConfigs);
    try {
        await vpnClient.initialize();
        const response = await vpnClient.request({ url: event.url });
        return { statusCode: 200, body: JSON.stringify(await response.json()) };
    } finally {
        await vpnClient.stop();
    }
};
```
