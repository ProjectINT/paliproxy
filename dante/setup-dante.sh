#!/bin/bash

set -e

# === Default Settings ===
USERNAME="proxyuser"
PORT=1080
INTERFACE="eth0"
CONF_PATH="/etc/danted.conf"

# === Reading password from argument ===
if [ -z "$1" ]; then
  echo "❌ Error: specify password as argument:"
  echo "Example: bash setup-danted.sh yourSuperSecretPassword"
  exit 1
fi
PASSWORD="$1"

echo "[1/6] Installing dante-server package..."
sudo apt update
sudo apt install -y dante-server

echo "[2/6] Creating user $USERNAME..."
if ! id "$USERNAME" &>/dev/null; then
    sudo useradd -M -s /usr/sbin/nologin "$USERNAME"
fi
echo "$USERNAME:$PASSWORD" | sudo chpasswd

echo "[3/6] Creating config $CONF_PATH..."
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

echo "[4/6] Restarting service..."
sudo systemctl restart danted
sudo systemctl enable danted

echo "[5/6] Setting up ufw (if installed)..."
if command -v ufw &>/dev/null; then
    sudo ufw allow $PORT/tcp || true
fi

echo "[6/6] Done!"
IP=$(curl -s https://api.ipify.org || echo "SERVER_IP")
echo ""
echo "✅ SOCKS5 proxy started at:"
echo "   ip: $IP"
echo "   port: $PORT"
echo "   user: $USERNAME"
echo "   pass: $PASSWORD"
