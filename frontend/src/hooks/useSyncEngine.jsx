import { useState, useEffect } from 'react';
import { syncEngine } from '../shared/syncEngine';

export function useSyncEngine() {
  const [state, setState] = useState(syncEngine.getState());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  return state;
}
