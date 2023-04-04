const {RedisCacheStrategy} = require('../index');
const {ConfigurationBase} = require('@themost/common');
describe('RedisCacheStrategy', ()=> {
    let config;
    beforeAll(done => {
        config = new ConfigurationBase(__dirname);
        config.useStrategy(RedisCacheStrategy, RedisCacheStrategy);
        return done();
    });
    it('should create strategy', ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        expect(cacheStrategy).toBeTruthy();
    });
    it('should add string', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        await cacheStrategy.add('hello', 'Hello World');
        const value = await cacheStrategy.get('hello');
        expect(value).toEqual('Hello World');
        await cacheStrategy.remove('hello');
    });
    it('should add boolean', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        await cacheStrategy.add('value1', true);
        const value = await cacheStrategy.get('value1');
        expect(value).toEqual(true);
        await cacheStrategy.remove('value1');
    });
    it('should add number', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        await cacheStrategy.add('value1', 5.45);
        const value = await cacheStrategy.get('value1');
        expect(value).toEqual(5.45);
        await cacheStrategy.remove('value1');
    });
    it('should add object', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        await cacheStrategy.add('item1', {
            value: 100
        });
        const obj = await cacheStrategy.get('item1');
        expect(obj.value).toEqual(100);
        await cacheStrategy.remove('item1');
    });
    it('should use expiration', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        await cacheStrategy.add('expired1', true, 1);
        await new Promise((resolve, reject) => {
            setTimeout(()=> {
                cacheStrategy.get('expired1').then( value => {
                    expect(value).toBeFalsy();
                    return cacheStrategy.remove('expired1').then(() => {
                        return resolve();
                    });
                }).catch(err => {
                    return reject(err);
                });
            }, 2000);
        });
    });
    it('should remove item', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        await cacheStrategy.add('item1', {
            value: 100
        });
        let obj = await cacheStrategy.get('item1');
        expect(obj.value).toEqual(100);
        await cacheStrategy.remove('item1');
        obj = await cacheStrategy.get('item1');
        expect(obj).toBeFalsy();
        cacheStrategy.remove('item1');
    });

    it('should get default value', async ()=> {
        let cacheStrategy = config.getStrategy(RedisCacheStrategy);
        let obj = await cacheStrategy.getOrDefault('item1', ()=> {
            return Promise.resolve({
                value: 100
            });
        });
        expect(obj.value).toEqual(100);
        obj = await cacheStrategy.get('item1');
        expect(obj.value).toEqual(100);
        await cacheStrategy.remove('item1');
    });

});