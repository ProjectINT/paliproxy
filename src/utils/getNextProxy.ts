/*
  This function determines which proxy to use for the next request attempt.

  Logic overview:
  1. Takes the current request state (requestState), the list of proxies, and the configuration (config).
  2. Iterates through the proxies in order (sorted by latency, fastest first).
  3. If there are no previous attempts, selects the first (best) proxy.
  4. If there are failed attempts, checks if the current proxy should be retried based on the error code and the configured retry count (using errorCodesConfigMapping to map error codes to config fields).
  5. If the retry limit for the current error is not reached, retries the same proxy.
  6. Otherwise, selects the next proxy in the list that has not yet been tried for this request.
*/
import { errorCodesConfigMapping } from './errorCodes';

type GetNextProxyArgs = {
  requestState: RequestState;
  proxies: ProxyConfig[];
  config: ProxyManagerConfig;
}

const getRetriesByConfig = (errorCode: ErrorCode, config: ProxyManagerConfig) => {
  if (errorCodesConfigMapping[errorCode]) {
    return config[errorCodesConfigMapping[errorCode]];
  }

  return 0;
};

export const getNextProxy = ({ requestState, proxies, config }: GetNextProxyArgs): ProxyConfig | null => {
  const { attempts } = requestState;

  const lastAttempt = attempts[attempts.length - 1];

  if (lastAttempt && lastAttempt.success) {
    throw new Error('Last attempt was successful, no need to get next proxy');
  }

  if (!lastAttempt) {
    // If there are no failed attempts, return the first proxy
    // Proxies ranked by latency, so the first one is the best
    return proxies[0] as ProxyConfig;
  }

  const lastErrorCode = lastAttempt.errorCode as ErrorCode;

  const errorCodeRetries = getRetriesByConfig(lastErrorCode, config) as number;

  const errorAttempts = attempts.reduceRight<Attempt[]>((acc, attempt, index, attempts) => {
    // we need this function to implement change proxy loop
    const previousIsUndefinedOrSame = () => {
      attempts[index + 1]?.errorCode === lastErrorCode || attempts[index + 1] === undefined;
    };

    if (attempt.errorCode === lastErrorCode && previousIsUndefinedOrSame()) {
      return acc.concat(attempt);
    }
    return acc;
  }, []);

  // Return the same proxy for new try
  if (errorAttempts.length < errorCodeRetries) {
    return lastAttempt.proxy;
  }


  /*
    We iterate through the proxies in a loop, starting from the first one, which is the fastest.
    If we get an error, we move to the next proxy in the list.
    However, while this logic is running, the proxies may be reshuffled by the healthCheck function.
    Therefore, we take the next proxy that we have not yet tried and that is higher/earlier in the list.
  */
  const findNewProxy = () => {
    const triedProxiesIds = new Set(attempts.map((a) => `${a.proxy.ip}:${a.proxy.port}`));
    for (const proxy of proxies) {
      if (!triedProxiesIds.has(`${proxy.ip}:${proxy.port}`)) {
        return proxy;
      }
    }
    return null; // If proxies not found, return null
  };


  return findNewProxy();
};
