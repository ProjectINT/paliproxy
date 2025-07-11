import { ErrorCode, ConfigKey } from '../types.js';

export const errorCodes = {
  NO_ALIVE_PROXIES: 'NO_ALIVE_PROXIES',
  NO_PROXIES: 'NO_PROXIES',
  REQUEST_FAILED: 'REQUEST_FAILED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  REQUEST_BODY_ERROR: 'REQUEST_BODY_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export const errorMessages = {
  [errorCodes.NO_ALIVE_PROXIES]: 'No live proxies available',
  [errorCodes.NO_PROXIES]: 'No proxies provided',
  [errorCodes.REQUEST_FAILED]: 'Request failed',
  [errorCodes.REQUEST_TIMEOUT]: 'Request timed out',
  [errorCodes.REQUEST_BODY_ERROR]: 'Error writing request body, serialization failed',
  [errorCodes.UNKNOWN_ERROR]: 'Unknown error occurred'
};

export const errorCodesConfigMapping: Partial<Record<ErrorCode, ConfigKey>> = {
  REQUEST_FAILED: 'onErrorRetries',
  REQUEST_TIMEOUT: 'onTimeoutRetries'
};
