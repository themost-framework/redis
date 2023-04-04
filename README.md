# @themost/redis
Most Web Framework Redis Cache Module

@themost/redis implements the usage of [Redis](https://redis.io) 
as caching strategy of a [MOST Web Framework](https://github.com/themost-framework/themost) application.

#### Installation

    npm i @themost/redis

#### Configuration

Add settings#redis configuration section in your application configuration.

    {
        "settings": {
            "redis": {
                "options": {
                    "host": "127.0.0.1",
                    "port": 6379
                },
                "pool": {
                    "min": 2,
                    "max": 25
                }
            }
        }
    }

redis#options section contains options about connecting to redis backend and
redis#pool section contains options about configuring connection pooling.

Read more about connect options at [NodeRedis instructions](https://github.com/NodeRedis/node_redis#options-object-properties).

#### Additional Options
| Property  | Default   | Description |
|-----------|-----------|-------------|
| absolute_expiration | 1200 | The expiration timeout of a key in seconds, if a timeout has not been defined during set. After the timeout has expired, the key will automatically be deleted. |

Follow instructions provided by [Generic Pool](https://github.com/coopernurse/node-pool#documentation) 
to configure connection pooling.

#### Usage

Configure application services to use RedisCacheStrategy as default caching service.

    {
        "services": [
            ...
            {
                "serviceType": "@themost/data#DataCacheStrategy",
                "strategyType": "@themost/redis#RedisCacheStrategy"
            }
        ]
    }

