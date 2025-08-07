import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import { type IncomingMessage } from 'http';

export type ProxyBase = {
  ip: string;
  port: number;
  user: string;
  pass: string;
};

const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'https://httpbin.org/ip';
const timeout = parseInt(process.env.TIMEOUT || '5000', 10);

const isStatusCodeValid = (statusCode?: number): boolean => {
  return statusCode !== undefined && statusCode >= 200 && statusCode < 300;
};

export const testProxy = async (proxy: ProxyBase): Promise<{ latency: number; alive: boolean }> => {
  const agent = new SocksProxyAgent(
    `socks5://${encodeURIComponent(proxy.user)}:${encodeURIComponent(proxy.pass)}@${proxy.ip}:${proxy.port}`
  );
  const controller = new AbortController();
  const start = Date.now();

  try {
    const res = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = https.get(
        HEALTH_CHECK_URL,
        {
          agent: agent as unknown as https.Agent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: controller.signal,
          timeout
        },
        resolve
      );
      req.on('error', reject);
    });

    res.resume(); // гарантированно освобождаем сокет
    return { latency: Date.now() - start, alive: isStatusCodeValid(res.statusCode) };
  } catch (e) {
    controller.abort(); // гарантированно прерываем запрос
    if (!process.env.SUPPRESS_PROXY_ERRORS) {
      console.error('Proxy error:', e);
    }
    return { latency: timeout, alive: false };
  }
};
