# 🔒 Dante SOCKS5 Proxy Setup

Automatic SOCKS5 proxy server installation using Dante on Ubuntu/Debian.

## 🚀 Quick Start

### Remote Installation
```bash
ssh root@255.255.255.255 'bash -s' < ./dante/setup-dante.sh "your pass"
```

### Local Installation
```bash
chmod +x setup-dante.sh
sudo ./setup-dante.sh yourSecretPassword
```

## ⚙️ What the Script Does

1. **Package Installation** - dante-server
2. **User Creation** - `proxyuser` with specified password
3. **Configuration** - creating `/etc/danted.conf`
4. **Service Startup** - autostart danted
5. **Firewall Setup** - opening port 1080
6. **Data Output** - IP, port, login, password

## 🔧 Default Settings

| Parameter | Value |
|-----------|-------|
| Port | 1080 |
| User | proxyuser |
| Interface | eth0 |
| Protocols | TCP, UDP |

## 📋 Requirements

- Ubuntu/Debian with sudo privileges
- Internet access
- Port 1080 available

## 🔐 Proxy Connection

After installation, use these credentials to connect:
- **Host:** Your server IP
- **Port:** 1080
- **Type:** SOCKS5
- **Username:** proxyuser
- **Password:** your password

## ⚠️ Security

- Use strong passwords
- Consider restricting access by IP
- Regularly update the system

## 📝 Logs

Service logs can be viewed with:
```bash
sudo journalctl -u danted -f
```


