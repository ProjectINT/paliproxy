export const errorCodes = {
  NO_ALIVE_PROXIES: 'NO_ALIVE_PROXIES',
  NO_PROXIES: 'NO_PROXIES',
  REQUEST_FAILED: 'REQUEST_FAILED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
}

export const errorMessages = {
  [errorCodes.NO_ALIVE_PROXIES]: 'No live proxies available',
  [errorCodes.NO_PROXIES]: 'No proxies provided',
  [errorCodes.REQUEST_FAILED]: 'Request failed',
  [errorCodes.REQUEST_TIMEOUT]: 'Request timed out',
}