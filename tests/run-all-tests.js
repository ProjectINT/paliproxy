#!/usr/bin/env node

/**
 * Управляющий файл для запуска всех тестов proxy-connection
 * Запускает все тесты последовательно и выводит общий отчет
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Список тестов для запуска
const tests = [
  {
    name: 'Базовый тест прокси',
    file: 'proxy-basic-test.js',
    description: 'Основной тест функциональности ProxyManager'
  },
  {
    name: 'Отладочный тест прокси',
    file: 'proxy-debug-test.js',
    description: 'Детальный отладочный тест с расширенным логированием'
  },
  {
    name: 'Тест отказоустойчивости',
    file: 'proxy-failover-test.js',
    description: 'Тест переключения между прокси при сбоях'
  },
  {
    name: 'Тест отказоустойчивости с паролем',
    file: 'proxy-failover-password-test.js',
    description: 'Тест переключения прокси с аутентификацией'
  },
  {
    name: 'Проверка здоровья прокси',
    file: 'health-check-test.js',
    description: 'Тест системы мониторинга состояния прокси'
  },
  {
    name: 'Тест API запросов',
    file: 'request-api-test.js',
    description: 'Тест fetch-like API для работы с запросами'
  },
  {
    name: 'Быстрый интеграционный тест',
    file: 'quick-integration-test.js',
    description: 'Быстрая проверка основных компонентов'
  },
  {
    name: 'Тест пакета',
    file: 'test-package.js',
    description: 'Тест установленного npm пакета'
  },
  {
    name: 'Тест TTS ReadableStream',
    file: 'tts-readablestream-test.js',
    description: 'Тест работы с потоковыми данными через прокси'
  }
];

// Функция для очистки логов
function cleanLogs() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
  logFiles.forEach(file => {
    const filePath = path.join(logsDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`${colors.yellow}🗑️  Очищен лог: ${file}${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}❌ Не удалось удалить лог ${file}: ${err.message}${colors.reset}`);
    }
  });
}

// Функция для запуска отдельного теста
function runTest(test) {
  const testPath = path.join(__dirname, test.file);

  if (!fs.existsSync(testPath)) {
    console.log(`${colors.red}❌ Тест файл не найден: ${test.file}${colors.reset}`);
    return { success: false, error: 'Файл не найден' };
  }

  console.log(`\n${colors.cyan}📋 ${test.name}${colors.reset}`);
  console.log(`${colors.blue}   ${test.description}${colors.reset}`);
  console.log(`${colors.yellow}🔧 Запуск: ${test.file}${colors.reset}`);

  try {
    const startTime = Date.now();
    execSync(`node "${testPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    const duration = Date.now() - startTime;

    console.log(`${colors.green}✅ Тест завершен успешно (${duration}ms)${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    console.log(`${colors.red}❌ Тест завершился с ошибкой${colors.reset}`);
    return { success: false, error: error.message };
  }
}

// Основная функция
function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 ЗАПУСК ВСЕХ ТЕСТОВ PROXY-CONNECTION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  // Проверка переменных окружения
  console.log(`${colors.yellow}🔍 Проверка переменных окружения...${colors.reset}`);
  const requiredEnvVars = ['PROXY_LIST_PATH', 'TEST_URLS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(`${colors.red}⚠️  Отсутствуют переменные окружения: ${missingVars.join(', ')}${colors.reset}`);
    console.log(`${colors.yellow}💡 Убедитесь, что вы создали .env файл с необходимыми переменными${colors.reset}`);
    console.log(`${colors.blue}📖 Подробности в README.md${colors.reset}`);
  }

  // Проверка списка прокси
  const proxyListPath = path.join(__dirname, '..', 'proxies-list.js');
  if (!fs.existsSync(proxyListPath)) {
    console.log(`${colors.red}⚠️  Файл со списком прокси не найден: proxies-list.js${colors.reset}`);
    console.log(`${colors.yellow}💡 Создайте файл с рабочими прокси для корректной работы тестов${colors.reset}`);
  }

  console.log(`${colors.green}✅ Предварительная проверка завершена${colors.reset}\n`);

  // Очистка логов
  console.log(`${colors.yellow}🧹 Очистка предыдущих логов...${colors.reset}`);
  cleanLogs();    // Запуск тестов
  const results = [];
  const startTime = Date.now();

  for (const test of tests) {
    const result = runTest(test);
    results.push({ test, result });

    // Пауза между тестами
    if (test !== tests[tests.length - 1]) {
      console.log(`${colors.blue}⏸️  Пауза 2 секунды...${colors.reset}`);
      execSync('sleep 2');
    }
  }

  // Отчет о результатах
  const overallDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.result.success).length;
  const failCount = results.length - successCount;

  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 ОТЧЕТ О РЕЗУЛЬТАТАХ ТЕСТОВ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  console.log(`${colors.green}✅ Успешно: ${successCount}${colors.reset}`);
  console.log(`${colors.red}❌ Неудачно: ${failCount}${colors.reset}`);
  console.log(`${colors.blue}⏱️  Общее время: ${overallDuration}ms${colors.reset}`);

  console.log(`\n${colors.cyan}📋 Детальные результаты:${colors.reset}`);
  results.forEach(({ test, result }) => {
    const status = result.success ?
      `${colors.green}✅ УСПЕХ${colors.reset}` :
      `${colors.red}❌ ОШИБКА${colors.reset}`;
    const duration = result.duration ? ` (${result.duration}ms)` : '';

    console.log(`   ${status} ${test.name}${duration}`);
    if (!result.success && result.error) {
      console.log(`     ${colors.red}└─ ${result.error}${colors.reset}`);
    }
  });

  console.log(`\n${colors.yellow}📂 Логи сохранены в папке logs/${colors.reset}`);

  // Код выхода
  const exitCode = failCount > 0 ? 1 : 0;
  if (exitCode === 0) {
    console.log(`\n${colors.green}🎉 Все тесты выполнены успешно!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}💥 Некоторые тесты завершились с ошибками${colors.reset}`);
  }

  process.exit(exitCode);
}

// Запуск если файл вызван напрямую
if (require.main === module) {
  main();
}

module.exports = { main, runTest, cleanLogs };
