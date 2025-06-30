#!/usr/bin/env node
import { testProxy } from './utils/testProxy';
// import { proxiesList } from '../proxies-list';
import { errorCodes } from './utils/errorCodes';
import { logger as innerLogger, SeverityLevel } from './utils/logger/logger';

/**
 * PaliProxy
 */

const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '5000', 10);
export class PaliProxy {
    private proxies: readonly ProxyBase[] = [];
    private liveProxies: ProxyConfig[] = [];
    private run: boolean = false;

    constructor(proxies: ProxyBase[], sentryLogger: any) {
        // Initialize logger with application tags
        const logger = sentryLogger || innerLogger;
        
        logger.setTags({
            component: 'PaliProxy',
            version: '1.0.0'
        });
        
        logger.captureMessage('Initializing PaliProxy');
        logger.setExtra('proxyCount', proxies.length);
        
        if (!proxies || proxies.length === 0) {
            logger.captureMessage('No proxies provided to constructor', SeverityLevel.Error);
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
    }

    async initialize(proxies: ProxyBase[]): Promise<void> {
        if (!proxies || proxies.length === 0) {
            throw new Error('No proxies provided');
        }

        this.initLiveProxies();
        this.run = true;
        this.loopRangeProxies();
    }

    loopRangeProxies(): void {
        setInterval(() => {
            if (this.run) {
                this.rangeProxies();
            }
        }, HEALTH_CHECK_INTERVAL);
    }

    initLiveProxies(): void {
        this.liveProxies = this.proxies.map(
            (proxy) => ({ ...proxy, alive: true, latency: 0 } as ProxyConfig)
        ).filter(proxy => proxy.alive);
    }

    async rangeProxies() {
        if (this.proxies.length === 0) {
            throw new Error('No proxies initialized');
        }

        const withLatency: ProxyConfig[] = await Promise.all(this.proxies.map(async (proxy, index) => {
            const { latency, alive } = await testProxy(proxy);
            return { ...proxy, alive, latency };
        }));

        withLatency.sort((a, b) => a.latency - b.latency);

        const aliveRangedProxies = withLatency.filter(proxy => proxy.alive);
        if (aliveRangedProxies.length === 0) {
            throw new Error('No alive proxies found');
        }

        this.liveProxies = aliveRangedProxies;
    }
    
    async request(config: RequestConfig) {
        
    }

    stop() {
        this.run = false;
    }
}