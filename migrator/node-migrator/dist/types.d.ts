export interface Dict<T> {
    [key: string]: T;
}
export interface Migration {
    key: string;
    up(): Promise<any>;
    down(): Promise<any>;
    parent?: string[];
}
