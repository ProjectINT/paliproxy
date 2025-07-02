// Utility to make HTTP requests via SOCKS5 proxy
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import http from 'http';
import { errorCodes, errorMessages } from './errorCodes';


export async function proxyRequest(requestConfig: RequestConfig, proxy: ProxyConfig): Promise<Response> {
  const { url, method = 'GET', headers = {}, body } = requestConfig;

  const isHttps = url.startsWith('https://');
  const agent = new SocksProxyAgent(`socks5://${proxy.user}:${proxy.pass}@${proxy.ip}:${proxy.port}`) as unknown as (http.Agent | https.Agent);
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(url, {
      method,
      headers,
      agent
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // fetch-like Response imitation
        resolve({
          ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: res.headers,
          url,
          redirected: false,
          type: 'default',
          clone() { return this; },
          // fetch API: .text(), .json(), .arrayBuffer(), .blob(), .formData()
          text: async () => data,
          json: async () => { try { return JSON.parse(data); } catch { return data; } },
          arrayBuffer: async () => Buffer.from(data)
          // Not implemented: blob, formData
        } as unknown as Response);
      });
    });

    req.on('error', (err) => {
      reject({
        message: errorMessages[errorCodes.REQUEST_FAILED],
        errorCode: errorCodes.REQUEST_FAILED,
        error: err,
        proxy
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        message: errorMessages[errorCodes.REQUEST_TIMEOUT],
        errorCode: errorCodes.REQUEST_TIMEOUT,
        error: new Error('Request timed out'),
        proxy
      });
    });

    if (body) {
      try {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      } catch (err) {
        reject({
          message: errorMessages[errorCodes.REQUEST_BODY_ERROR],
          errorCode: errorCodes.REQUEST_BODY_ERROR,
          error: err,
          proxy
        });
      }
    }

    req.end();
  });
}
