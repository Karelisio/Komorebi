import { create } from 'zustand';

export type Mode = 'garden' | 'contemplation' | 'photo' | 'breath' | 'meditation';
export type Sheet =
  | 'none'
  | 'shop'
  | 'koi'
  | 'decor'
  | 'journal'
  | 'settings'
  | 'update'
  | 'collection'
  | 'debug'
  | 'relax';

export type ShopTab = 'eggs' | 'decor' | 'upgrades';

export interface UiState {
  selectedKoi: string | null;
  /** Emplacement de berge sélectionné (pose ou détail d'un décor). */
  selectedSlot: number | null;
  /** Mode décoration : emplacements libres visibles et touchables. */
  decorMode: boolean;
  shopTab: ShopTab;
  /** Croisement en cours de choix : premier koï sélectionné. */
  breedWith: string | null;
  mode: Mode;
  sheet: Sheet;
  toast: { key: string; text: string } | null;
  hudVisible: boolean;
  meditationMinutes: number;
  sleepUntil: number | null;
}

export const useUi = create<UiState>(() => ({
  selectedKoi: null,
  selectedSlot: null,
  decorMode: false,
  shopTab: 'eggs',
  breedWith: null,
  mode: 'garden',
  sheet: 'none',
  toast: null,
  hudVisible: true,
  meditationMinutes: 10,
  sleepUntil: null,
}));

export function openShop(tab: ShopTab = useUi.getState().shopTab): void {
  useUi.setState({ sheet: 'shop', shopTab: tab });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, ms = 2600): void {
  if (toastTimer) clearTimeout(toastTimer);
  useUi.setState({ toast: { key: String(Date.now()), text } });
  toastTimer = setTimeout(() => useUi.setState({ toast: null }), ms);
}
