// Type definitions for ProxyManager package

export interface ProxyConfig {
  ip: string;
  port: number;
  user: string;
  pass: string;
  alive: boolean;
  latency: number;
}

export interface RequestConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Object | Object[] | string;
}

export interface ProxyManagerConfig {
  onErrorRetries: number;
  onTimeoutRetries: number;
  maxTimeout: number;
  healthCheckUrl: string;
  healthCheckInterval: number;
  changeProxyLoop: number; // Number of attempts to change proxy in loop
}

export type ConfigKey = keyof ProxyManagerConfig;

export type ProxyBase = Omit<ProxyConfig, 'alive' | 'latency'>;

export interface NodeError extends Error {
  code?: string;
}

export interface ExceptionData {
  message: string;
  errorCode: string;
  error: NodeError;
  config: RequestConfig;
  proxy: ProxyConfig;
}

export interface Attempt {
  proxy: ProxyConfig;
  errorCode: string | null;
  success: boolean;
  ts: number;
}

export interface RequestState {
  retries: number;
  success: boolean;
  attempts: Attempt[];
  loops: number;
}

export interface AttemptParams {
  requestConfig: RequestConfig;
  proxy: ProxyConfig;
  requestId: string;
}

export interface ErrorCodes {
  NO_PROXIES: string;
  REQUEST_FAILED: string;
  REQUEST_TIMEOUT: string;
  REQUEST_BODY_ERROR: string;
  UNKNOWN_ERROR: string;
}

export type ErrorCode = keyof ErrorCodes;

export type ResponseData = Response;

export interface ProxyManagerOptions {
  sentryLogger?: object | undefined;
  config?: Partial<ProxyManagerConfig>;
  disableLogging?: boolean;
}
