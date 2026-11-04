/**
 * MathBoard AI - Global History Hook (Undo / Redo System)
 * Tracks user actions: Cards (Add/Delete/Move), JSXGraph Boards, Strokes (Draw/Erase).
 */

import { useState, useCallback, useRef } from 'react';

export interface HistoryAction {
  type: string;
  label?: string;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 100;

export function useGlobalHistory() {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const undoStackRef = useRef<HistoryAction[]>([]);
  const redoStackRef = useRef<HistoryAction[]>([]);

  const updateState = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const pushAction = useCallback((action: HistoryAction) => {
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    // Clear redo stack on new action
    redoStackRef.current = [];
    updateState();
  }, [updateState]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return null;
    const action = undoStackRef.current.pop()!;
    redoStackRef.current.push(action);
    try {
      action.undo();
    } catch (e) {
      console.warn('[History] Undo error:', e);
    }
    updateState();
    return action;
  }, [updateState]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return null;
    const action = redoStackRef.current.pop()!;
    undoStackRef.current.push(action);
    try {
      action.redo();
    } catch (e) {
      console.warn('[History] Redo error:', e);
    }
    updateState();
    return action;
  }, [updateState]);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateState();
  }, [updateState]);

  return {
    pushAction,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory
  };
}
