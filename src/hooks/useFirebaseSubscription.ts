import useSWRSubscription from 'swr/subscription';

/**
 * Custom hook to bridge Firebase onSnapshot with SWR.
 * @param key Unique key for SWR cache
 * @param subscribe Function that takes a callback and returns an unsubscribe function
 */
export function useFirebaseSubscription<T>(
  key: string | null,
  subscribe: (callback: (data: T | null) => void) => () => void
) {
  return useSWRSubscription(key, (key, { next }) => {
    if (!key) {
      next(null, null);
      return;
    }
    
    const unsubscribe = subscribe((data) => {
      next(null, data);
    });

    return () => unsubscribe();
  });
}
