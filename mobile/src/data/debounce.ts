import { useEffect, useState } from 'react';

/**
 * A value that only changes once it has stopped changing for `ms`.
 *
 * For search boxes. Each letter typed is a new value, and without this each
 * one is a request: "courage" costs seven, six of them for answers nobody
 * reads. React's `useDeferredValue` looks like the tool for this and is not;
 * it puts off rendering, not the value, so every keystroke still gets through.
 */
export function useDebounced<T>(value: T, ms = 350): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}
