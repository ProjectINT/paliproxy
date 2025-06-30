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

type ProxyBase = Omit<ProxyConfig, 'alive' | 'latency'>;
