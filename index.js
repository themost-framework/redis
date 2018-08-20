const ApplicationService = require('@themost/common/app').ApplicationService;

class RedisCacheStrategy extends ApplicationService {

    constructor(app) {
        super(app);
    }

    /**
     *
     * @param {string} key
     * @param {*} value
     * @param {number=} absoluteExpiration
     * @returns Promise<*>
     */
    add(key, value, absoluteExpiration) {
        return Promise.resolve();
    }

    /**
     *
     * @param {string} key
     * @returns Promise<*>
     */
    remove(key) {
        return Promise.resolve();
    }
    /**
     *
     * @returns Promise<*>
     */
    clear() {
        return Promise.resolve();
    }

    /**
     *
     * @param {string} key
     * @returns Promise<*>
     */
    get(key) {
        return Promise.resolve();
    }
    /**
     *
     * @param {string} key
     * @param {Promise<*>} func
     * @param {number=} absoluteExpiration
     * @returns Promise<*>
     */
    getOrDefault(key, func, absoluteExpiration) {
        return Promise.resolve();
    }

}

module.exports.RedisCacheStrategy = RedisCacheStrategy;