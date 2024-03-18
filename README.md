# @themost/redis
Most Web Framework Redis Cache Module

`@themost/redis` implements the usage of [Redis](https://redis.io) as caching strategy of a [MOST Web Framework](https://github.com/themost-framework) application.

## Installation

```bash
npm i @themost/redis
```

## Configuration

Add `settings/redis` configuration section in your application configuration.

```json
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
```

The section`redis/options` contains options about configuring the connection to the Redis server.

Read more about connect options at [ioredis](https://github.com/redis/ioredis#connect-to-redis)

### Connection pooling

`@themost/redis` uses [generic-pool](https://github.com/coopernurse/node-pool) for connection pooling.
Configure `redis/pool` section to set minimum and maximum number of connections to be used.

Read about connection pooling options at [generic-pool](https://github.com/coopernurse/node-pool#documentation)


## Usage

Configure application services to use `RedisCacheStrategy` as caching service.

```json
{
    "services": [
        {
            "serviceType": "@themost/data#DataCacheStrategy",
            "strategyType": "@themost/redis#RedisCacheStrategy"
        }
    ]
}
```

