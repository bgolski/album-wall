import { useRef, useState, useCallback } from "react";

/**
 * Hook for managing a simple undo history stack.
 *
 * @template T The type of the snapshot values stored.
 * @param {number} limit The maximum number of snapshots to keep. Defaults to 20.
 * @returns {
 *   record: (snapshot: T) => void,
 *   undo: () => T | undefined,
 *   clear: () => void,
 *   canUndo: boolean
 * }
 *
 * The stack is maintained in a ref so mutation does not trigger re-renders.
 * A stateful counter is used solely to force re-render when `canUndo` changes.
 */
export function useUndoHistory<T>(limit = 20) {
  const snapshotsRef = useRef<T[]>([]);
  const [count, setCount] = useState(0);

  const record = useCallback(
    (snapshot: T) => {
      const arr = snapshotsRef.current;
      arr.push(snapshot);
      if (arr.length > limit) {
        arr.shift();
      }
      setCount(arr.length);
    },
    [limit]
  );

  const undo = useCallback(() => {
    const arr = snapshotsRef.current;
    if (arr.length === 0) {
      return undefined;
    }
    const last = arr.pop();
    setCount(arr.length);
    return last;
  }, []);

  const clear = useCallback(() => {
    snapshotsRef.current = [];
    setCount(0);
  }, []);

  const canUndo = count > 0;

  return { record, undo, clear, canUndo };
}
