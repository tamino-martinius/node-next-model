import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Store } from './Store.js';

const StoreContext = createContext<Store | null>(null);

export function NextModelProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new Store());
  useEffect(() => () => store.dispose(), [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useModel/useInvalidateKeys must be used inside <NextModelProvider>');
  }
  return store;
}
