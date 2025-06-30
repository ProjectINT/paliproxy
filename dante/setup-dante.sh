#!/bin/bash

set -e

# === Настройки по умолчанию ===
USERNAME="proxyuser"
PORT=1080
INTERFACE="eth0"
CONF_PATH="/etc/danted.conf"

# === Чтение пароля из аргумента ===
if [ -z "$1" ]; then
  echo "❌ Ошибка: укажи пароль в качестве аргумента:"
  echo "Пример: bash setup-danted.sh yourSuperSecretPassword"
  exit 1
fi
PASSWORD="$1"

echo "[1/6] Установка пакета dante-server..."
sudo apt update
sudo apt install -y dante-server

echo "[2/6] Создание пользователя $USERNAME..."
if ! id "$USERNAME" &>/dev/null; then
    sudo useradd -M -s /usr/sbin/nologin "$USERNAME"
fi
echo "$USERNAME:$PASSWORD" | sudo chpasswd

echo "[3/6] Создание конфига $CONF_PATH..."
sudo bash -c "cat > $CONF_PATH" <<EOF
logoutput: stderr

internal: $INTERFACE port = $PORT
external: $INTERFACE

socksmethod: username
user.notprivileged: nobody

client pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect disconnect error
}

pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    protocol: tcp udp
    log: connect disconnect error
}
EOF

echo "[4/6] Перезапуск сервиса..."
sudo systemctl restart danted
sudo systemctl enable danted

echo "[5/6] Настройка ufw (если установлен)..."
if command -v ufw &>/dev/null; then
    sudo ufw allow $PORT/tcp || true
fi

echo "[6/6] Готово!"
IP=$(curl -s https://api.ipify.org || echo "SERVER_IP")
echo ""
echo "✅ SOCKS5-прокси запущен на:"
echo "   ip: $IP"
echo "   port: $PORT"
echo "   user: $USERNAME"
echo "   pass: $PASSWORD"
