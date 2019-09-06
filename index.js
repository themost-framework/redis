const redis = require('redis');
const genericPool = require("generic-pool");
const TraceUtils = require('@themost/common').TraceUtils;
const IApplication = require('@themost/common').IApplication;
const promisify = require('es6-promisify').promisify;
class RedisConnectionPool {
    constructor(container) {
        Object.defineProperty(this, 'container', {
            enumerable: false,
            writable: false,
            value: container
        });
    }

    create() {
        return redis.createClient(this.options);
    }

    destroy(client) {
        return client.end(true);
    }

}

class RedisCacheStrategy {

    constructor(container) {
        let connectOptions;
        let conectionPoolOptions;
        // container is typeof IApplication
        const thisService = this;
        if (typeof container.getConfiguration === 'function') {
            TraceUtils.debug(`REDIS CACHE Get connection options from application configuration`);
            connectOptions = container.getConfiguration().getSourceAt('settings/redis/options');

            TraceUtils.debug(`REDIS CACHE Get connection pool options from application configuration`);
            conectionPoolOptions = container.getConfiguration().getSourceAt('settings/redis/pool');
            // set data configuration strategy
            // search if container configuration has a service of hidden type of DataCacheStrategy (@themost/data)
            if (container.getConfiguration().hasStrategy(function DataCacheStrategy() { })) {
                // and set service of DataCacheStrategy type to have a strategy which returns this service
                container.getConfiguration().useStrategy(function DataCacheStrategy() { }, function() {
                    return thisService;
                });
            }
        }
        else {
            TraceUtils.debug(`REDIS CACHE Get connection options from configuration`);
            connectOptions = container.getSourceAt('settings/redis/options');

            TraceUtils.debug(`REDIS CACHE Get connection pool options from configuration`);
            conectionPoolOptions = container.getSourceAt('settings/redis/pool');
            if (typeof container.hasStrategy === 'function') {
                // set data configuration strategy
                // search if container has a service of hidden type of DataCacheStrategy (@themost/data)
                if (container.hasStrategy(function DataCacheStrategy() { })) {
                    // and set service of DataCacheStrategy type to have a strategy which returns this service
                    container.useStrategy(function DataCacheStrategy() { }, function() {
                        return thisService;
                    });
                }
            }
        }
        // set connect options
        this.options = Object.assign({ absolute_expiration: 1200 }, connectOptions);
        // set pool options
        const poolOptions = Object.assign({
            min: 2,
            max: 25
        }, conectionPoolOptions);
        // create generic createPool
        this.pool = genericPool.createPool(new RedisConnectionPool(this), poolOptions);
        TraceUtils.debug(`REDIS CACHE Connection pool was succesfully created.`);
    }
    /**
     *
     * @param {string} key
     * @param {*} value
     * @param {number=} absoluteExpiration
     * @returns Promise<*>
     */
    async add(key, value, absoluteExpiration) {
        let client;
        try {
            // get client
            client = await this.pool.acquire();
            const setAsync = promisify(client.set).bind(client);
            // if absolute expiration is defined
            if (typeof absoluteExpiration === 'number' && absoluteExpiration >= 0) {
                // set item with expiration
                await setAsync(key, JSON.stringify(value), 'EX', absoluteExpiration);
            }
            else {
                // get absolute expiration from connect options and set item
                await setAsync(key, JSON.stringify(value), 'EX', this.options.absolute_expiration);
            }
            // finally release create
            await this.pool.release(client);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.pool.release(client);
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
        let client;
        try {
            // get client
            client = await this.pool.acquire();
            const delAsync = promisify(client.del).bind(client);
            // remove item by key
            const result = await delAsync(key);
            // release client
            await this.pool.release(client);
            // return true if key has been removed
            return (result >= 1);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.pool.release(client);
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
        let client;
        try {
            // get client
            client = await this.pool.acquire();
            const getAsync = promisify(client.get).bind(client);
            // get item
            const result = await getAsync(key);
            // try to release client
            this.pool.release(client);
            if (result == null) {
                return;
            }
            return JSON.parse(result);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.pool.release(client);
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
            client = await this.pool.acquire();
            const getAsync = promisify(client.get).bind(client);

            // try to get item// get item
            let value = await getAsync(key);
            let result;
            if (value == null) {
                // call default value func
                result = await getDefaultValue();
                // add value to cache
                this.add(key, result, absoluteExpiration);
            }
            else {
                result = JSON.parse(value);
            }
            // release client
            await this.pool.release(client);
            return result;
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    await this.pool.release(client);
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

}

module.exports.RedisCacheStrategy = RedisCacheStrategy;