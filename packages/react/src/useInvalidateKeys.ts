import { useCallback } from 'react';
import { useStore } from './Provider.js';

export function useInvalidateKeys(): (keys: (string | symbol)[]) => void {
  const store = useStore();
  return useCallback((keys) => store.publishKeys(keys), [store]);
}
