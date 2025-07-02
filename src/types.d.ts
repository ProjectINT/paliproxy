type ProxyConfig = {
  ip: string;
  port: number;
  user: string;
  pass: string;
  alive: boolean;
  latency: number;
};

type RequestConfig = {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Object | Object[] | string;
};

type ProxyManagerConfig = {
  onErrorRetries: number;
  onTimeoutRetries: number;
  maxTimeout: number;
  healthCheckUrl: string;
  healthCheckInterval: number;
  changeProxyLoop: number; // Number of attempts to change proxy in loop
}

type ConfigKey = keyof ProxyManagerConfig;

type ProxyBase = Omit<ProxyConfig, 'alive' | 'latency'>;

type NodeError = Error & { code?: string };

type ExceptionData = {
  message: string;
  errorCode: string;
  error: NodeError;
  config: RequestConfig;
  proxy: ProxyConfig;
};

type Attempt = {
  proxy: ProxyConfig;
  errorCode: ErrorCode | null;
  success: boolean;
  ts: number;
}

type RequestState = {
  retries: number;
  success: boolean;
  attempts: Attempt[];
  loops: number;
}

type AttemptParams = {
  requestConfig: RequestConfig;
  proxy: ProxyConfig;
  requestId: string;
};

type ErrorCodes = {
  NO_PROXIES: string;
  REQUEST_FAILED: string;
  REQUEST_TIMEOUT: string;
  REQUEST_BODY_ERROR: string;
  UNKNOWN_ERROR: string;
};

type ErrorCode = keyof typeof errorCodes;

type ResponseData = Response;

type ProxyManagerOptions = {
  sentryLogger?: object | undefined;
  config?: ProxyManagerConfig;
  disableLogging?: boolean;
};
