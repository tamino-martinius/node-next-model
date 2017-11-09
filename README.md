# NextModel

Rails like models using **TypeScript**. [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model.svg?branch=typescript-experimental)](https://travis-ci.org/tamino-martinius/node-next-model)

NextModel gives you the ability to:

* Represent **models** and their data.
* Represent **associations** between these models.
* Represent **inheritance** hierarchies through related models.
* Perform database operations in an **object-oriented** fashion.
* Uses **Promises** for database queries.

## Roadmap / Where can i contribute

See [GitHub](https://github.com/tamino-martinius/node-next-model/projects/1) project for current progress/tasks

* Fix **typos**
* Improve **documentation**
* `createdAt` and `updatedAt` **timestamps**
* Predefined and custom **validations**
* Improve **schema** with eg. default values, limits
* Improve **associations** eg. cascading deletions
* Add more packages for eg. **versioning** and **soft deleting**
* Help to improve **tests** and the test **coverage**.
* Add more connectors for eg. **graphQL** and **dynamoDB**
* `includes` prefetches relations with two db queries *(fetch records => pluck ids => fetch related records by ids)* instead of one query per related model.

  `User.includes({address: {}})`, `Profile.includes({user: {address: {}}})`
* Add a solution to create **Migrations**

## TOC

* [Naming Conventions](#naming-conventions)
* [Example](#example)
* [Model Instances](#model-instances)
  * [build](#build)
  * [create](#create)
* [Relations](#relations)
  * [belongsTo](#belongsto)
  * [hasMany](#hasmany)
  * [hasOne](#hasone)
* [Queries](#searching)
  * [queryBy](#where)
  * [orderBy](#order)
  * [skip](#skip)
  * [limit](#limit)
* [Scopes](#scopes)
  * [Scope chaining](#scope-chaining)
  * [Build from scope](#build-from-scope)
* [Fetching](#fetching)
  * [all](#all)
  * [first](#first)
  * [count](#count)
* [Batches](#batches)
  * [updateAll](#updateall)
  * [deleteAll](#deleteall)
  * [count](#count)
* [Class Properties](#class-properties)
  * [modelName](#modelname)
  * [Schema](#schema)
  * [dbConnector](#dbconnector)
  * [identifier](#identifier)
  * [attrAccessors](#attraccessors)
  * [query](#query)
  * [order](#order)
  * [skip](#skip)
  * [limit](#limit)
* [Instance Attributes](#instance-attributes)
  * [isNew](#isnew)
  * [isPersistent](#ispersistent)
  * [attributes](#attributes)
  * [dbAttributes](#dbattributes)
  * [isChanged](#ischanged)
  * [changes](#changes)
  * [errors](#errors)
  * [Custom Attributes](#custom-attributes)
* [Instance Callbacks](#instance-callbacks)
* [Instance Actions](#instance-actions)
  * [assign](#assign)
  * [save](#save)
  * [delete](#delete)
  * [reload](#reload)
  * [isValid](#isvalid)
* [Changelog](#changelog)

## Naming Conventions

To keep the configuration as short as possible, its recommended to use the following conventions:

* Use camel case for multiple words
  * `createdAt`
  * `someOtherValue`
  * `ChatMessage`
* Every property starts with lower case.
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

~~~ts
// import
import {
  Model,
  NextModel,
  Schema,
  BelongsTo,
  HasMany,
} from 'next-model';

// model definitions
@Model
class User extends NextModel {
  // This typings are optional but improves autocomplete
  id: number;
  firstName: string;
  lastName: string;
  gender: string;

  static get schema(): Schema {
    return {
      id: { type: 'integer' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      gender: { type: 'string' },
    };
  }

  static get hasMany(): HasMany {
    return {
      addresses: { model: Address },
    };
  }

  static get males(): typeof NextModel {
    return this.queryBy({ gender: 'male' });
  }

  static get females(): typeof NextModel {
    return this.queryBy({ gender: 'female' });
  }

  static withFirstName(firstName): typeof NextModel {
    return this.queryBy({ firstName });
  }

  get name(): string {
    return `${this.firstName} ${this.lastName}`;
  }
};

@Model
class Address extends NextModel {
  static get schema(): Schema {
    return {
      id: { type: 'integer' },
      street: { type: 'string' },
    };
  }

  static get belongsTo(): BelongsTo {
    return {
      user: { model: User },
    };
  }
};

// Creating
user = User.males.build({ firstName: 'John', lastName: 'Doe' });
user.gender === 'male';
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
User.queryBy({ lastName: 'Doe' }).all.then(users => ... );
User.males.order({ lastName: 'asc' }).all.then(users => ... );
~~~

## Model Instances

### build

Initializes new record without saving it to the database.

~~~js
user = User.build({ firstName: 'John', lastName: 'Doe' });
user.isNew === true;
user.name === 'John Doe';
~~~

### create

Returns a `Promise` which returns the created record on success or the initialized if sth. goes wrong.

~~~js
User.create({
  firstName: 'John',
  lastName: 'Doe',
}).then(user => {
  user.isNew === false;
}).catch(user => {
  user.isNew === true;
});
~~~

### From Scopes and queries

An record can be `build` or `create`d from scopes. These records are created with scope values as default.

~~~js
address = user.addresses.build();
address.userId === user.id;

user = User.males.build();
user.gender === 'male';

user = User.withFirstName('John').build();
user.firstName === 'John';

user = User.withFirstName('John').queryBy({ lastName: 'Doe' }).build();
user.name === 'John Doe';

user = User.where({ gender: 'male'}).build();
user.gender === 'male';
~~~

## Relations

Define the Model associations. Describe the relation between models to get predefined scopes and constructors.

### belongsTo

~~~js
@Model
class Address extends NextModel {
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

### hasMany

~~~js
@Model
class User extends NextModel {
  static get hasMany() {
    return {
      addresses: { model: Address },
    }
  }
};

user.addresses.all.then(addresses => ... );
user.addresses.create({ ... }).then(address => ... );
~~~

### hasOne

~~~js
@Model
class User extends NextModel {
  static get hasOne() {
    return {
      address: { model: Address },
    }
  }
};

user.address.then(address => ... );
~~~

## Queries

### queryBy

Special query syntax is dependent on used connector. But all connectors and the cache supports basic attribute filtering and the special queries $and, $or and $now. All special queries start with an leading $.

~~~js
User.queryBy({ gender: 'male' });
User.queryBy({ age: 21 });
User.queryBy({ name: 'John', gender: 'male' });
User.queryBy({ $or: [
  { firstName: 'John' },
  { firstName: 'Foo' },
]});
User.queryBy({ $and: [
  { firstName: 'John' },
  { lastName: 'Doe' },
]});
User.queryBy({ $not: [
  { gender: 'male' },
  { gender: 'female' },
]});
User.males.queryBy({ name: 'John' });
~~~

### orderBy

The fetched data can be sorted before fetching then. The `orderBy` function takes an object with property names as keys and the sort direction as value. Valid values are `asc` and `desc`.

~~~js
User.orderBy({ name: 'asc' });
User.orderBy({ name: 'desc' });
User.orderBy({ name: 'asc', age: 'desc' });
User.males.orderBy({ name: 'asc' });
~~~

### skip

An defined amont of matching records can be skipped with `.skipBy(amount)` and be resetted with  `.unskipped`. The current skipped amount of records can be fetched with `.skip`.

*Please note:* `.skipBy(amount)` and `.unskipped` will return a scoped model and will not modify the existing one.

Default value is `0`.

~~~js
User.count; //=> 10
User.skip; //=> 0
User.skipBy(3).count; //=> 7
User.skip; //=> 0 !
User = User.skipBy(15);
User.skip; //=> 15
User.skipBy(5).unskipped.count; //=> 10
~~~

### limit

The resultset can be limited with `.limitBy(amount)` and be resetted with  `.unlimited`. The current limit can be fetched with `.limit`.

*Please note:* `.limitBy(amount)` and `.unlimited` will return a scoped model and will not modify the existing one.

Default value is `Number.MAX_SAFE_INTEGER`.

~~~js
User.count; //=> 10
User.limit; //=> Number.MAX_SAFE_INTEGER
User.limitBy(3).count; //=> 3
User.limit; //=> Number.MAX_SAFE_INTEGER !
User = User.limitBy(15);
User.limit; //=> 15
User.limitBy(5).unlimited.count; //=> 10
~~~

## Scopes

Scopes are predefined search queries on a Model.

~~~js
@Model
class User extends NextModel {
  static get males() {
    return this.queryBy({ gender: 'male' });
  }

  static get females() {
    return this.queryBy({ gender: 'female' });
  }

  static get withFirstName(firstName) {
    return this.queryBy({ firstName });
  }
};
~~~

Now you can use these scopes to search/filter records.

~~~js
User.males;
User.withFirstName('John');
~~~

Scopes can be chained with other scopes or search queries.

~~~js
User.males.witFirsthName('John');
User.withFirstName('John').queryBy({ gender: 'transgender' });
~~~

### Build from scope

~~~js
profile = User.males.build();
profile.gender === 'male';
~~~

### Scope chaining

~~~js
User.males.young;
User.males.young.queryBy({ ... });
~~~

## Fetching

If you want to read the data of the samples of the [previous section](#fetching) you can fetch if with the following functions. Each fetching function will return a `Promise` to read the data.

### all

Returns all data of the query. Results can be limited by [skip](#skip) and [limitBy](#limit).

~~~js
User.all.then(users => ...);
User.males.all.then(users => ...);
User.queryBy({ firstName: 'John' }).all.then(users => ...);
~~~

### first

Returns the first record which matches the query. Use **orderBy** to sort matching records before fetching the first one.

~~~js
User.first.then(user => ...);
User.males.first.then(user => ...);
User.queryBy({ firstName: 'John' }).first.then(user => ...);
User.orderBy({ lastName: 'asc' }).first.then(user => ...);
~~~

### count

Returns the count of the matching records. Ignores [orderBy](#orderBy), [skip](#skip) and [limit](#limitBy) and always returns complete count of matching records.

~~~js
User.count.then(count => ...);
User.males.count.then(count => ...);
User.queryBy({ name: 'John' }).count.then(count => ...);
User.count === User.limit(5).count
~~~
