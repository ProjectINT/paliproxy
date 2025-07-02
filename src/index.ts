#!/usr/bin/env node
import { testProxy } from './utils/testProxy';
// import { proxiesList } from '../proxies-list';
import { errorCodes, errorMessages } from './utils/errorCodes';
import { logger as innerLogger, nullLogger, ISentryLogger } from './utils/logger';
import { proxyRequest } from './utils/proxyRequest';
import type { Breadcrumb } from '@sentry/core';

import { defaultProxyMangerConfig } from '../constants';

import { generateSnowflakeId } from './utils/snowflakeId/index';
import { getNextProxy } from './utils/getNextProxy';

const addBreadcrumb = (logger: ISentryLogger, { config, proxy, errorCode }: ExceptionData) => logger.addBreadcrumb({
  category: 'ProxyManager',
  message: errorCode,
  level: 'error', // SeverityLevel.Error is not available, use string
  data: {
    config,
    proxy,
    errorCode
  }
} as Breadcrumb);

/**
 * ProxyManager
 */
export class ProxyManager {
  private readonly proxies: readonly ProxyBase[] = [];
  private liveProxies: ProxyConfig[] = [];
  private run: boolean = false;
  private logger: ISentryLogger;
  private readonly config: ProxyManagerConfig;
  private readonly requestsStack: Map<string, RequestState> = new Map();

  constructor(proxies: ProxyBase[], options: ProxyManagerOptions = {}) {
    const { sentryLogger, config, disableLogging = false } = options;
    // Initialize logger with application tags
    this.logger = disableLogging ? nullLogger : (sentryLogger as ISentryLogger || innerLogger);

    this.logger.addBreadcrumb({
      category: 'ProxyManager',
      message: 'Initializing ProxyManager',
      level: 'info',
      data: {
        component: 'ProxyManager',
        version: '1.0.0'
      }
    });

    this.logger.addBreadcrumb({
      category: 'ProxyManager',
      message: 'proxyCount',
      level: 'info',
      data: {
        count: proxies.length
      }
    });

    if (!proxies || proxies.length === 0) {
      this.logger.captureMessage(errorCodes.NO_PROXIES, 'error');
      throw new Error('No proxies provided');
    }

    this.proxies = Object.freeze(proxies.map((p) => ({
      ip: p.ip,
      port: p.port,
      user: p.user,
      pass: p.pass
    })));

    this.liveProxies = this.proxies.map(
      (proxy) => ({ ...proxy, alive: true, latency: 0 } as ProxyConfig)
    );

    this.config = Object.freeze({
      ...defaultProxyMangerConfig,
      ...config
    });

    // Initialization logic
    this.run = true;
    this.checkProxyManagerConfig();

    // Run health check immediately, then start interval
    this.rankProxies().catch((err) => {
      this.logger.captureException(err);
    });

    this.loopRankProxies();
  }

  loopRankProxies(): void {
    setInterval(() => {
      if (this.run) {
        this.rankProxies().catch((err) => {
          this.logger.captureException(err);
        });
      }
    }, this.config.healthCheckInterval);
  }

  initLiveProxies(): void {
    // Only initialize if liveProxies is empty
    if (this.liveProxies.length === 0) {
      this.liveProxies = this.proxies.map(
        (proxy) => ({ ...proxy, alive: true, latency: 0 } as ProxyConfig)
      );
    }
  }

  async rankProxies() {
    if (this.proxies.length === 0) {

      throw new Error(errorMessages[errorCodes.NO_PROXIES]);
    }

    const withLatency: ProxyConfig[] = await Promise.all(this.proxies.map(async (proxy) => {
      const { latency, alive } = await testProxy(proxy);
      return { ...proxy, alive, latency };
    }));

    withLatency.sort((a, b) => a.latency - b.latency);

    const aliveRankedProxies = withLatency.filter(proxy => proxy.alive);

    if (aliveRankedProxies.length === 0) {
      throw new Error(errorMessages[errorCodes.NO_ALIVE_PROXIES]);
    }

    this.liveProxies = aliveRankedProxies;
  }

