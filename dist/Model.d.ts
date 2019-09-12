import { Connector, Dict, Filter, KeyType, ModelStatic, Order, Schema } from './types';
export declare function Model<CreateProps = {}, PersistentProps extends Schema = {}, Keys extends Dict<KeyType> = {
    id: KeyType.number;
}>({ tableName, init, filter, limit, skip, order, connector, keys, }: {
    tableName: string;
    init: (props: CreateProps) => PersistentProps;
    filter?: Filter<PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
    }>;
    limit?: number;
    skip?: number;
    order?: Order<PersistentProps>;
    connector?: Connector;
    keys?: Keys;
}): ModelStatic<CreateProps, PersistentProps, Keys>;
