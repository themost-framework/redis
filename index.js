const ApplicationService = require('@themost/common').ApplicationService;
const redis = require('redis');
class RedisCacheStrategy {

    constructor(config) {
        // set connect options
        this.options = Object.assign({ }, config.getSourceAt('settings/redis'));
    }

    open() {
        return redis.createClient(this.options);
    }

    /**
     *
     * @param {string} key
     * @param {*} value
     * @param {number=} absoluteExpiration
     * @returns Promise<*>
     */
    add(key, value, absoluteExpiration) {
        const client  = this.open();
        if (typeof absoluteExpiration === 'number') {
            return new Promise((resolve, reject) => {
                client.set(key, JSON.stringify(value), 'EX', absoluteExpiration, err => {
                    // close client
                    client.end(true);
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            });
        }
        return new Promise((resolve, reject) => {
                client.set(key, JSON.stringify(value), err => {
                    // close client
                    client.end(true);
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            });
    }

    /**
     *
     * @param {string} key
     * @returns Promise<*>
     */
    remove(key) {
        const client  = this.open();
        return new Promise((resolve, reject) => {
                client.del(key, err => {
                    // close client
                    client.end(true);
                    if (err) {
                        return reject(err);
                    }
                    return resolve(true);
                });
            });
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
    get(key) {
        const client  = this.open();
        return new Promise((resolve, reject) => {
                client.get(key, (err, value) => {
                    // close client
                    client.end(true);
                    if (err) {
                        return reject(err);
                    }
                    if (value) {
                        return resolve(JSON.parse(value));    
                    }
                    return resolve();
                });
            });
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
        const client  = this.open();
        return new Promise((resolve, reject) => {
                client.get(key, (err, value) => {
                    // close client
                    client.end(true);
                    if (err) {
                        return reject(err);
                    }
                    if (value == null) {
                        return getDefaultValue().then( value => {
                            // add value to cache for future calls
                            return self.set(key, value, absoluteExpiration).then(() => {
                                return resolve(value);
                            });
                        }).catch( err => {
                            return reject(err);
                        });
                    }
                    return resolve(JSON.parse(value));
                });
            });
    }

}

module.exports.RedisCacheStrategy = RedisCacheStrategy;