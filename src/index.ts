#!/usr/bin/env node
import { testProxy } from './utils/testProxy';
// import { proxiesList } from '../proxies-list';
import { errorCodes, errorMessages } from './utils/errorCodes';
import { logger as innerLogger, ISentryLogger } from './utils/logger/logger';
import { proxyRequest } from './utils/proxyRequest';
import type { Breadcrumb } from '@sentry/core';

import { defaultProxyMangerConfig } from '../constants';

import { generateSnowflakeId } from './utils/snowflakeId/index';

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
  private readonly config: ProxyManagerConfig = {};
  private exceptionHandlers = {
    [errorCodes.REQUEST_FAILED]: (exceptionData: ExceptionData, attemptParams: AttemptParams) => {
      addBreadcrumb(this.logger, exceptionData);
      this.logger.captureException(exceptionData.error);
    },
    [errorCodes.REQUEST_TIMEOUT]: (exceptionData: ExceptionData, attemptParams: AttemptParams) => {
      addBreadcrumb(this.logger, exceptionData);
      this.logger.captureException(exceptionData.error);
    },
    [errorCodes.REQUEST_BODY_ERROR]: (exceptionData: ExceptionData, attemptParams: AttemptParams) => {
      addBreadcrumb(this.logger, exceptionData);
      this.logger.captureException(exceptionData.error);
    },
    [errorCodes.UNKNOWN_ERROR]: (exceptionData: ExceptionData, attemptParams: AttemptParams) => {
      addBreadcrumb(this.logger, exceptionData);
      this.logger.captureException(exceptionData.error);
    }
  };
  private readonly requestsStack: Map<string, RequestState> = new Map();

  constructor(proxies: ProxyBase[], { sentryLogger, config }: { sentryLogger?: ISentryLogger, config?: ProxyManagerConfig } = {}) {
    // Initialize logger with application tags
    this.logger = sentryLogger || innerLogger;

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
    ).filter(proxy => proxy.alive);

    this.config = Object.freeze({
      ...defaultProxyMangerConfig,
      ...config
    });
  }

  initialize(proxies: ProxyBase[]): ProxyManager {
    if (!proxies || proxies.length === 0) {
      throw new Error('No proxies provided');
    }

    this.run = true;
    this.initLiveProxies();
    this.loopRangeProxies();

    return this;
  }

  attemptsManager() {

  }

  loopRangeProxies(): void {
    setInterval(() => {
      if (this.run) {
        this.rangeProxies();
      }
    }, this.config.healthCheckInterval);
  }

  initLiveProxies(): void {
    this.liveProxies = this.proxies.map(
      (proxy) => ({ ...proxy, alive: true, latency: 0 } as ProxyConfig)
    ).filter(proxy => proxy.alive);
  }

  async rangeProxies() {
    if (this.proxies.length === 0) {

      throw new Error(errorMessages[errorCodes.NO_PROXIES]);
    }

    const withLatency: ProxyConfig[] = await Promise.all(this.proxies.map(async (proxy) => {
      const { latency, alive } = await testProxy(proxy);
      return { ...proxy, alive, latency };
    }));

    withLatency.sort((a, b) => a.latency - b.latency);

    const aliveRangedProxies = withLatency.filter(proxy => proxy.alive);

    if (aliveRangedProxies.length === 0) {
      throw new Error(errorMessages[errorCodes.NO_ALIVE_PROXIES]);
    }

    this.liveProxies = aliveRangedProxies;
  }

  async runAttempt(attemptParams: AttemptParams): Promise<any> {
    const { config, proxy } = attemptParams;

    return proxyRequest(config, proxy)
      .catch((error) => {
        if (this.exceptionHandlers[error.errorCode]) {
          this.exceptionHandlers[error.errorCode]!(error, attemptParams);
        } else {
          this.exceptionHandlers[errorCodes.UNKNOWN_ERROR]!(error, attemptParams);
        }
      });
  }

  async proxyRequestWithRetry(config: RequestConfig, requestId: string): Promise<any> {
    const proxy = this.liveProxies[0];

    if (!proxy) {
      const err = new Error(errorMessages[errorCodes.NO_ALIVE_PROXIES]);
      this.logger.captureException(err);
      throw err;
    }

    this.runAttempt({ config, proxy, requestId });
  }

  async request(config: RequestConfig) {
    const requestId = generateSnowflakeId();

    this.requestsStack.set(requestId, {
      retries: 0,
      lastAttempt: Date.now(),
      success: false,
      attempts: []
    });

    return this.proxyRequestWithRetry(config, requestId)
      .catch((error) => {
        // unexpected error
        const requestState = this.requestsStack.get(requestId);
        this.logger.setExtra('requestState', requestState);
        this.logger.captureException(error);
      })
      .finally(() => {
        const requestState = this.requestsStack.get(requestId);
        if (requestState?.success === true) {
          this.requestsStack.delete(requestId);
        } else {
          this.logger.captureMessage('Proxy request failed', 'error');
          this.logger.setExtra('requestState', requestState);
          this.logger.captureException(new Error('All attempts failed'));
        }
      });
  }

  stop() {
    this.run = false;
  }
}
