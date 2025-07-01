type ProxyConfig = {
  ip: string;
  port: number;
  user: string;
  pass: string;
  alive: boolean;
  latency: number;
};

type RequestConfig = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
};

type PaliProxyConfig = {
  onErrorRetries?: number;
  onTimeoutRetries?: number;
  maxTimeout?: number;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
  timeout?: number;
  sentryLogger?: any;
}

type ProxyBase = Omit<ProxyConfig, 'alive' | 'latency'>;

type NodeError = Error & { code?: string };

type ExceptionData = {
  message: string;
  errorCode: string;
  error: NodeError;
  config: RequestConfig;
  proxy: ProxyConfig;
};
