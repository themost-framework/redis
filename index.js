const { Redis } = require('ioredis');
const genericPool = require("generic-pool");
const {TraceUtils, ConfigurationBase} = require('@themost/common');
class RedisConnectionPool {
    constructor(container) {
        Object.defineProperty(this, 'container', {
            enumerable: false,
            writable: false,
            value: container
        });
    }

    create() {
        const connectOptions = this.container && this.container.options;
        return new Redis(connectOptions);
    }

    /**
     * @param {Redis} client 
     */
    async destroy(client) {
        if (client && client.isOpen) {
            await client.quit();
        }
    }

}

class RedisCacheStrategy {

    constructor(container) {
        /**
         * @type {import('@themost/common').ConfigurationBase}
         */
        let configuration;
        if (container instanceof ConfigurationBase) {
            configuration = container;
        } else if (container && typeof container.getConfiguration === 'function') {
            configuration = container.getConfiguration();
        }
        if (configuration == null) {
            configuration = new ConfigurationBase();
        }
        // backward compatibility
        if (configuration.hasStrategy(function DataCacheStrategy() {})) {
            const thisService = this;
            configuration.useStrategy(function DataCacheStrategy() {}, function() {
                return thisService;
            });
        }
        /**
         * get redis configuration
         * @type {{options:*=,pool:*=, absolute_expiration: number=}}
         */
        const redisConfiguration = configuration.getSourceAt('settings/redis') || {};
        // get connect options
        this.options = Object.assign({ 
            host: '127.0.0.1',
            port: 6379
         }, redisConfiguration.options);
          // set absolute expiration
          this.absoluteExpiration = redisConfiguration.absolute_expiration || 1200;
         if (redisConfiguration.pool) {
            // get connection pool options
            const conectionPoolOptions = Object.assign({
                min: 2,
                max: 25
            }, redisConfiguration.pool);
            // create connection pool
            this.pool = genericPool.createPool(new RedisConnectionPool(this), conectionPoolOptions);
         }
    }

    /**
     * @returns {Promise<Redis>}
     */
    async acquire() {
        if (this.pool) {
            return this.pool.acquire();
        }
        return new Redis(this.options);
    }

    /**
     * @param {Redis} client
     * @returns {Promise<void>}
     */
    async release(client) {
        if (this.pool) {
            return this.pool.release(client);
        }
        await client.quit();
    }

    /**
     *
     * @param {string} key
     * @param {*} value
     * @param {number=} absoluteExpiration
     * @returns Promise<*>
     */
    async add(key, value, absoluteExpiration) {
        /**
         * @type {import('redis').RedisClient}
         */
        let client;
        try {
            /**
             * @type {Redis}
             */
            client = await this.acquire();
            if (client.isOpen === false) { await client.connect(); }
            // if absolute expiration is defined
            if (typeof absoluteExpiration === 'number' && absoluteExpiration >= 0) {
                // set item with expiration
                await client.set(key, JSON.stringify(value), 'EX', absoluteExpiration);
            }
            else {
                // get absolute expiration from connect options and set item
                await client.set(key, JSON.stringify(value), 'EX', this.absoluteExpiration);
            }
            // finally release create
            await this.release(client);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.release(client);
                }
                catch (err) {
                    TraceUtils.error('An error occurred while trying to release a redis client.');
                    TraceUtils.error(err);
                }
            }
            // and throw error
            throw err;
        }
    }

    /**
     *
     * @param {string} key
     * @returns Promise<*>
     */
    async remove(key) {
        /**
         * @type {Redis}
         */
        let client;
        try { 
            client = await this.acquire();
            if (client.isOpen === false) { await client.connect(); }
            const keys = await client.keys(key);
            if (keys.length) {
                const pipeline = client.pipeline();
                for (const key of keys) {
                    pipeline.del(key);
                }
                await pipeline.exec();
            }
            // release client
            await this.release(client);
            // return true if key has been removed
            return (keys.length > 0);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.release(client);
                }
                catch (err) {
                    TraceUtils.error('An error occurred while trying to release a redis client.');
                    TraceUtils.error(err);
                }
            }
            // and throw error
            throw err;
        }

    }
    /**
     *
     * @returns Promise<*>
     */
    clear() {
        return Promise.reject('This operation is not supported by Redis cache strategy.');
    }

    /**
     *
     * @param {string} key
     * @returns Promise<*>
     */
    async get(key) {
        /**
         * @type {Redis}
         */
        let client;
        try {
            // get client
            client = await this.acquire();
            if (client.isOpen === false) { await client.connect(); }
            // get item
            const result = await client.get(key);
            // try to release client
            this.release(client);
            if (result == null) {
                return;
            }
            return JSON.parse(result);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.release(client);
                }
                catch (err) {
                    TraceUtils.error('An error occurred while trying to release a redis client.');
                    TraceUtils.error(err);
                }
            }
            // and throw error
            throw err;
        }
    }
    /**
     *
     * @param {string} key
     * @param {Promise<*>} getDefaultValue
     * @param {number=} absoluteExpiration
     * @returns Promise<*>
     */
    async getOrDefault(key, getDefaultValue, absoluteExpiration) {
        let client;
        try {
            client = await this.acquire();
            if (client.isOpen === false) { await client.connect(); }
            // try to get item// get item
            let value = await client.get(key);
            let result;
            if (value == null) {
                // call default value func
                result = await getDefaultValue();
                // add value to cache
                await this.add(key, result, absoluteExpiration);
            }
            else {
                result = JSON.parse(value);
            }
            // release client
            await this.release(client);
            return result;
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.release(client);
                }
                catch (err) {
                    TraceUtils.error('An error occurred while trying to release a redis client.');
                    TraceUtils.error(err);
                }
            }
            // and throw error
            throw err;
        }

    }

    finalize(callback) {
        callback = callback || function() {}
        if (this.pool == null) {
            return callback();
        }
        void this.pool.clear().then(() => {
            return callback();
        }).catch((err) => {
            TraceUtils.warn('An error occurred while finalizing RedisCacheStategy');
            TraceUtils.warn(err);
            return callback();
        });
    }

    async finalizeAsync() {
        return new Promise((resolve) => {
            this.finalize(() => {
                return resolve();
            });
        })
    }

}

module.exports = {
    RedisCacheStrategy
};
