// import {
//   Model,
//   NextModel,
//   SchemaAttribute,
//   Schema,
//   BelongsTo,
//   HasMany,
// } from '../next_model';

// @Model
// export class User extends NextModel {
//   static get hasMany(): HasMany {
//     return {
//       userAddresses: { model: UserAddress },
//     };
//   }

//   static get schema(): Schema {
//     return {
//       id: <SchemaAttribute<number>>{ type: 'integer' },
//       firstName: <SchemaAttribute<string>>{ type: 'string', defaultValue: '' },
//       lastName: <SchemaAttribute<string>>{ type: 'string', defaultValue: '' },
//     };
//   }
// };

// @Model
// export class Address extends NextModel {
//   static get hasMany(): HasMany {
//     return {
//       userAddresses: { model: UserAddress },
//     };
//   }

//   static get schema(): Schema {
//     return {
//       id: <SchemaAttribute<number>>{ type: 'integer' },
//       street: <SchemaAttribute<string>>{ type: 'string', defaultValue: '' },
//       number: <SchemaAttribute<number>>{ type: 'integer', defaultValue: undefined },
//       postalCode: <SchemaAttribute<string>>{ type: 'string', defaultValue: '' },
//     };
//   }
// };

// @Model
// export class UserAddress extends NextModel {
//   static get schema(): Schema {
//     return {
//     };
//   }

//   static get belongsTo(): BelongsTo {
//     return {
//       user: { model: User },
//       address: { model: Address },
//     };
//   }
// };
