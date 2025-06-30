// Utility to make HTTP requests via SOCKS5 proxy
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import http from 'http';

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
        
        req.on('error', reject);

        req.setTimeout(10000, () => {
          req.destroy();
          reject({
            message: 'Request timed out',
            config,
            proxy,
          });
        });
        
        if (body) {
          req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        
        req.end();
    });
}
