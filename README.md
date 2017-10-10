# NextModel

Rails like models using **TypeScript**. [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model.svg?branch=typescript-experimental)](https://travis-ci.org/tamino-martinius/node-next-model)

NextModel gives you the ability to:

* Represent **models** and their data.
* Represent **associations** between these models.
* Represent **inheritance** hierarchies through related models.
* Perform database operations in an **object-oriented** fashion.
* Uses **Promises** for database queries.

### Roadmap / Where can i contribute

See [GitHub](https://github.com/tamino-martinius/node-next-model/projects/1) project for current progress/tasks

* Convert to typescript
* Implement NextModel as a Decorator for classes
* Fix **typos**
* Improve **documentation**
* `createdAt` and `updatedAt` **timestamps**
* Predefined and custom **validations**
* Improve **schema** with eg. default values, limits
* Improve **associations** eg. cascading deletions
* Add more packages for eg. **versioning** and **soft deleting**
* There are already some **tests**, but not every test case is covered.
* Add more connectors for eg. **graphQL** and **dynamoDB**
* `includes` prefetches relations with two db queries *(fetch records => pluck ids => fetch related records by ids)* instead of one query per related model.

  `User.includes({address: {}})`, `Profile.includes({user: {address: {}}})`
* Add a solution to create **Migrations**
