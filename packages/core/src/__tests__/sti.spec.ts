import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  animals: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      type: { type: 'string' },
      name: { type: 'string' },
      species: { type: 'string' },
      sound: { type: 'string' },
    },
  },
});

describe('Single Table Inheritance', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage }, { schema });

  function makeModels() {
    const Animal = Model({
      tableName: 'animals',
      connector: connector(),
      inheritColumn: 'type',
    });
    const Dog = Animal.inherit({ type: 'Dog' });
    const Cat = Animal.inherit({ type: 'Cat' });
    return { Animal, Dog, Cat };
  }

  beforeEach(() => {
    storage = {
      animals: [
        { id: 1, type: 'Dog', name: 'Rex', species: 'Labrador', sound: 'woof' },
        { id: 2, type: 'Cat', name: 'Whiskers', species: 'Tabby', sound: 'meow' },
        { id: 3, type: 'Dog', name: 'Buddy', species: 'Beagle', sound: 'bark' },
        { id: 4, type: 'Unknown', name: 'Mystery', species: '', sound: '' },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('inheriting sets the inheritType on the subclass but not the base', () => {
    const { Animal, Dog } = makeModels();
    expect(Animal.inheritColumn).toBe('type');
    expect(Animal.inheritType).toBeUndefined();
    expect(Dog.inheritType).toBe('Dog');
    expect(Animal.inheritRegistry?.get('Dog')).toBe(Dog);
  });

  it('create on a subclass writes the discriminator column', async () => {
    const { Dog } = makeModels();
    await Dog.create({ name: 'Fido', species: 'Lab', sound: 'woof' });
    const rows = storage.animals;
    const fido = rows.find((r) => r.name === 'Fido');
    expect(fido?.type).toBe('Dog');
  });

  it('find on base returns the matching subclass instance', async () => {
    const { Animal, Dog, Cat } = makeModels();
    const rex = (await Animal.find(1)) as any;
    expect(rex).toBeInstanceOf(Dog);
    expect(rex).toBeInstanceOf(Animal);
    const whiskers = (await Animal.find(2)) as any;
    expect(whiskers).toBeInstanceOf(Cat);
  });

  it('base.all() returns a mixed list of subclass instances', async () => {
    const { Animal, Dog, Cat } = makeModels();
    const animals = (await Animal.all()) as any[];
    const types = animals.map((a) => a.constructor.name || (a as any).constructor);
    expect(animals.some((a) => a instanceof Dog)).toBe(true);
    expect(animals.some((a) => a instanceof Cat)).toBe(true);
    // Unknown-type row instantiates the base class
    const unknown = animals.find((a) => (a.attributes as any).name === 'Mystery');
    expect(unknown).toBeInstanceOf(Animal);
    expect(unknown).not.toBeInstanceOf(Dog);
    expect(unknown).not.toBeInstanceOf(Cat);
    void types;
  });

  it('subclass.all() is auto-filtered to its type', async () => {
    const { Dog } = makeModels();
    const dogs = await Dog.all();
    expect(dogs.map((d: any) => d.attributes.name).sort()).toEqual(['Buddy', 'Rex']);
  });

  it('subclass scopes / filters compose on top of the type scope', async () => {
    const { Dog } = makeModels();
    const count = await Dog.filterBy({ species: 'Beagle' }).count();
    expect(count).toBe(1);
  });

  it('throws when inherit() is called on a Model without inheritColumn', () => {
    const Animal = Model({
      tableName: 'animals',
      connector: connector(),
    });
    expect(() => Animal.inherit({ type: 'Dog' })).toThrowError(/inheritColumn/);
  });

  it('subclass-specific validators do not apply to sibling subclasses', async () => {
    const Animal = Model({
      tableName: 'animals',
      connector: connector(),
      inheritColumn: 'type',
    });
    const Dog = Animal.inherit({
      type: 'Dog',
      validators: [(r: any) => r.name === 'Rex'],
    });
    const Cat = Animal.inherit({ type: 'Cat' });
    const dog = Dog.build({ name: 'Other' });
    expect(await dog.isValid()).toBe(false);
    const cat = Cat.build({ name: 'Whiskers' });
    expect(await cat.isValid()).toBe(true);
  });

  it('reload preserves the subclass identity', async () => {
    const { Animal, Dog } = makeModels();
    const rex = (await Animal.find(1)) as any;
    expect(rex).toBeInstanceOf(Dog);
    await rex.reload();
    expect(rex).toBeInstanceOf(Dog);
  });
});
