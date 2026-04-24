export interface Dict<T> {
    [key: string]: T;
}
export interface Migration {
    name?: string;
    version: string;
    up(sql: any): Promise<any>;
    down(sql: any): Promise<any>;
    parent?: string[];
}
