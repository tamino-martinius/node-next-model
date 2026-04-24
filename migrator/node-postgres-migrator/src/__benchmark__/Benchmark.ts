export class Benchmark {
  constructor(public id: number) { }

  async setup(count: number): Promise<void> {
    console.log(count);
  }

  async teardown(): Promise<void> {
  }

  async main(): Promise<void> {
    throw 'must be implemented';
  }

  async run(): Promise<number> {
    const start = Date.now();
    await this.main();
    return Date.now() - start;
  }
}
