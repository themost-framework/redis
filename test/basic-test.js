const RedisCacheStrategy = require('../index').RedisCacheStrategy;
describe('basic test', ()=> {
    it('should create strategy', ()=> {
        let cache = new RedisCacheStrategy();
    });
});