/// <reference types="jest" />
import { Context } from './types';
export declare const it: jest.It;
export declare const context: (description: string, { definitions, tests, reset }: Context) => void;
export declare function randomInteger(min: number, max: number): number;
