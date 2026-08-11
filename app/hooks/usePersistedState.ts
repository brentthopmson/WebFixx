import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';

type Setter<T> = Dispatch<SetStateAction<T>>;

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

export function usePersistedState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Setter<T>] {
  // Never read localStorage during render: doing so makes the server-rendered
  // HTML differ from the client's first render (hydration mismatch, React
  // errors #418/#423). Always start from the default, then hydrate from
  // storage in an effect after mount.
  const [state, setState] = useState<T>(() =>
    typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue,
  );

  useEffect(() => {
    const stored = readStorage<T>(key);
    if (stored !== null) setState(stored);
  }, [key]);

  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  const setStateAndPersist = useCallback<Setter<T>>((value) => {
    setState(value);
  }, []);

  return [state, setStateAndPersist];
}

export function clearStoredState(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
