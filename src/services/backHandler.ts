import { useEffect } from 'react';

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

/**
 * Pushes a new browser history state and tracks the count.
 */
export function pushAppHistoryState(stateObj: any = {}): void {
  if (typeof window !== 'undefined') {
    window.history.pushState(
      { app: 'sanad-almoallem', ...stateObj, depth: pushedStatesCount + 1 },
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
  useEffect(() => {
    if (!isOpen) return;
    return registerBackHandler(id, onClose, pushState);
  }, [isOpen, onClose, id, pushState]);
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
 * Exits the application cleanly by rewinding history by exactly the number
 * of states pushed by our app, or closes the window if possible.
 */
export function exitApplication(): void {
  setIsExitingApp(true);
  const statesToGo = Math.max(1, pushedStatesCount);
  try {
    window.history.go(-(statesToGo + 1));
  } catch {
    try {
      window.close();
    } catch {}
  }

  // Fallback close after a short delay if window is still open (e.g. standalone PWA)
  setTimeout(() => {
    try {
      window.close();
    } catch {}
  }, 120);
}