  async runAttempt(attemptParams: AttemptParams): Promise<ResponseData> {
    const { requestConfig, proxy } = attemptParams;

    try {
      const response = await proxyRequest(requestConfig, proxy);

      // Mark request as successful
      const requestState = this.requestsStack.get(attemptParams.requestId);
      if (requestState) {
        this.requestsStack.set(attemptParams.requestId, {
          ...requestState,
          success: true,
          attempts: [...requestState.attempts, {
            proxy,
            errorCode: null,
            success: true,
            ts: Date.now()
          }]
        });
      }

      return response;
    } catch (exceptionData: unknown) {
      addBreadcrumb(this.logger, exceptionData as ExceptionData);

      // Handle different types of exceptions
      let errorToLog: Error;
      if (exceptionData && typeof exceptionData === 'object' && 'error' in exceptionData) {
        errorToLog = (exceptionData as ExceptionData).error;
      } else if (exceptionData instanceof Error) {
        errorToLog = exceptionData;
      } else {
        errorToLog = new Error(String(exceptionData));
      }

      this.logger.captureException(errorToLog);
      const requestState = this.requestsStack.get(attemptParams.requestId);

      if (!requestState) {
        throw new Error('Request state not found');
      }

      const newAttempt: Attempt = {
        proxy,
        errorCode: (exceptionData as ExceptionData).errorCode || errorCodes.UNKNOWN_ERROR,
        success: false,
        ts: Date.now()
      };

      this.requestsStack.set(attemptParams.requestId, {
        ...requestState,
        attempts: [...requestState.attempts, newAttempt]
      });

      return this.proxyLoop(requestConfig, attemptParams.requestId);
    }
  }

  async checkProxyManagerConfig(): Promise<void> {
    if (!this.config || Object.keys(this.config).length === 0) {
      const err = new Error('ProxyManager config is not defined');
      this.logger.captureException(err);
      throw err;
    }

    if (!this.config.healthCheckUrl) {
      const err = new Error('ProxyManager healthCheckUrl is not defined');
      this.logger.captureException(err);
      throw err;
    }

    if (this.config.maxTimeout <= 0) {
      const err = new Error('ProxyManager maxTimeout must be greater than 0');
      this.logger.captureException(err);
      throw err;
    }
    if (this.proxies.length === 0) {
      const err = new Error(errorMessages[errorCodes.NO_PROXIES]);
      this.logger.captureException(err);
      throw err;
    }
  }

  async proxyLoop(requestConfig: RequestConfig, requestId: string): Promise<ResponseData> {
    const requestState = this.requestsStack.get(requestId);
    if (!requestState) {
      const err = new Error('Request state not found');
      this.logger.captureException(err);
      throw err;
    }
    if (this.liveProxies.length === 0) {
      const err = new Error(errorMessages[errorCodes.NO_ALIVE_PROXIES]);
      this.logger.captureException(err);
      throw err;
    }

    const proxy = getNextProxy({
      requestState: this.requestsStack.get(requestId) as RequestState,
      proxies: this.liveProxies,
      config: this.config
    });

    if (!proxy) {
      // this means that no proxies are available
      // changeProxyLoop - config
      // loops - requestState
      const isNewLoopAvailable = this.requestsStack.get(requestId)?.loops as number < this.config.changeProxyLoop;

      if (isNewLoopAvailable) {
        this.requestsStack.set(requestId, {
          ...requestState,
          loops: (requestState?.loops || 0) + 1,
          attempts: [] // reset attempts for new loop
        });

        return this.proxyLoop(requestConfig, requestId);
      } else {
        throw new Error(errorMessages[errorCodes.REQUEST_FAILED]);
      }
    }

    return this.runAttempt({
      requestConfig,
      proxy,
      requestId
    });
  }

  async request(url: string, options?: RequestConfig): Promise<ResponseData> {
    const requestId = generateSnowflakeId();

    // Merge url and options into a single RequestConfig object
    const requestConfig: RequestConfig = {
      url,
      method: options?.method || 'GET',
      headers: options?.headers || {},
      ...(options?.body !== undefined && { body: options.body })
    };

    this.requestsStack.set(requestId, {
      retries: 0,
      success: false,
      attempts: [],
      loops: 0
    });

    return this.proxyLoop(requestConfig, requestId)
      .catch((error) => {
        // unexpected error
        const requestState = this.requestsStack.get(requestId);
        this.logger.setExtra('requestState', requestState);
        this.logger.captureException(error);
        throw error; // Re-throw to maintain error handling
      })
      .finally(() => {
        const requestState = this.requestsStack.get(requestId);
        if (requestState?.success === true) {
          this.requestsStack.delete(requestId);
        } else {
          // else handle memory overflow
          this.logger.captureMessage('Proxy request failed', 'error');
          this.logger.setExtra('requestState', requestState);
          this.logger.captureException(new Error('All attempts failed'));
        }
      });
  }

  // Async getter for testing purposes - waits for health check to complete
  async getLiveProxiesList(): Promise<ProxyConfig[]> {
    // Wait for initial health check to complete
    const liveProxies = await this.rankProxies().catch((err) => {
      this.logger.captureException(err);
    }).then(() => this.liveProxies);
    return liveProxies;
  }

  // Sync getter for internal use (returns current state)
  get liveProxiesListSync(): ProxyConfig[] {
    return this.liveProxies;
  }

  stop() {
    this.run = false;
  }
}
