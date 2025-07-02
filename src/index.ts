#!/usr/bin/env node
import { testProxy } from './utils/testProxy';
// import { proxiesList } from '../proxies-list';
import { errorCodes, errorMessages } from './utils/errorCodes';
import { logger as innerLogger, ISentryLogger } from './utils/logger';
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
  private readonly config: ProxyManagerConfig = { ...defaultProxyMangerConfig, sentryLogger: undefined };
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
    );

    this.config = Object.freeze({
      ...defaultProxyMangerConfig,
      ...config,
      sentryLogger: sentryLogger || innerLogger // Ensure sentryLogger is always present
    });

    // Initialization logic moved from initialize()
    this.run = true;
    this.initLiveProxies();
    this.loopRangeProxies();
    this.checkProxyManagerConfig();
  }



  loopRangeProxies(): void {
    setInterval(() => {
      if (this.run) {
        this.rangeProxies().catch((err) => {
          this.logger.captureException(err);
        });
      }
    }, this.config.healthCheckInterval);
  }

  initLiveProxies(): void {
    this.liveProxies = this.proxies.map(
      (proxy) => ({ ...proxy, alive: true, latency: 0 } as ProxyConfig)
    );
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

  runAttempt(attemptParams: AttemptParams): Promise<ResponseData> {
    const { requestConfig, proxy } = attemptParams;

    try {
      return proxyRequest(requestConfig, proxy);
    } catch (exceptionData: unknown) {
      addBreadcrumb(this.logger, exceptionData as ExceptionData);
      this.logger.captureException((exceptionData as ExceptionData).error);
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

  async request(requestConfig: RequestConfig) {
    const requestId = generateSnowflakeId();

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

  stop() {
    this.run = false;
  }
}
