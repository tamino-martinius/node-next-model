# History

## vNext

## v0.0.4

Callbacks:
* Supported actions: `build`, `create`, `save` and `delete`
* have `before` and `after` hooks
* can be an `Function`, `Promise`, `Redirect` or `Array`

Added `promiseBuild` which returns Promise and supports callbacks for building new Instances.

## v0.0.3

Addec CI with Travis CI

## v0.0.2

Published knex connector

Functions removed:
* `.useCache`

Functions added:
* `.getCache`
* `.setCache`

## v0.0.1

First release includes following functions

**required properties**
* `.modelName`
* `.schema`
* `.connector`

**optional properties**
* `.identifier`
* `.tableName`
* `.attrAccessors`
* `.belongsTo`
* `.hasMany`
* `.hasOne`
* `.useCache`
* `.cacheData`
* `.defaultScope`
* `.defaultOrder`

**computed properties**
* `.keys`
* `.databaseKeys`
* `.hasCache`
* `.all`
* `.first`
* `.last`
* `.count`
* `.model`
* `.withoutScope`
* `.unorder`
* `.reload`

**functions**
* `.build(attrs)`
* `.create(attrs)`
* `.limit(amount)`
* `.unlimit()`
* `.skip(amount)`
* `.unskip()`
* `.withScope(scope)`
* `.order(order)`
* `.scope(options)`
* `.where(filter)`
* `.createTable()`
* `.fetchSchema()`
* `.fetchBelongsTo()`
* `.fetchHasMany()`
* `.fetchHasOne()`
* `.constructor(attrs)`

**computed properties**
* `#attributes`
* `#databaseAttributes`
* `#isNew`
* `#isPersisted`

**functions**
* `#assignAttribute(key, value)``
* `#assign(attrs)`
* `#save()`
* `#delete()`
* `#reload()`
