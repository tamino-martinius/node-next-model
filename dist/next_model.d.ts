import { ModelStatic, Identifiable } from './types';
export declare class PropertyNotDefinedError implements Error {
    name: string;
    message: string;
    constructor(name: string, isStatic?: boolean, isReadonly?: boolean);
}
export declare class LowerBoundsError implements Error {
    name: string;
    message: string;
    constructor(name: string, lowerBound: number);
}
export declare class MinLengthError implements Error {
    name: string;
    message: string;
    constructor(name: string, minLength: number);
}
export declare class TypeError implements Error {
    name: string;
    message: string;
    constructor(name: string, type: string);
}
export declare function NextModel<S extends Identifiable>(): ModelStatic<S>;
export default NextModel;
