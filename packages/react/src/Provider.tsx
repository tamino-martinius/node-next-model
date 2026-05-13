import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Store } from './Store.js';

const StoreContext = createContext<Store | null>(null);

export function NextModelProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new Store());
  useEffect(() => {
    // revive() recovers from React StrictMode's intermediate cleanup, which
    // would otherwise leave the Store permanently disposed before mount-2
    // commits.
    store.revive();
    return () => store.dispose();
  }, [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useModel/useInvalidateKeys must be used inside <NextModelProvider>');
  }
  return store;
}
