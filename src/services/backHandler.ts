import { useEffect, useRef } from 'react';

type BackHandler = () => boolean | void;

interface StackItem {
  id: string;
  handler: BackHandler;
}

const handlerStack: StackItem[] = [];
let pushedStatesCount = 0;
let isExitingApp = false;

export function incrementPushedStates(): void {
  pushedStatesCount++;
}

export function getPushedStatesCount(): number {
  return pushedStatesCount;
}

export function resetPushedStates(): void {
  pushedStatesCount = 0;
}

export function setIsExitingApp(val: boolean): void {
  isExitingApp = val;
}

export function getIsExitingApp(): boolean {
  return isExitingApp;
}

/** How many history entries above the app's first entry we are (stored in every state we push). */
export function getCurrentHistoryDepth(): number {
  if (typeof window === 'undefined') return 0;
  const d = (window.history.state as any)?.depth;
  return typeof d === 'number' && d > 0 ? d : 0;
}

/**
 * Pushes a new browser history state. The real depth is stored in the state itself, so we always
 * know how far we are from the first entry (a plain counter never goes down when the user presses Back).
 */
export function pushAppHistoryState(stateObj: any = {}): void {
  if (typeof window !== 'undefined') {
    window.history.pushState(
      { app: 'sanad-almoallem', ...stateObj, depth: getCurrentHistoryDepth() + 1 },
      '',
      window.location.pathname
    );
    incrementPushedStates();
  }
}

/**
 * Registers a modal or drawer close handler on the LIFO stack.
 * Optionally pushes a history state when the modal opens.
 */
export function registerBackHandler(
  id: string,
  handler: BackHandler,
  pushState = true
): () => void {
  // Remove any existing handler with the same ID first
  const existingIdx = handlerStack.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    handlerStack.splice(existingIdx, 1);
  }

  handlerStack.push({ id, handler });

  if (pushState) {
    pushAppHistoryState({ modal: id });
  }

  return () => {
    const idx = handlerStack.findIndex((item) => item.id === id);
    if (idx !== -1) {
      handlerStack.splice(idx, 1);
    }
  };
}

/**
 * Hook to automatically register and deregister a back handler
 * when a modal or panel is open.
 */
export function useBackHandler(
  isOpen: boolean,
  onClose: () => void,
  id: string,
  pushState = true
): void {
  // Keep the latest onClose in a ref. Callers usually pass an inline arrow function, which has a new
  // identity on every render: depending on it would re-register the handler (and push a new history
  // entry) on every re-render while the modal is open, so Back would need many presses to leave.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    return registerBackHandler(id, () => onCloseRef.current(), pushState);
  }, [isOpen, id, pushState]);
}

/**
 * Checks if there is any active modal or panel registered in the stack.
 */
export function hasActiveModals(): boolean {
  return handlerStack.length > 0;
}

/**
 * Handles the topmost modal or panel on back press.
 * Returns true if a modal was handled and popped, false if stack was empty.
 */
export function handleTopmostBack(): boolean {
  if (handlerStack.length === 0) return false;
  const item = handlerStack.pop();
  if (item) {
    try {
      item.handler();
    } catch (err) {
      console.warn('Error in back handler for', item.id, err);
    }
    return true;
  }
  return false;
}

/**
 * Leaves the app. A web page cannot close itself, so we rewind the history entries we pushed
 * (back to the first one) and then go back once more, which is exactly what the system Back
 * button does at the root of an installed app (it closes the PWA on Android).
 */
export function exitApplication(): void {
  if (typeof window === 'undefined') return;
  setIsExitingApp(true);
  const depth = getCurrentHistoryDepth();

  if (depth > 0) {
    const leave = () => {
      window.history.back();
    };
    window.addEventListener('popstate', leave, { once: true });
    window.history.go(-depth);
  } else {
    window.history.back();
  }

  // If we are still here a moment later (e.g. a normal browser tab with nothing behind it),
  // make the app react to Back normally again instead of staying "exiting" forever.
  setTimeout(() => {
    try {
      window.close();
    } catch {
      /* ignored: only works for windows opened by script */
    }
    setIsExitingApp(false);
    resetPushedStates();
  }, 1500);
}
