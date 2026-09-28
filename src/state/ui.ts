import { create } from 'zustand';
import type { CatalogId } from '@/garden/catalog';

export type Tool = 'none' | 'water' | 'prune' | 'rake' | 'place';
export type Mode = 'garden' | 'contemplation' | 'photo' | 'breath' | 'meditation';
export type Sheet =
  | 'none'
  | 'inventory'
  | 'koi'
  | 'object'
  | 'journal'
  | 'settings'
  | 'update'
  | 'collection'
  | 'debug'
  | 'relax';

export interface UiState {
  tool: Tool;
  placing: CatalogId | null;
  /** Position monde de l'aperçu de placement. */
  ghost: { x: number; y: number; valid: boolean } | null;
  selectedObject: string | null;
  selectedKoi: string | null;
  movingObject: string | null;
  mode: Mode;
  sheet: Sheet;
  toast: { key: string; text: string } | null;
  hudVisible: boolean;
}

export const useUi = create<UiState>(() => ({
  tool: 'none',
  placing: null,
  ghost: null,
  selectedObject: null,
  selectedKoi: null,
  movingObject: null,
  mode: 'garden',
  sheet: 'none',
  toast: null,
  hudVisible: true,
}));

export function setTool(tool: Tool): void {
  useUi.setState({
    tool,
    placing: tool === 'place' ? useUi.getState().placing : null,
    ghost: tool === 'place' ? useUi.getState().ghost : null,
  });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, ms = 2600): void {
  if (toastTimer) clearTimeout(toastTimer);
  useUi.setState({ toast: { key: String(Date.now()), text } });
  toastTimer = setTimeout(() => useUi.setState({ toast: null }), ms);
}
