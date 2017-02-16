# NextModel

Rails like models using **ES6**. [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model.svg?branch=master)](https://travis-ci.org/tamino-martinius/node-next-model)

NextModel gives you the ability to:

* Represent **models** and their data.
* Represent **associations** between these models.
* Represent **inheritance** hierarchies through related models.
* Perform database operations in an **object-oriented** fashion.
* Uses **Promises** for database queries.

### Roadmap / Where can i contribute
* Fix **typos**
* Improve **documentation**
* `createdAt` and `updatedAt` **timestamps**
* Predefined and custom **validations**
* Add **callbacks** for eg. `beforeSave` to modify record before saving
* Improve **schema** with eg. default values, limits
* Improve **associations** eg. cascading deletions
* Add more packages for eg. **versioning** and **soft deleting**
* There are already some **tests**, but not every test case is covered.
* Add more connectors for eg. **graphQL** and **dynamoDB**
* `includes` prefetches relations with two db queries *(fetch records => pluck ids => fetch related records by ids)* instead of one query per related model.

  `User.includes({address: {}})`, `Profile.includes({user: {address: {}}})`
* Add a solution to create **Migrations**

## TOC
* [Naming Conventions](#naming-conventions)
* [Example](#example)
* [Model Instances](#model-instances)
  * [Build](#build)
  * [Create](#create)
* [Relations](#relations)
  * [Belongs To](#belongs-to)
  * [Has Many](#has-many)
  * [Has One](#has-one)
* [Searching](#searching)
  * [Where](#where)
  * [Order](#order)
  * [Scopes](#scopes)
  * [Unscope](#unscope)
* [Fetching](#fetching)
  * [All](#all)
  * [Count](#count)
  * [First](#first)
  * [Last](#last)
  * [Limit](#limit)
  * [Skip](#skip)
* [Class Properties](#class-properties)
  * [Model Name](#model-name)
  * [Schema](#schema)
  * [Connector](#connector)
  * [Identifier](#identifier)
  * [Table Name](#table-name)
  * [Accessors](#accessors)
  * [Cache](#cache)
  * [Default Scope](#default-scope)
  * [Default Order](#default-scope)
* [Instance Attributes](#instance-attributes)
  * [IsNew](#isnew)
  * [IsPersistent](#ispersistent)
  * [Attributes](#attributes)
  * [Custom Attributes](#custom-attributes)
* [Instance Callbacks](#instance-callbacks)
  * [Build Callbacks](#build-callbacks)
  * [Create Callbacks](#create-callbacks)
  * [Save Callbacks](#save-callbacks)
  * [Delete Callbacks](#delete-callbacks)
* [Instance Actions](#instance-actions)
  * [Assign](#assign)
  * [save](#save)
  * [delete](#delete)
  * [reload](#reload)
* [Changelog](#changelog)

## Naming Conventions

To keep the configuration as short as possible, its recommended to use the following conventions:

* Everything is in camel case.
  * `createdAt`
  * `someOtherValue`
* Classes should be singular start with an capital letter.
  * `Address`
  * `Chat`
  * `ChatMessage`
* Foreign keys are the class names starting with an lower case character and end with Id.
  * `User` - `userId`
  * `Chat` - `chatId`
  * `ChatMessage` - `chatMessageId`

## Example

~~~js
// import
const NextModel = require('next-model');

// model definitions
User = class User extends NextModel {
  static get modelName() {
    return 'User';
  }

  static get schema() {
    return {
      id: { type: 'integer' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      gender: { type: 'string' },
    };
  }

  static get hasMany() {
    return {
      addresses: { model: Address },
    };
  }

  static get males() {
    return this.scope({ where: { gender: 'male' }});
  }

  static get females() {
    return this.scope({ where: { gender: 'female' }});
  }

  static get withFirstName(firstName) {
    return this.scope({ where: { firstName }});
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }
};

Address = class Address extends NextModel {
  static get modelName() {
    return 'Address';
  }

  static get schema() {
    return {
      id: { type: 'integer' },
      street: { type: 'string' },
    };
  }

  static get belongsTo() {
    return {
      user: { model: User },
    };
  }
};

// Creating
user = User.build({ firstName: 'John', lastName: 'Doe' });
user.gender = 'male';
user.name === 'John Doe';
user.save().then(user => ... );

User.create({
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
}).then(user => ... );

user.addresses.create({
  street: 'Bakerstr.'
}).then(address => ...);

// Searching
User.males.all.then(users => ... );
User.withFirstName('John').first(user => ... );
User.addresses.all.then(addresses => ... );
User.where({ lastName: 'Doe' }).all.then(users => ... );
User.males.order({ lastName: 'asc' }).all.then(users => ... );
~~~

## Model Instances

### Build

Initializes new record without saving it to the database.

~~~js
address = Address.build({ street: '1st street' });
address.isNew === true;
~~~

### Create

Returns a `Promise` which returns the created record on success or the initialized if sth. goes wrong.

~~~js
Address.create({
  street: '1st street'
}).then(address => {
  address.isNew === false;
}).catch(address => {
  address.isNew === true;
});
~~~

### From Scopes and queries

An record can be `build` or `create`d from scopes. These records are created with scope values as default.

~~~js
address = user.addresses.build();
address.userId === user.id;

user = User.males.build();
user.gender === 'male';

user = User.withName('John').build();
user.name === 'John';

user = User.where({ gender: 'male'}).build();
user.gender === 'male';
~~~


## Relations

Define the Model associations. Describe the relation between models to get predefined scopes and constructors.

### Belongs To

~~~js
Address = class Address extends NextModel {
  static get belongsTo() {
    return {
      user: { model: User },
    }
  }
};

Address.create({
  userId: id
}).then(address => {
  return address.user;
}).then(user => {
  user.id === id;
});

address = Address.build();
address.user = user;
address.userId === user.id;
~~~

### Has Many

~~~js
User = class User extends NextModel {
  static get hasMany() {
    return {
      addresses: { model: Address },
    }
  }
};

user.addresses.all.then(addresses => ... );
user.addresses.create({ ... }).then(address => ... );
~~~

### Has One

~~~js
User = class User extends NextModel {
  static get hasOne() {
    return {
      address: { model: Address },
    }
  }
};

user.address.then(address => ... );
~~~

## Searching

### Where

Special query syntax is dependent on used connector. But all connectors and the cache supports basic attribute filtering.

~~~js
User.where({ gender: 'male' });
User.where({ age: 21 });
User.where({ name: 'John', gender: 'male' });
User.males.where({ name: 'John' });
~~~

### Order

The fetched data can be sorted before fetching then. The `order` function takes an object with property names as keys and the sort direction as value. Valid values are `asc` and `desc`.

~~~js
User.order({ name: 'asc' });
User.order({ name: 'desc' });
User.order({ name: 'asc', age: 'desc' });
User.males.order({ name: 'asc' });
~~~

### Scopes

Scopes are predefined search queries on a Model.

~~~js
User = class User extends NextModel {
  static get males() {
    return this.scope({ where: { gender: 'male' }});
  }

  static get females() {
    return this.scope({ where: { gender: 'female' }});
  }

  static get withName(name) {
    return this.scope({ where: { name }});
  }
};
~~~

Now you can use these scopes to search/filter records.

~~~js
User.males;
User.withName('John');
~~~

Scopes can be chained with other scopes or search queries.

~~~js
User.males.withName('John');
User.withName('John').where({ gender: 'transgender' });
~~~

### Build from scope

~~~js
profile = User.males.build();
profile.gender === 'male';
~~~

### Scope chaining

~~~js
User.males.young;
User.males.young.where({});
~~~

## Fetching

If you want to read the data of the samples of the [previous section](#fetching) you can fetch if with the following functions. Each fetching function will return a `Promise` to read the data.

### All

Returns all data of the query. Results can be limited by [skip](#skip) and [limit](#limit).

~~~js
User.all.then(users => ...);
User.males.all.then(users => ...);
User.where({ name: 'John' }).all.then(users => ...);
~~~

### First

Returns the first record which matches the query. Use **order** to sort matching records before fetching the first one.

~~~js
User.first.then(user => ...);
User.males.first.then(user => ...);
User.where({ name: 'John' }).first.then(user => ...);
User.order({ name: 'asc' }).first.then(user => ...);
~~~

### Last

Returns last matching record. Needs to have an **order** set to work properly.

~~~js
User.last.then(user => ...);
User.males.last.then(user => ...);
User.where({ name: 'John' }).last.then(user => ...);
User.order({ name: 'asc' }).last.then(user => ...);
~~~

### Count

Returns the count of the matching records. Ignores [order](#order), [skip](#skip) and [limit](#limit) and always returns complete count of matching records.

~~~js
User.count.then(count => ...);
User.males.count.then(count => ...);
User.where({ name: 'John' }).count.then(count => ...);
User.count === User.limit(5).count
~~~

## Class Properties

### Model Name

The model name needs to be defined for every model. The name should be singular camelcase, starting with an uppercase char.

~~~js
class User extends NextModel {
  static get modelName() {
    return 'User';
  }
}

class UserAddress extends NextModel {
  static get modelName() {
    return 'UserAddress';
  }
}
~~~

### Schema

A schema describes all (database stored) properties. Foreign keys from relations like [belongsTo](#belongsto) are automatically added to the schema. The existing types and their names are depending on the used Database connector.

~~~js
class User extends NextModel {
  static get schema() {
    return {
      id: { type: 'integer' },
      name: { type: 'string' },
    };
  }
}
~~~


### Connector

A connector is the bridge between models and the database.

Available connectors:
* [knex](https://github.com/tamino-martinius/node-next-model-knex-connector.git) (mySQL, postgres, sqlite3, ...)

The connector needs to be returned as static getter.

~~~js
Connector = require('next-model-knex-connector');
connector = new Connector(options);

class User extends NextModel {
  static get connector() {
    return connector;
  }
}
~~~

Define an base model with connector to prevent adding connector to all Models.

~~~js
class BaseModel extends NextModel {
  static get connector() {
    return connector;
  }
}

class User extends BaseModel {
  ...
}

class Address extends BaseModel {
  ...
}
~~~


### Identifier

Defines the name of the primary key. Default values is `id`.

~~~js
class User extends BaseModel {
  static get identifier() {
    return 'key';
  }
}
~~~

You also need to define your identifier on the [schema](#schema).

~~~js
class User extends BaseModel {
  static get identifier() {
    return 'uid';
  }

  static get schema() {
    return {
      id: { type: 'uuid' },
      ...
    };
  }
}
~~~


### Table Name

The table name is usually generated from modelName. Default without connector is camelcase plural, starting with lowercase char.

~~~js
class User extends NextModel {
  static get modelName() {
    return 'User';
  }
}

User.tableName === 'users';

class UserAddress extends NextModel {
  static get modelName() {
    return 'UserAddress';
  }
}

UserAddress.tableName === 'userAddresses';
~~~

Table name generation is depending on the used connector. The following examples are for knex connector.

~~~js
class User extends NextModel {
  static get modelName() {
    return 'User';
  }
}

User.tableName === 'users';

class UserAddress extends NextModel {
  static get modelName() {
    return 'UserAddress';
  }
}

UserAddress.tableName === 'user_addresses';
~~~

You can also manually define an custom table name.

~~~js
class User extends NextModel {
  static get modelName() {
    return 'app_users';
  }
}
~~~

The table name could also be a function.

~~~js
class BaseModel extends NextModel {
  static get modelName() {
    return 'app_' + underscore(this.modelName);
  }
}

class User extends BaseModel { ... }
User.tableName === 'app_users';

class UserAddress extends BaseModel { ... }
UserAddress.tableName === 'app_user_addresses';
~~~

### Accessors

Accessors define properties which can be passed to [build](#build), [create](#create) functions or assignments, but are not passed to the database. Use them to store temporary data like passing values to model but not to database layer.

~~~js
class User extends NextModel {
  static get accessors {
    return [
      'checkForConflicts',
    ];
  }
}

user = User.build({ checkForConflicts: true });
user.checkForConflicts === true;

user = User.build({ foo: 'bar' });
user.foo === undefined;
~~~

### Cache

Caching is currently only working when the cache is manually filled. All searching and fetching are supported.

~~~js
User.cache = [
  { gender: 'male', name: 'John' },
  { gender: 'male', name: 'Doe' },
];
User.first.then(user => user.name === 'John');
User.order({ name: 'asc' }).first.then(user => user.name === 'Doe');
User.where( ... );
~~~

Cache is cleared when you fetch an base model out of an class, or when you [unscope](#unscope) or `reload` the data. But cache is only cleared in this [scope](#scope), the model itself is not modified.

~~~js
User.cache = [ ... ];

User.model.cache === undefined;
User.reload.cache === undefined;
User.cache === [ ... ];
~~~

### Default Scope

Adds an default scope for all queries made on the model. You need to [unscope](#unscope) the property to search without the default scope.

~~~js
class User extends NextModel {
  static get defaultScope {
    return {
      deletedAt: null,
    };
  }
}

User.first.then(user => user.deletedAt === null);
User.unscope('deletedAt').where( ... );
~~~

### Default Order

Adds an default Order to all queries unless its overwritten.

~~~js
class User extends NextModel {
  static get defaultOrder {
    return {
      name: 'asc',
    };
  }
}
~~~

## Instance Attributes

### isNew

An record is new unless the record is saved to the database. NextModel checks if the identifier property is set for this attribute.

~~~js
address = Address.build();
address.isNew === true;
address.save().then(address => {
  address.isNew === false;
});
~~~

### isPersistent

The opposite of [isNew](#isnew). Returns false unless the record is not saved to the database.

~~~js
address = Address.build();
address.isPersistent === false;
address.save().then(address => {
  address.isPersistent === true;
});
~~~

### attributes

Returns an object which contains all properties defined by schema and attrAccessors.

~~~js
class Address extends NextModel {
  static get schema() {
    return {
      street: { type: 'string' },
      city: { type: 'string' },
    };
  }

  static get attrAccessors() {
    return ['fetchGeoCoord'];
  }
}

address = Address.build({
  street: '1st street',
  city: 'New York',
  fetchGeoCoord: false,
});
address.foo = 'bar';

address.attributes() === {
  street: '1st street',
  city: 'New York',
  fetchGeoCoord: false
};
~~~

### databaseAttributes

Returns an object which contains all properties defined only by schema.

~~~js
class Address extends NextModel {
  static get schema() {
    return {
      street: { type: 'string' },
      city: { type: 'string' },
    };
  }

  static get attrAccessors() {
    return ['fetchGeoCoord'];
  }
}

address = Address.build({
  street: '1st street',
  city: 'New York',
  fetchGeoCoord: false,
});
address.foo = 'bar';

address.databaseAttributes() === {
  street: '1st street',
  city: 'New York',
};
~~~

### Custom Attributes

~~~js
class User extends NextModel {
  static get schema() {
    return {
      firstname: {type: String},
      lastname: {type: String}
    }
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }
}

user = User.build({
  firstname: 'Foo',
  lastname: 'Bar'
});
user.name === 'Foo Bar';
~~~

## Instance Callbacks

With callbacks you can run code before or after an action. Actions which currently supports callbacks are `save`. Callbacks are always named `before{Action}` and `after{Action}`. Callbacks can be defined in different ways. Callbacks can be functions, redirects or arrays.

_Note: Actions which are Promises also support Promises as callbacks._

Callback can be a function:

~~~js
class User extends NextModel {
  beforeSave() { ... }
}
~~~

Callback can return a function:

~~~js
class User extends NextModel {
  get beforeSave() {
    return function() { ... }
  }
}
~~~

Callback can redirect to a function with a string:

~~~js
class User extends NextModel {
  get beforeSave() {
    return 'prefillDefaults';
  }

  prefillDefaults() { ... }
}
~~~

Callback be an array of Strings:

~~~js
class User extends NextModel {
  get beforeSave() {
    return ['prefillDefaults', 'setTimestamps'];
  }

  prefillDefaults() { ... }

  setTimestamps() { ... }
}
~~~

Callback be an array of mix between functions and redirects:

~~~js
class User extends NextModel {
  get beforeSave() {
    return ['prefillDefaults', function() { ... }];
  }

  prefillDefaults() { ... }
}
~~~

Callback follow also multiple redirects and mixed arrays:

~~~js
class User extends NextModel {
  get beforeSave() {
    return ['prefillActions', function() { ... }];
  }

  get prefillActions() {
    return ['prefillDefaults', 'setTimestamps']
  }

  prefillDefaults() { ... }

  setTimestamps() { ... }
}
~~~

Before Actions are **always all** executed. If any callback before the action runs on an Error the Action will **not** be executed. If the Action runs on an Error the after callbacks will not be executed.

_Note: The execution order of callbacks can not be guaranteed, they run in parallel if possible._

### Build Callbacks

When [promiseBuild](#promisebuild) is triggered the callback order is:
`beforeBuild` -> `promiseBuild` -> `afterBuild`

~~~js
class User extends NextModel {
  static beforeBuild() {
    ...
  }

  static afterBuild() {
    ...
  }
}
~~~

### Create Callbacks

When [create](#create) is triggered the callback order is:
`beforeCreate` -> `beforeBuild` -> `promiseBuild` -> `afterBuild` -> `beforeSave` -> `save` -> `afterSave` -> `afterCreate`

~~~js
class User extends NextModel {
  static beforeCreate() {
    ...
  }

  static afterCreate() {
    ...
  }
}
~~~

### Save Callbacks

When [save](#save) is triggered the callback order is:
`beforeSave` -> `save` -> `afterSave`

~~~js
class User extends NextModel {
  beforeSave() {
    ...
  }

  afterSave() {
    ...
  }
}
~~~

### Delete Callbacks

When [delete](#delete) is triggered the callback order is:
`beforeDelete` -> `delete` -> `afterDelete`

~~~js
class User extends NextModel {
  beforeDelete() {
    ...
  }

  afterDelete() {
    ...
  }
}
~~~

## Instance Actions

### assign

You can assign a new value to an [schema](#schema) or [accessor](#accessors) defined property. This does **not** automatically save the data to the database.

~~~js
address.assignAttribute('street', '1st Street');
address.assign({
  street: '1st Street',
  city: 'New York',
});
~~~

### save

Saves the record to database. Returns a `Promise` with the created record including its newly created id. An already existing record gets updated.

~~~js
address = Address.build({street: '1st street'});
address.save().then(
  (address) => address.isNew === false;
).catch(
  (address) => address.isNew === true;
);
~~~

~~~js
address.street = 'changed';
address.save().then( ... );
~~~

### delete

Removes the record from database. Returns a `Promise` with the deleted record.

~~~js
address.isNew === false;
address.delete().then(
  (address) => address.isNew === true;
).catch(
  (address) => address.isNew === false;
);
~~~

### reload

Fetches all schema properties new from database. All other values stay untouched. Returns a `Promise` with the reloaded record.
~~~js
address.isNew === false;
address.street = 'changed';
address.notAnDatabaseColumn = 'foo';
address.reload().then((address) => {
  address.name === '1st Street';
  address.notAnDatabaseColumn === 'foo';
});
~~~

## Changelog

See [history](HISTORY.md) for more details.

`0.0.1` `2017-01-23` Initial commit with query and scoping functions.
