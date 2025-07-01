export const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'https://httpbin.org/ip';
export const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10);
export const TIMEOUT = parseInt(process.env.TIMEOUT || '5000', 10);

export const defaultProxyMangerConfig = {
  onErrorRetries: 0, // no retries on error, get another proxy
  onTimeoutRetries: 0, // no retries on timeout, get another proxy
  maxTimeout: 5000,
  healthCheckUrl: HEALTH_CHECK_URL,
  healthCheckInterval: HEALTH_CHECK_INTERVAL,
  timeout: TIMEOUT,
};
