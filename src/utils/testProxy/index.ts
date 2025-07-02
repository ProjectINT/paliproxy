import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';

// Import ProxyBase type
type ProxyBase = {
    ip: string;
    port: number;
    user: string;
    pass: string;
};

const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'https://httpbin.org/ip';
const timeout = parseInt(process.env.TIMEOUT || '5000', 10);

export const testProxy = async (proxy: ProxyBase): Promise<{ latency: number; alive: boolean }> => {
  const agent = new SocksProxyAgent(`socks5://${proxy.user}:${proxy.pass}@${proxy.ip}:${proxy.port}`) as https.Agent;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = Date.now();

    const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
      const req = https.get(HEALTH_CHECK_URL, {
        agent,
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        resolve({ statusCode: res.statusCode || 500 });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });

    const latency = Date.now() - startTime;

    clearTimeout(timeoutId);

    return {
      latency,
      alive: response.statusCode >= 200 && response.statusCode < 300
    };
  } catch (error) {
    console.log('error', error); // TODO figure out with exception
    clearTimeout(timeoutId);
    return {
      latency: timeout,
      alive: false
    };
  }
};
