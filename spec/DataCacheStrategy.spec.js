const {RedisCacheStrategy} = require('../index');
const {ConfigurationBase, TraceUtils} = require('@themost/common');
const { DataCacheStrategy, SchemaLoaderStrategy } = require('@themost/data');
const { getApplication, getToken: authorize } = require('@themost/test');

describe('DataCacheStrategy', ()=> {

    /**
     * @type {import('@themost/data').DataContext}
     */
    let context;
    beforeAll(async () => {
        const container = getApplication();
        /**
         * @type {import('@themost/express').ExpressDataApplication}
         */
        const app = container.get('ExpressDataApplication');
        /**
         * @type {DataCacheStrategy}
         */
        const service = app.getConfiguration().getStrategy(DataCacheStrategy);
        service.finalize();
        app.getConfiguration().useStrategy(DataCacheStrategy, RedisCacheStrategy);
        context = app.createContext();
    });

    it('should use cache', async () => {
        const schema = context.getConfiguration().getStrategy(SchemaLoaderStrategy);
        const model = schema.getModelDefinition('ActionStatusType');
        model.caching = 'always';
        schema.setModelDefinition(model);
        context.user = {
            name: 'alexis.rees@example.com'
        }
        const ActionStatusTypes = context.model('ActionStatusType');
        const items = await ActionStatusTypes.getItems();
        expect(items).toBeTruthy();
        /**
         * @type {RedisCacheStrategy}
         */
        const service = context.getConfiguration().getStrategy(DataCacheStrategy);
        const deleted = await service.remove('/ActionStatusType/*');
        expect(deleted).toBeGreaterThan(0);
    });

    it('should should clear cache after update', async () => {
        const schema = context.getConfiguration().getStrategy(SchemaLoaderStrategy);
        const model = schema.getModelDefinition('ActionStatusType');
        model.caching = 'always';
        schema.setModelDefinition(model);
        context.user = {
            name: 'alexis.rees@example.com'
        }
        const ActionStatusTypes = context.model('ActionStatusType');
        let items = await ActionStatusTypes.getItems();
        expect(items).toBeTruthy();
        let item = await ActionStatusTypes.where('name').equal('PotentialActionStatus').getItem();
        item.name = 'PendingActionStatus';
        function cleanupCache(event, callback) {
            const { name, caching, context } = event.model;
            if (caching === 'none') {
                return callback();
            }
            const service = context.getConfiguration().getStrategy(DataCacheStrategy);
            if (service) {
                return service.remove(`/${name}/*`).then(() => {
                    return callback();
                }).catch((err) => {
                    TraceUtils.warn('An error occurred while cleaning up cache items');
                    TraceUtils.warn(err);
                    return callback();
                }); 
            }
            return callback();
        }
        await ActionStatusTypes.on('before.save', cleanupCache).save(item);
        items = await context.model('ActionStatusType').getItems();
        item = items.find(x => x.name === 'PendingActionStatus');
        expect(item).toBeTruthy();
        const service = context.getConfiguration().getStrategy(DataCacheStrategy);
        await service.remove('/ActionStatusType/*');
    });
});