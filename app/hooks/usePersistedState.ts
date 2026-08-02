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
  const [state, setState] = useState<T>(() => {
    const stored = readStorage<T>(key);
    if (stored !== null) return stored;
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

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
