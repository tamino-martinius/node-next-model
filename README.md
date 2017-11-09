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
