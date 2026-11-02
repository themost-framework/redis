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
     * @private
     * @param {Redis} client
     * @returns {Promise<void>}
     */
    async tryRelease(client) {
        if (client == null) {
            return;
        }
        try {
            // try to release client
            await this.release(client);
        }
        catch (err) {
            TraceUtils.error('An error occurred while trying to release a redis client.');
            TraceUtils.error(err);
        }
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
            if (typeof absoluteExpiration === 'number' && absoluteExpiration < 0) {
                 await client.set(key, JSON.stringify(value));
                 return;
            }
            // if absolute expiration is defined
            if (typeof absoluteExpiration === 'number' && absoluteExpiration >= 0) {
                // set item with expiration
                await client.set(key, JSON.stringify(value), 'EX', absoluteExpiration);
            }
            else {
                // get absolute expiration from connect options and set item
                await client.set(key, JSON.stringify(value), 'EX', this.absoluteExpiration);
            }
        } finally {
            if (client) {
                await this.tryRelease(client);
            }
        }
    }

    /**
     * Returns the expiration timeout for the given key in seconds. If the key does not exist or has no expiration, returns null.
     * @param {string} key 
     */
    async getExpirationTimeout(key) {
        let client;
        try { 
            /**
             * @type {Redis}
             */
            client = await this.acquire();
            if (client.isOpen === false) { await client.connect(); }
            return await client.ttl(key);
        } finally {
            if (client) {
                await this.tryRelease(client);
            }
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
            // return true if key has been removed
            return keys.length;
        } finally {
            if (client) {
                await this.tryRelease(client);
            }
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
            // if the key is missing, the client returns null,
            // so we return undefined to indicate that the key is not present in the cache
            if (result == null) {
                return;
            }
            // if the key is present, before parsing the value, we check if the result is an empty string,
            // which indicates that the key has been set but has no value
            // in this case, we return null to indicate that the key is present but has no value
            if (result.length === 0) {
                // this operation is used to indicate that the key is present but has no value
                return;
            }
            // finally, we parse the result and return it
            return JSON.parse(result);
        } finally {
            if (client) {
                await this.tryRelease(client);
            }
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
            // if the key is missing, the client returns null,
            // so we return undefined to indicate that the key is not present in the cache
            if (value == null) {
                // call default value func for getting the default value
                result = await getDefaultValue();
                // add value to cache
                await this.add(key, result, absoluteExpiration);
            }
            if (typeof value === 'string' && value.length === 0) {
                // this operation is used to indicate that the key is present but has no value
                return;
            }
            return JSON.parse(value);
        } finally {
            if (client) {
                await this.tryRelease(client);
            }
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
