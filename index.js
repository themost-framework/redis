const redis = require('redis');
const genericPool = require("generic-pool");

class RedisCacheStrategy {

    constructor(config) {
        // set connect options
        this.options = Object.assign({}, config.getSourceAt('settings/redis/options'));
        // set pool options
        const genericPoolOptions = Object.assign({
            min: 2,
            max: 25
        }, config.getSourceAt('settings/redis/pool'));
        // create generic pool
        this.pool = genericPool.createPool({
            create() {
                return redis.createClient(this.options);
            },
            destroy(client) {
                return client.end(true);
            }
        }, genericPoolOptions);
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
            this.pool.release(client);
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    this.pool.release(client);
                }
                catch(err) {
                    // do nothing
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
            this.pool.release(client);
            return result;
        }
        catch (err) {
            if (client) {
                try {
                    // try to release client
                    this.pool.release(client);
                }
                catch(err) {
                    // do nothing
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
        catch(err) {
            if (client) {
                try {
                    // try to release client
                    this.pool.release(client);
                }
                catch(err) {
                    // do nothing
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
    getOrDefault(key, getDefaultValue, absoluteExpiration) {
        const self = this;
        const client = this.open();
        return new Promise((resolve, reject) => {
            client.get(key, (err, value) => {
                // close client
                client.end(true);
                if (err) {
                    return reject(err);
                }
                if (value == null) {
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
    }

}

module.exports.RedisCacheStrategy = RedisCacheStrategy;