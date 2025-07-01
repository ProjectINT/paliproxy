#!/usr/bin/env node
import { testProxy } from './utils/testProxy';
// import { proxiesList } from '../proxies-list';
import { errorCodes, errorMessages } from './utils/errorCodes';
import { logger as innerLogger, SeverityLevel } from './utils/logger/logger';
import { proxyRequest } from './utils/proxyRequest';

import { defaultPaliProxyConfig } from '../constants';

/**
 * PaliProxy
 */
export class PaliProxy {
    private readonly proxies: readonly ProxyBase[] = [];
    private liveProxies: ProxyConfig[] = [];
    private run: boolean = false;
    private logger: any;
    private readonly config: PaliProxyConfig = {};

    constructor(proxies: ProxyBase[], { sentryLogger, config }: { sentryLogger?: any, config?: PaliProxyConfig } = {}) {
        // Initialize logger with application tags
        this.logger = sentryLogger || innerLogger;

        this.logger.setTags({
            component: 'PaliProxy',
            version: '1.0.0'
        });

        this.logger.captureMessage('Initializing PaliProxy');
        this.logger.setExtra('proxyCount', proxies.length);

        if (!proxies || proxies.length === 0) {
            this.logger.captureMessage(errorCodes.NO_PROXIES, SeverityLevel.Error);
            throw new Error('No proxies provided');
        }

        this.proxies = Object.freeze(proxies.map((p) => ({
            ip: p.ip,
            port: p.port,
            user: p.user,
            pass: p.pass,
        })));
        
        this.liveProxies = this.proxies.map(
            (proxy) => ({ ...proxy, alive: true, latency: 0 } as ProxyConfig)
        ).filter(proxy => proxy.alive);

        this.config = Object.freeze({
            ...defaultPaliProxyConfig,
            ...config,
        });
    }

    initialize(proxies: ProxyBase[]): PaliProxy {
        if (!proxies || proxies.length === 0) {
            throw new Error('No proxies provided');
        }

        this.run = true;
        this.initLiveProxies();
        this.loopRangeProxies();

        return this;
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

        const withLatency: ProxyConfig[] = await Promise.all(this.proxies.map(async (proxy, index) => {
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

    async proxyRequestWithRetry(config: RequestConfig): Promise<any> {
        const proxyState = {
            onErrorRetries: 0,
            onTimeoutRetries: 0,
        }

        const proxy = this.liveProxies[0];

        if (!proxy) {
            const err = new Error(errorMessages[errorCodes.NO_ALIVE_PROXIES]);
            this.logger.captureException(err);
            throw err;
        }

        proxyRequest(config, proxy)
            .catch((error) => {
                this.logger.captureException(error, {
                    extra: {
                        config,
                        proxy,
                        retries: proxyState.onErrorRetries,
                    },
                    tags: {
                        errorCode: error.code || 'UNKNOWN',
                    }
                });
            })
    }
    
    async request(config: RequestConfig) {
        return this.proxyRequestWithRetry(config);
    }

    stop() {
        this.run = false;
    }
}