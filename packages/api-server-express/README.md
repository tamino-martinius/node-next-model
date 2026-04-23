# NextModelApiServerExpress

Api Server for [ApiClient](https://github.com/tamino-martinius/node-next-model-api-client-connector) using [NextModel](https://github.com/tamino-martinius/node-next-model) package.

 [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model-api-server-express.svg?branch=master)](https://travis-ci.org/tamino-martinius/node-next-model-api-server-express)

Features:
* **Shared model** for Server and Client.
* Allows to plug in **every server side connector** to connect Api to database
* Allows Api-Endpoint to de on a **different domain**
* Api **Versioning**
* Custom **Routes** and **Actions**

### Roadmap / Where can i contribute

See [GitHub project](https://github.com/tamino-martinius/node-next-model-api-server-express/projects/1) for current progress/tasks

* Fix Typos
* Add **user credentials** to queries
* Settings to configure **cors** headers
* Add more **examples**
* Add **exists**, **join** and **subqueries**
* There are already some **tests**, but not every test case is covered

## TOC

* [Example](#example)
* [Custom Routes](#custom-routes)
  * [Path](#path)
  * [Version](#version)
  * [Name](#name)
  * [Postfix](#postfix)
  * [Action Path](#action-path)
  * [Action Method](#action-method)
* [Changelog](#changelog)

## Example

~~~js
~~~

## Custom Routes

The route configuration is done at the defined _(shared)_ Model.

_Default Routes:_
~~~
all    : POST /users
first  : POST /users/first
last   : POST /users/last
count  : POST /users/count
insert : POST /users/create
update : POST /user/:id
delete : POST /user/:id/delete
~~~

### Path

The `routePath` defines the base route on the Server which contains the Api.

_Default:_ `''`

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get routePath() {
    return 'api';
  }
}

const User = class User extends BaseModel { ... }
~~~
~~~
all    : POST /api/users
first  : POST /api/users/first
last   : POST /api/users/last
count  : POST /api/users/count
insert : POST /api/users/create
update : POST /api/user/:id
delete : POST /api/user/:id/delete
~~~

### Version

The Api can be versioned with `routeVersion`.

_Default:_ `''`

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get routePath() {
    return 'api';
  }

  static get routeVersion() {
    return 'v1';
  }
}

const User = class User extends BaseModel { ... }
~~~
~~~
all    : POST /api/v1/users
first  : POST /api/v1/users/first
last   : POST /api/v1/users/last
count  : POST /api/v1/users/count
insert : POST /api/v1/users/create
update : POST /api/v1/user/:id
delete : POST /api/v1/user/:id/delete
~~~

### Name

The model name in the route defaults to the `tableName`, but can be overwritten by `routeName`.

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get routeName() {
    return 'account';
  }
}

const User = class User extends BaseModel { ... }
~~~
~~~
all    : POST /accounts
first  : POST /accounts/first
last   : POST /accounts/last
count  : POST /accounts/count
insert : POST /accounts/create
update : POST /account/:id
delete : POST /account/:id/delete
~~~

### Postfix

The `routePostfix` can be used to define a file name for the Url.

_Default:_ `''`

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get routePostfix() {
    return '.json';
  }
}

const User = class User extends BaseModel { ... }
~~~
~~~
all    : POST /users.json
first  : POST /users/first.json
last   : POST /users/last.json
count  : POST /users/count.json
insert : POST /users/create.json
update : POST /user/:id.json
delete : POST /user/:id/delete.json
~~~

### Action Path

The action url can be defined for every action.

_Defaults:_
* _all:_ `''`
* _first:_ `'/first'`
* _last:_ `'/last'`
* _count:_ `'/count'`
* _create:_ `'/create'`
* _update:_ `''`
* _delete:_ `'/_delete'`

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get allActionPath() {
    return '/all';
  }

  static get firstActionPath() {
    return '';
  }

  static get updateActionPath() {
    return '/update';
  }
}

const User = class User extends BaseModel { ... }
~~~
~~~
all    : POST /users/all
first  : POST /users
last   : POST /users/last
count  : POST /users/count
insert : POST /users/create
update : POST /user/:id/update
delete : POST /user/:id/delete
~~~

### Action Method

The method url can be defined for every action.

_Default:_ `'POST'`

_Please Note:_
The default is POST for every route, cause the filter payload can be too large for query strings.

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get allActionMethod() {
    return 'GET';
  }

  static get firstActionMethod() {
    return 'GET';
  }

  static get lastActionMethod() {
    return 'GET';
  }

  static get countActionMethod() {
    return 'GET';
  }

  static get updateActionMethod() {
    return 'PATCH';
  }

  static get deleteActionMethod() {
    return 'DELETE';
  }
}

const User = class User extends BaseModel { ... }
~~~
~~~
all    : GET    /users
first  : GET    /users/first
last   : GET    /users/last
count  : GET    /users/count
insert : POST   /users/create
update : PATCH  /user/:id
delete : DELETE /user/:id/delete
~~~

## Changelog

See [history](HISTORY.md) for more details.

* `0.1.0` **2017-04-05 First public release
