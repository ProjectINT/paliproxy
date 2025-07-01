// Utility to make HTTP requests via SOCKS5 proxy
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import http from 'http';
import { errorCodes, errorMessages } from './errorCodes';

type ResponseData = {
    status: number | undefined; // TODO figure out why this is undefined sometimes
    headers: http.IncomingHttpHeaders;
    body: string;
}

export async function proxyRequest(config: RequestConfig, proxy: ProxyConfig): Promise<ResponseData> {
  const { url, method = 'GET', headers = {}, body } = config;

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
        errorCode: errorCodes.REQUEST_FAILED,
        error: err,
        config,
        proxy
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        message: errorMessages[errorCodes.REQUEST_TIMEOUT],
        errorCode: errorCodes.REQUEST_TIMEOUT,
        error: new Error('Request timed out'),
        config,
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
          config,
          proxy
        });
      }
    }

    req.end();
  });
}
