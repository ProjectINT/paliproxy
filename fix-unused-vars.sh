#!/bin/bash

# Исправляем неиспользуемые параметры в тестовых файлах

# manager.test.ts - исправляем все vpn параметры на _vpn
sed -i 's/async (vpn: VPNConfig)/async (_vpn: VPNConfig)/g' /home/yura/palivpn/src/tests/manager.test.ts
sed -i 's/start(vpnList: VPNConfig[])/start(_vpnList: VPNConfig[])/g' /home/yura/palivpn/src/tests/manager.test.ts
sed -i 's/async checkVPNHealth(vpn: VPNConfig)/async checkVPNHealth(_vpn: VPNConfig)/g' /home/yura/palivpn/src/tests/manager.test.ts

echo "Fixed manager.test.ts"
