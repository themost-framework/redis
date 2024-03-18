const { serveApplication, getApplication } = require('@themost/test');
const container = getApplication();
const { DataCacheStrategy } = require('@themost/data');
const { RedisCacheStrategy } = require('../index');

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
serveApplication(container, 3000);