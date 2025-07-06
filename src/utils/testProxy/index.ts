import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import { ClientRequest } from 'http';

type ProxyBase = {
  ip: string;
  port: number;
  user: string;
  pass: string;
};

const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'https://httpbin.org/ip';
const timeout = parseInt(process.env.TIMEOUT || '5000', 10);

export const testProxy = async (proxy: ProxyBase): Promise<{ latency: number; alive: boolean }> => {
  const agent = new SocksProxyAgent(`socks5://${proxy.user}:${proxy.pass}@${proxy.ip}:${proxy.port}`);

  const controller = new AbortController();
  let req: ClientRequest | null = null;

  const timeoutId = setTimeout(() => {
    controller.abort(); // сигнализируем отмену
    req?.destroy(new Error('Request aborted by timeout'));
  }, timeout);

  try {
    const startTime = Date.now();

    const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
      req = https.get(HEALTH_CHECK_URL, {
        agent: agent as https.Agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        resolve({ statusCode: res.statusCode || 500 });
      });

      req.on('error', reject);
    });

    const latency = Date.now() - startTime;
    clearTimeout(timeoutId);

    return {
      latency,
      alive: response.statusCode >= 200 && response.statusCode < 300
    };
  } catch (error) {
    if (!process.env.SUPPRESS_PROXY_ERRORS) {
      console.log('Proxy error:', error);
    }
    clearTimeout(timeoutId);
    return {
      latency: timeout,
      alive: false
    };
  }
};
