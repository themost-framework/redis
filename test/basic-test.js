const RedisCacheStrategy = require('../index').RedisCacheStrategy;

describe('basic test', ()=> {
    it('should create strategy', ()=> {
        let cacheStrategy = new RedisCacheStrategy();
    });
});