import { Model } from '../dist';

// [TODO] Remove example below
class User extends Model({
  tableName: 'users',
  init: (props: { firstName: string; lastName: string; gender: string }) => props,
}) {
  static get males() {
    return this.filterBy({ gender: 'male' });
  }

  static get females() {
    return this.filterBy({ gender: 'female' });
  }

  static withFirstName(firstName: string) {
    return this.filterBy({ firstName });
  }

  get addresses() {
    return Address.filterBy({ id: this.attributes.id });
  }

  get name(): string {
    return `${this.attributes.firstName} ${this.attributes.lastName}`;
  }
}

class Address extends Model({
  tableName: 'addresses',
  init: (props: { street: string; userId: number }) => props,
}) {
  get user() {
    return User.filterBy({ id: this.attributes.userId }).first;
  }
}
