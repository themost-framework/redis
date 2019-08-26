const redis = require('redis');
const genericPool = require("generic-pool");
const TraceUtils = require('@themost/common').TraceUtils;
const IApplication = require('@themost/common').IApplication;

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
        if (container instanceof IApplication) {
            TraceUtils.debug(`REDIS CACHE Get connection options from application configuration`);
            connectOptions = container.getConfiguration().getSourceAt('settings/redis/options');

            TraceUtils.debug(`REDIS CACHE Get connection pool options from application configuration`);
            conectionPoolOptions = container.getConfiguration().getSourceAt('settings/redis/pool');
        }
        else {
            TraceUtils.debug(`REDIS CACHE Get connection options from configuration`);
            connectOptions = container.getSourceAt('settings/redis/options');

            TraceUtils.debug(`REDIS CACHE Get connection pool options from configuration`);
            conectionPoolOptions = container.getSourceAt('settings/redis/pool');
        }
        // set connect options
        this.options = Object.assign({ }, connectOptions);
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
            // if absolute expiration is defined
            if (typeof absoluteExpiration === 'number' && absoluteExpiration >= 0) {
                // set item with expiration
                await new Promise((resolve, reject) => {
                    client.set(key, JSON.stringify(value), 'EX', absoluteExpiration, err => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
            else {
                // set item without expiration
                await new Promise((resolve, reject) => {
                    client.set(key, JSON.stringify(value), err => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
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
            client = await this.pool.acquire();
            const result = await new Promise((resolve, reject) => {
                client.del(key, err => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(true);
                });
            });
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
            client = await this.pool.acquire();
            const result = await new Promise((resolve, reject) => {
                client.get(key, (err, value) => {
                    if (err) {
                        return reject(err);
                    }
                    if (value) {
                        return resolve(JSON.parse(value));
                    }
                    return resolve();
                });
            });
            // try to release client
            this.pool.release(client);
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
            const self = this;
            client = await this.pool.acquire();
            const result = await new Promise((resolve, reject) => {
                client.get(key, (err, value) => {
                    if (err) {
                        return reject(err);
                    }
                    if (value == null) {
                        // call default value func
                        return getDefaultValue().then(value => {
                            // add value to cache for future calls
                            return self.set(key, value, absoluteExpiration).then(() => {
                                return resolve(value);
                            });
                        }).catch(err => {
                            return reject(err);
                        });
                    }
                    return resolve(JSON.parse(value));
                });
            });
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