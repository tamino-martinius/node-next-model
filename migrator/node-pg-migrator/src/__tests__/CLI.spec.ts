import { context } from './types';
import { resolve } from 'path';
import { readdirSync, unlinkSync } from 'fs';
import {
  CLI,
  Logger,
} from '..';

if (!process.env.PGDATABASE) process.env.PGDATABASE = 'testcode';

let logger: Logger | undefined;
const connect = () => new CLI(logger);

beforeAll(async () => {
  return await connect().createDatabase();
});

afterAll(async () => {
  return await connect().dropDatabase();
});

afterEach(async () => {
  return await connect().dropTable();
});

describe('CLI', () => {
  describe('#new', () => {
    const subject = () => connect();

    context('when logger is not present', {
      definitions() {
        logger = undefined;
      },
      tests() {
        it('will set console.log as default', () => {
          expect(subject().logger).toBe(console.log);
        });
      },
    });

    context('when logger is passed', {
      definitions() {
        logger = jest.fn();
      },
      tests() {
        it('will use passed logger', () => {
          expect(subject().logger).toBe(logger);
        });
      },
    });
  });

  [
    'help',
    'migrateHelp',
    'upHelp',
    'downHelp',
    'createDatabaseHelp',
    'dropDatabaseHelp',
    'dropTableHelp',
    'createHelp',
  ].forEach((helpCommand) => {
    describe(`#${helpCommand}`, () => {
      const subject = () => connect()[helpCommand]();

      context('when logger is present', {
        definitions() {
          logger = jest.fn();
        },
        tests() {
          it('writes logs', () => {
            expect(logger).not.toHaveBeenCalled();
            subject();
            expect(logger).toHaveBeenCalled();
          });
        },
      });
    });
  });

  [
    'up',
    'down',
  ].forEach((command) => {
    describe(`#${command}`, () => {
      const subject = () => connect()[command]();

      context('when just no arguments are present', {
        definitions() {
          process.argv = [];
        },
        tests() {
          it('throws error', async () => {
            try {
              await subject();
            } catch (error) {
              return expect(error).toBeDefined();
            }
            expect(false).toBeTruthy(); // not expected to reach
          });
        },
      });

      context('when just folder arguments is present', {
        definitions() {
          process.argv = ['-f', resolve(__dirname)];
        },
        tests() {
          it('throws error', async () => {
            try {
              await subject();
            } catch (error) {
              return expect(error).toBeDefined();
            }
            expect(false).toBeTruthy(); // not expected to reach
          });
        },
      });

      context('when folder argument is incomplete', {
        definitions() {
          process.argv = ['-f'];
        },
        tests() {
          it('throws error', async () => {
            try {
              await subject();
            } catch (error) {
              return expect(error).toBeDefined();
            }
            expect(false).toBeTruthy(); // not expected to reach
          });
        },
      });

      context('when folder argument is directly followed by next', {
        definitions() {
          process.argv = ['-f', '-v'];
        },
        tests() {
          it('throws error', async () => {
            try {
              await subject();
            } catch (error) {
              return expect(error).toBeDefined();
            }
            expect(false).toBeTruthy(); // not expected to reach
          });
        },
      });

      context('when just name arguments is present', {
        definitions() {
          process.argv = ['-n', 'test_migration'];
        },
        tests() {
          it('throws error', async () => {
            try {
              await subject();
            } catch (error) {
              return expect(error).toBeDefined();
            }
            expect(false).toBeTruthy(); // not expected to reach
          });
        },
      });

      context('when name and folder arguments are present', {
        definitions() {
          process.argv = ['-f', resolve(__dirname), '-n', 'test_migration'];
        },
        tests() {
          it('reads migration from folder', async () => {
            const fn = require('./test_migration')[command];
            fn.mockClear();
            expect(fn).not.toBeCalled();
            await subject();
            expect(fn).toBeCalled();
          });
        },
      });

      context('when name and folder arguments are present with long notation', {
        definitions() {
          process.argv = [`--folder=${resolve(__dirname)}`, '--name=test_migration'];
        },
        tests() {
          it('reads migration from folder', async () => {
            const fn = require('./test_migration')[command];
            fn.mockClear();
            expect(fn).not.toBeCalled();
            await subject();
            expect(fn).toBeCalled();
          });
        },
      });

      context('when version and folder arguments are present', {
        definitions() {
          process.argv = ['-f', resolve(__dirname), '-v', 'test'];
        },
        tests() {
          it('reads migration from folder', async () => {
            const fn = require('./test_migration')[command];
            fn.mockClear();
            expect(fn).not.toBeCalled();
            await subject();
            expect(fn).toBeCalled();
          });
        },
      });

      context('when version is not present', {
        definitions() {
          process.argv = ['-f', resolve(__dirname), '-v', 'foo'];
        },
        tests() {
          it('throws error', async () => {
            try {
              await subject();
            } catch (error) {
              return expect(error).toBeDefined();
            }
            expect(false).toBeTruthy(); // not expected to reach
          });
        },
      });
    });
  });

  describe('#migrate', () => {
    const subject = () => connect().migrate();

    context('when folder arguments are present', {
      definitions() {
        process.argv = ['-f', resolve(__dirname)];
      },
      tests() {
        it('reads migration from folder', async () => {
          const fn = require('./test_migration').up;
          fn.mockClear();
          expect(fn).not.toBeCalled();
          await subject();
          expect(fn).toBeCalled();
        });
      },
    });

    context('when folder argument is present with long notation', {
      definitions() {
        process.argv = [`--folder=${resolve(__dirname)}`];
      },
      tests() {
        it('reads migration from folder', async () => {
          const fn = require('./test_migration').up;
          fn.mockClear();
          expect(fn).not.toBeCalled();
          await subject();
          expect(fn).toBeCalled();
        });
      },
    });
  });

  describe('#create', () => {
    const subject = () => connect().create();
    const path = resolve(__dirname);
    const files = readdirSync(path);
    const name = 'test';

    context('when name argument is not present', {
      definitions() {
        process.argv = [];
      },
      tests() {
        it('throws error', async () => {
          try {
            await subject();
          } catch (error) {
            return expect(error).toBeDefined();
          }
          expect(false).toBeTruthy(); // not expected to reach
        });
      },
    });

    context('when arguments are present before name', {
      definitions() {
        process.argv = ['-f', resolve(__dirname), '-t', 'js', 'create', name];
      },
      tests() {
        it('creates new migration in test folder with js syntax', async () => {
          await subject();
          const newFiles = readdirSync(path).filter(file => !files.includes(file));
          expect(newFiles.length).toBe(1);
          expect(newFiles[0].endsWith(`_${name}.js`)).toBe(true);
          unlinkSync(resolve(__dirname, newFiles[0]));
        });
      },
    });

    context('when name arguments is present', {
      definitions() {
        process.argv = ['-f', resolve(__dirname), 'create', name];
      },
      tests() {
        it('creates new migration in test folder', async () => {
          await subject();
          const newFiles = readdirSync(path).filter(file => !files.includes(file));
          expect(newFiles.length).toBe(1);
          unlinkSync(resolve(__dirname, newFiles[0]));
        });

        context('when type arguments is js', {
          definitions() {
            process.argv.push('--type=js');
          },
          tests() {
            it('creates new migration in test folder with js syntax', async () => {
              await subject();
              const newFiles = readdirSync(path).filter(file => !files.includes(file));
              expect(newFiles.length).toBe(1);
              expect(newFiles[0].endsWith(`_${name}.js`)).toBe(true);
              unlinkSync(resolve(__dirname, newFiles[0]));
            });
          },
        });

        context('when type arguments is es2015', {
          definitions() {
            process.argv.push('--type=es2015');
          },
          tests() {
            it('creates new migration in test folder with es6 syntax', async () => {
              await subject();
              const newFiles = readdirSync(path).filter(file => !files.includes(file));
              expect(newFiles.length).toBe(1);
              expect(newFiles[0].endsWith(`_${name}.js`)).toBe(true);
              unlinkSync(resolve(__dirname, newFiles[0]));
            });
          },
        });

        context('when type arguments is es2017', {
          definitions() {
            process.argv.push('--type=es2017');
          },
          tests() {
            it('creates new migration in test folder with es7 syntax', async () => {
              await subject();
              const newFiles = readdirSync(path).filter(file => !files.includes(file));
              expect(newFiles.length).toBe(1);
              expect(newFiles[0].endsWith(`_${name}.js`)).toBe(true);
              unlinkSync(resolve(__dirname, newFiles[0]));
            });
          },
        });

        context('when type arguments is ts', {
          definitions() {
            process.argv.push('--type=ts');
          },
          tests() {
            it('creates new migration in test folder with ts syntax', async () => {
              await subject();
              const newFiles = readdirSync(path).filter(file => !files.includes(file));
              expect(newFiles.length).toBe(1);
              expect(newFiles[0].endsWith(`_${name}.ts`)).toBe(true);
              unlinkSync(resolve(__dirname, newFiles[0]));
            });
          },
        });

        context('when type arguments is invalid', {
          definitions() {
            process.argv.push('--type=fail');
          },
          tests() {
            it('throws error', async () => {
              try {
                await subject();
              } catch (error) {
                const newFiles = readdirSync(path).filter(file => !files.includes(file));
                expect(newFiles.length).toBe(0);
                return expect(error).toBeDefined();
              }
              expect(false).toBeTruthy(); // not expected to reach
            });
          },
        });
      },
    });
  });
});
