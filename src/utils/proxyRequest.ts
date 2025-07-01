// Utility to make HTTP requests via SOCKS5 proxy
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import http from 'http';
import { errorCodes, errorMessages } from './errorCodes';

type NodeError = Error & { code?: string };

export async function proxyRequest(config: RequestConfig, proxy: ProxyConfig): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = config;

    const isHttps = url.startsWith('https://');
    const agent = new SocksProxyAgent(`socks5://${proxy.user}:${proxy.pass}@${proxy.ip}:${proxy.port}`) as unknown as (http.Agent | https.Agent);
    const lib = isHttps ? https : http;

    return new Promise((resolve, reject) => {
        const req = lib.request(url, {
            method,
            headers,
            agent,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (err) => {
          reject({
            message: errorMessages[errorCodes.REQUEST_FAILED],
            error: err.message,
            code: (err as NodeError).code || 'UNKNOWN',
            stack: (err as NodeError).stack,
            config,
            proxy,
          });
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject({
            message: errorMessages[errorCodes.REQUEST_TIMEOUT],
            config,
            proxy,
          });
        });
        
        if (body) {
          try {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
          } catch (err) {
            reject({
              message: errorMessages[errorCodes.REQUEST_BODY_ERROR],
              err,
              code: (err as NodeError).code,
              stack: (err as NodeError).stack,
              config,
              proxy,
            });
          }
        }
        
        req.end();
    });
}
