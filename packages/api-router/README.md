# NextModelApiRouter

Api Router for [NextModel](https://github.com/tamino-martinius/node-next-model) package.

 [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model-api-router.svg?branch=master)](https://travis-ci.org/tamino-martinius/node-next-model-api-router)

Features:
* **Shared Router** for Server and Client.
* Allows to plug in **every server** or **client** side Api connnector.
* Allows Api-Endpoint to de on a **different domain**
* Api **Versioning**
* Custom **Routes** and **Actions**

### Roadmap / Where can i contribute

See [GitHub project](https://github.com/tamino-martinius/node-next-model-api-router/projects/1) for current progress/tasks

* Fix Typos
* Add **user credentials** to queries
* Add more **examples**
* There are already some **tests**, but not every test case is covered

## TOC

* [Examples](#examples)
* [Api Route](#api-route)
  * [Api Domain](#api-domain)
  * [Api Path](#api-path)
  * [Api Version](#api-version)
* [Resource Routes](#resource-routes)
  * [Defaults](#defaults)
  * [Path](#path)
  * [Method](#method)
  * [Name](#name)
  * [Transform](#transform)
  * [Postfix](#postfix)
* [Changelog](#changelog)

## Examples

Create Router with Api route:
~~~js
const router = new NextModelApiRouter({
  domain: 'http://example.com',
  path: 'api',
  version: 'v1',
});

router.resouce('User'); // modelName
~~~

_Routes:_
~~~
all    : POST http://example.com/api/v1/users
first  : POST http://example.com/api/v1/users/first
last   : POST http://example.com/api/v1/users/last
count  : POST http://example.com/api/v1/users/count
insert : POST http://example.com/api/v1/users/create

show   : POST http://example.com/api/v1/user/:user_id
update : POST http://example.com/api/v1/user/:user_id/update
delete : POST http://example.com/api/v1/user/:user_id/delete
~~~

Pick only some default actions:
~~~js
router.resouce('User', {
  only: ['all'],
});
~~~

_Routes:_
~~~
all    : POST /users
~~~


Modify default actions:
~~~js
router.resouce('User', {
  only: {
    all: { method: 'get' },
  },
});
~~~

_Routes:_
~~~
all    : GET  /users
~~~

Exclude some default actions:
~~~js
router.resouce('User', {
  except: ['create', 'update', 'delete'],
});
~~~

_Routes:_
~~~
all    : POST /users
first  : POST /users/first
last   : POST /users/last
count  : POST /users/count

show   : POST /user/:user_id
~~~

Add collection actions:
~~~js
router.resouce('User', {
  only: [],
  collection: ['foo'],
});
~~~

_Routes:_
~~~
foo    : POST /users/foo
~~~

Customize collection actions:
~~~js
router.resouce('User', {
  only: [],
  collection: {
    foo: { path: 'bar' },
  },
});
~~~

_Routes:_
~~~
foo    : POST /users/bar
~~~

Add member actions:
~~~js
router.resouce('User', {
  only: [],
  member: ['foo'],
});
~~~

_Routes:_
~~~
foo    : POST /user/:user_id/foo
~~~

Customize member actions:
~~~js
router.resouce('User', {
  only: [],
  member: {
    foo: { path: 'bar' },
  },
});
~~~

_Routes:_
~~~
foo    : POST /user/:user_id/bar
~~~

## Api Route

The Api Route is defined while creating an router. The Domain, Path and Api version can be defined:

~~~js
const router = new NextModelApiRouter({
  domain: 'http://example.com',
  path: 'api',
  version: 'v1',
});

router.resouce('User');
~~~

_Routes:_
~~~
all    : POST http://example.com/api/v1/users
first  : POST http://example.com/api/v1/users/first
last   : POST http://example.com/api/v1/users/last
count  : POST http://example.com/api/v1/users/count
insert : POST http://example.com/api/v1/users/create

show   : POST http://example.com/api/v1/user/:user_id
update : POST http://example.com/api/v1/user/:user_id/update
delete : POST http://example.com/api/v1/user/:user_id/delete
~~~

### Api Domain

The Api Domain is optional and only used on the Client side. Use this parameter when your Api is running on an different domain than the UI.

_Default:_ `''`

~~~js
const router = new NextModelApiRouter({
  domain: 'http://example.com',
});
~~~
~~~
http://example.com/ ...
~~~

Domain does not need to have an protocol defined.
~~~js
const router = new NextModelApiRouter({
  domain: '//example.com',
});
~~~
~~~
//example.com/ ...
~~~


### Api Path

The path defines the root folder in which the Api runs.

_Default:_ `''`

~~~js
const router = new NextModelApiRouter({
  path: 'api',
});
~~~
~~~
/api/ ...
~~~

The path can be nested:
~~~js
const router = new NextModelApiRouter({
  path: 'app/api',
});
~~~
~~~
/app/api/ ...
~~~

### Api Version

The Api version is usually defined among with the [Api Path](#api-path).

_Default:_ `''`

~~~js
const router = new NextModelApiRouter({
  path: 'api',
  version: 'v1',
});
~~~
~~~
/api/v1/ ...
~~~

Can be in a nested path:
~~~js
const router = new NextModelApiRouter({
  path: 'app/api',
  version: 'latest',
});
~~~
~~~
/app/api/latest/ ...
~~~

## Resource Routes

Each resource added to the Router has some predefined Api routes.

_Default Routes for `User` model:_
~~~
all    : POST /users
first  : POST /users/first
last   : POST /users/last
count  : POST /users/count
insert : POST /users/create

show   : POST /user/:user_id
update : POST /user/:user_id/update
delete : POST /user/:user_id/delete
~~~

### Defaults

Each resource can have some defaults which are used for every route.

_Default:_
~~~js
{
  collectionTransform: 'pluralize',
  memberTransform: 'singularize',
  method: 'post',
  postfix: '',
}
~~~

The name of the resource is inherited by the tableName of the model. This can be changed with the `name` property:

~~~js
router.resouce('User', {
  collection: {
    defaults: { name: 'foo' },
  },
});
~~~

_Routes:_
~~~
all    : POST /foos
first  : POST /foos/first
last   : POST /foos/last
count  : POST /foos/count
insert : POST /foos/create

show   : POST /foo/:foo_id
update : POST /foo/:foo_id/update
delete : POST /foo/:foo_id/delete
~~~

### Path

The `path` can be defined for every action. The default action has already predefined paths. The custom collection or member actions have a default path which matches the action name.

~~~js
router.resouce('User', {
  collection: {
    foo: {},
  },
});
~~~

_Routes:_
~~~
foo    : POST /users/foo
~~~

With custom path:
~~~js
router.resouce('User', {
  collection: {
    foo: { path: 'bar' },
  },
});
~~~

_Routes:_
~~~
foo    : POST /users/bar
~~~

### Method

The http methods url can be defined for every action (or globally per resource with [defaults](#defaults)).

_Default:_ `'post'`

_Please Note:_
The default is `post` for every route, cause the filter payload can be too large for query strings. Its not recommended to use `get` or other requests where payload is within the querystring.

~~~js
router.resouce('User', {
  only: {
    all: { method: 'get' },
    first: { method: 'get' },
    last: { method: 'get' },
    count: { method: 'get' },
    create: { method: 'post' },
    show: { method: 'get' },
    update: { method: 'put' },
    delete: { method: 'delete' },
  },
});
~~~

_Routes:_
~~~
all    : GET    /users
first  : GET    /users/first
last   : GET    /users/last
count  : GET    /users/count
create : POST   /users/create

show   : GET    /user/:user_id
update : POST   /user/:user_id/update
delete : DELETE /user/:user_id/delete
~~~

### Name

The name of the resouce can be changed per action, but its recommended to change it per resource with the [defaults](#defaults) settings.

~~~js
router.resouce('User', {
  only: {
    all: {},
    first: {},
    last: { name: 'foo' },
    update: {},
    delete: { name: 'bar' },
  },
});
~~~

_Routes:_
~~~
all    : POST /users
first  : POST /users/first
last   : POST /foos/last

update : POST /user/:user_id/update
delete : POST /bar/:bar_id/delete
~~~

### Transform

The name is automatically transformed to plural on collection actions and transformed to singular on member actions by the [default](#defaults) settings. Possible transforms are `pluralize`, `singularize` and `none`.

~~~js
router.resouce('User', {
  only: {
    all: {},
    first: {},
    last: { transform: 'singularize' },
    update: {},
    delete: { transform: 'pluralize' },
  },
});
~~~

_Routes:_
~~~
all    : POST /users
first  : POST /users/first
last   : POST /user/last

update : POST /user/:user_id/update
delete : POST /users/:user_id/delete
~~~

### Postfix

The name of the resouce can be changed per action, but its recommended to change it per resource with the [defaults](#defaults) settings.

~~~js
router.resouce('User', {
  only: {
    all: {},
    first: {},
    last: { postfix: '.json' },
    update: {},
    delete: { postfix: '.json' },
  },
});
~~~

~~~
all    : POST /users
first  : POST /users/first
last   : POST /users/last.json

update : POST /user/:user_id/update
delete : POST /user/:user_id/delete.json
~~~

## Changelog

See [history](HISTORY.md) for more details.

* `0.1.0` **2017-03-15** First public release
