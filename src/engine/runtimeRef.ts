import type { Runtime } from './runtime';

/** Référence au runtime courant, pour l'UI (vignettes, photo, caméra). */
export const runtimeRef: { current: Runtime | null } = { current: null };
