import { useMemo, useRef, useSyncExternalStore } from 'react';
import { useStore } from './Provider.js';
import { ReactiveQuery } from './ReactiveQuery.js';
import { wrapInstance } from './ReactiveInstance.js';
import { emitterFor, tagStore } from './instanceState.js';

type ModelStatic<P> = {
  tableName: string;
  build(props?: Partial<P>): object;
};

class HookQuery<M extends { tableName: string }> extends ReactiveQuery<M> {
  constructor(plan: ConstructorParameters<typeof ReactiveQuery>[0]) { super(plan); }
}

export function useModel<P, M extends ModelStatic<P>>(ModelClass: M) {
  const store = useStore();
  const query = useMemo(() => new HookQuery<M>({ ModelClass, steps: [] }), [ModelClass]);
  const buildShellRef = useRef<{ instance: object; shell: object } | null>(null);

  Object.defineProperty(query, 'build', {
    configurable: true,
    value: (props?: Partial<P>) => {
      if (!buildShellRef.current) {
        const instance = (ModelClass as ModelStatic<P>).build(props);
        tagStore(instance, store);
        const shell = wrapInstance(instance, { resettable: true });
        buildShellRef.current = { instance, shell };
      }
      const { instance, shell } = buildShellRef.current;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useSyncExternalStore(
        (cb) => emitterFor(instance).subscribe(cb),
        () => emitterFor(instance),
        () => emitterFor(instance),
      );
      return shell;
    },
  });

  return query as HookQuery<M> & { build(props?: Partial<P>): unknown };
}
