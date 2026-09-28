/**
 * Horloge du jeu. Par défaut elle suit l'heure réelle ; le menu debug peut
 * la décaler, la figer ou l'accélérer. Tout le jeu lit l'heure ici.
 */
export class GameClock {
  private anchorReal: number;
  private anchorGame: number;
  private speedFactor = 1;

  constructor(private readonly realNow: () => number = () => Date.now()) {
    this.anchorReal = realNow();
    this.anchorGame = this.anchorReal;
  }

  now(): number {
    return this.anchorGame + (this.realNow() - this.anchorReal) * this.speedFactor;
  }

  date(): Date {
    return new Date(this.now());
  }

  get speed(): number {
    return this.speedFactor;
  }

  get isReal(): boolean {
    return this.speedFactor === 1 && Math.abs(this.now() - this.realNow()) < 1000;
  }

  /** Change la vitesse sans saut temporel. */
  setSpeed(speed: number): void {
    this.rebase();
    this.speedFactor = Math.max(0, speed);
  }

  /** Place l'horloge sur un instant précis. */
  setTime(ms: number): void {
    this.anchorReal = this.realNow();
    this.anchorGame = ms;
  }

  /** Force l'heure locale (0-24) en gardant la date courante. */
  setLocalHour(hour: number): void {
    const d = this.date();
    d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
    this.setTime(d.getTime());
  }

  /** Revient à l'heure réelle. */
  reset(): void {
    this.anchorReal = this.realNow();
    this.anchorGame = this.anchorReal;
    this.speedFactor = 1;
  }

  private rebase(): void {
    const now = this.now();
    this.anchorReal = this.realNow();
    this.anchorGame = now;
  }
}

export const clock = new GameClock();
