/** Vérification des mises à jour (implémentation complète : étape 13). */
export interface CheckOptions {
  /** Déclenché par l'utilisateur : ignore le délai de 24 h et la version ignorée. */
  manual?: boolean;
}

export type CheckResult = { status: 'up-to-date' } | { status: 'available'; version: string } | { status: 'error'; message: string };

export async function checkForUpdates(_opts: CheckOptions = {}): Promise<CheckResult> {
  return { status: 'up-to-date' };
}
