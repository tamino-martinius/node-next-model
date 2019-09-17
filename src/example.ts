import { Model } from '../dist';
// import { Model } from '.';
enum Gender {
  male,
  female,
}

// [TODO] Remove example below
class User extends Model({
  tableName: 'users',
  init: (props: { firstName: string; lastName: string; gender: Gender }) => props,
}) {
  static get males() {
    return this.filterBy({ gender: Gender.male });
  }

  static get females() {
    return this.filterBy({ gender: Gender.female });
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

const user = User.build({ firstName: 'John', lastName: 'Doe', gender: Gender.male });
User.withFirstName('John').males.buildScoped({ lastName: 'bar', gender: Gender.male });

class Address extends Model({
  tableName: 'addresses',
  init: (props: { street: string; userId: number }) => props,
}) {
  get user() {
    return User.filterBy({ id: this.attributes.userId }).first;
  }
}
