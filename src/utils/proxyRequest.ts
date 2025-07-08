// Utility to make HTTP requests via SOCKS5 proxy
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import http from 'http';
import { errorCodes, errorMessages } from './errorCodes';
import type { RequestConfig, ProxyConfig } from '../types';


export async function proxyRequest(requestConfig: RequestConfig, proxy: ProxyConfig): Promise<Response> {
  const { url, method = 'GET', headers = {}, body } = requestConfig;

  if (!url) {
    throw {
      message: 'URL is required',
      errorCode: errorCodes.REQUEST_BODY_ERROR,
      error: new Error('URL is required'),
      config: requestConfig,
      proxy
    };
  }

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
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
        // Only append to data string if content is text-based
        if (res.headers['content-type']?.includes('text') ||
            res.headers['content-type']?.includes('json') ||
            res.headers['content-type']?.includes('application/json')) {
          data += chunk;
        }
      });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);

        // For text content, use string data; for binary, use buffer
        const isTextContent = res.headers['content-type']?.includes('text') ||
                             res.headers['content-type']?.includes('json') ||
                             res.headers['content-type']?.includes('application/json');        if (!isTextContent && !data) {
          data = buffer.toString('utf8');
        }

        // Create ReadableStream from buffer
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(buffer));
            controller.close();
          }
        });

        // Create Headers-like object compatible with fetch API
        const createHeaders = (nodeHeaders: http.IncomingHttpHeaders) => {
          const headersMap = new Map<string, string>();
          for (const [key, value] of Object.entries(nodeHeaders)) {
            if (value !== undefined) {
              headersMap.set(key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
            }
          }

          return {
            get: (name: string) => headersMap.get(name.toLowerCase()) || null,
            has: (name: string) => headersMap.has(name.toLowerCase()),
            entries: () => headersMap.entries(),
            keys: () => headersMap.keys(),
            values: () => headersMap.values(),
            forEach: (callback: (value: string, key: string) => void) => headersMap.forEach(callback),
            [Symbol.iterator]: () => headersMap.entries()
          };
        };

        // fetch-like Response imitation
        const response = {
          ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: createHeaders(res.headers),
          url,
          redirected: false,
          type: 'default' as const,
          body: stream,
          bodyUsed: false,

          clone() {
            if (response.bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }

            const clonedStream = new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(buffer));
                controller.close();
              }
            });

            return {
              ok: response.ok,
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
              url: response.url,
              redirected: response.redirected,
              type: response.type,
              body: clonedStream,
              bodyUsed: false,
              text: async () => data,
              json: async () => { try { return JSON.parse(data); } catch { return data; } },
              arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
              blob: async () => new Blob([buffer]),
              formData: async () => { throw new Error('FormData not implemented'); },
              clone: () => { throw new Error('Cannot clone already cloned response'); }
            };
          },

          // fetch API methods
          text: async () => {
            if (response.bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }
            response.bodyUsed = true;
            return data;
          },

          json: async () => {
            if (response.bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }
            response.bodyUsed = true;
            try {
              return JSON.parse(data);
            } catch {
              return data;
            }
          },

          arrayBuffer: async () => {
            if (response.bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }
            response.bodyUsed = true;
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
          },

          blob: async () => {
            if (response.bodyUsed) {
              throw new TypeError('Body has already been consumed');
            }
            response.bodyUsed = true;
            return new Blob([buffer]);
          },

          formData: async () => {
            throw new Error('FormData not implemented');
          }
        };

        resolve(response as unknown as Response);
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
