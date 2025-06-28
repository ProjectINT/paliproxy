import { VPNManager } from './src/manager.js';
import { AppConfig, VPNConfig } from './src/types.js';

const testVPNs: VPNConfig[] = [
    { name: 'vpn1', type: 'openvpn', config: 'config1', priority: 1, active: false },
    { name: 'vpn2', type: 'openvpn', config: 'config2', priority: 2, active: false },
    { name: 'vpn3', type: 'openvpn', config: 'config3', priority: 3, active: false }
];

const testConfig: AppConfig = {
    vpnConfigsPath: './test-configs',
    defaultVpnTimeout: 10000,
    maxReconnectAttempts: 3,
    healthCheckInterval: 10000,
    healthCheckUrl: 'https://httpbin.org/ip',
    healthCheckTimeout: 5000,
    httpTimeout: 10000,
    userAgent: 'PaliVPN-Test/1.0',
    logLevel: 'debug',
    nodeEnv: 'test',
    vpnConfigs: testVPNs
};

async function testConcurrentFix() {
    console.log('Testing concurrent connections fix...');
    
    const manager = new VPNManager(testConfig);
    
    // Mock the connection methods to avoid real VPN operations
    (manager as any).establishVPNConnection = async (vpn: VPNConfig) => {
        console.log(`Mock connecting to ${vpn.name}...`);
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log(`Mock connected to ${vpn.name}`);
    };
    
    (manager as any).verifyConnection = async (vpn: VPNConfig) => {
        console.log(`Mock verifying ${vpn.name}...`);
    };
    
    (manager as any).terminateVPNConnection = async (vpn: VPNConfig) => {
        console.log(`Mock disconnecting ${vpn.name}...`);
    };
    
    await manager.initialize();
    
    console.log('Starting concurrent connections...');
    
    // Start three connections in parallel
    const promises = [
        manager.connect(testVPNs[0]),
        manager.connect(testVPNs[1]), 
        manager.connect(testVPNs[2])
    ];
    
    try {
        await Promise.all(promises);
        console.log('✅ All connections completed!');
        
        const status = manager.getStatus();
        const activeVPNs = status.vpnList.filter(v => v.active);
        console.log(`Active VPNs: ${activeVPNs.length} (should be 1)`);
        console.log(`Active VPN: ${activeVPNs[0]?.name}`);
        
    } catch (error) {
        console.error('❌ Error during concurrent connections:', error);
    }
}

testConcurrentFix().catch(console.error);
