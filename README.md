# Komorebi

Komorebi (木漏れ日, « la lumière qui filtre à travers les feuilles ») est un
jardin zen avec bassin à koïs qui vit en temps réel : l'heure, la saison et la
météo de votre lieu (ou d'un lieu de repli) influencent la lumière, le ciel et
le comportement du jardin, même lorsque l'application est fermée.

Le jeu est écrit en TypeScript avec [PixiJS](https://pixijs.com/) v8 pour le
rendu et [React](https://react.dev/) pour l'interface, empaqueté en
application Android via [Capacitor](https://capacitorjs.com/) 8.

## Fonctionnalités

- **Bassin à koïs vivant** : génétique héritable (allèles, motifs, variétés
  rares), banc animé (boids), nourrissage, nénuphars.
- **Jardin évolutif** : croissance des plantations, placement, sable ratissé,
  décor japonais (haie taillée, allée de gravier, arbres en amas de feuilles).
- **Cycle jour/nuit et saisons réels** : soleil, lune, phases lunaires,
  saisons et rayons de komorebi calculés depuis votre position (ou une
  position de repli).
- **Météo réelle et simulée**, avec cache local et dégradation gracieuse hors
  connexion.
- **Sauvegarde versionnée** avec migrations et simulation de la progression
  pendant les absences (hors ligne).
- **Thème Material You** : couleurs dynamiques du système sur Android 12+, en
  plus des thèmes clair / sombre / naturel.
- **Mises à jour in-app** : vérifie, télécharge (avec reprise) et installe les
  nouvelles versions directement depuis les GitHub Releases du dépôt.
- **Interface entièrement en français**, i18n typée (`src/i18n`).

## Prérequis

- [Node.js](https://nodejs.org/) 22 ou supérieur
- Pour le build Android local : un JDK 21 (Temurin recommandé) et
  l'[Android SDK](https://developer.android.com/studio) (avec
  `ANDROID_HOME`/`ANDROID_SDK_ROOT` configuré, ou Android Studio)

## Démarrage (développement web)

```bash
npm install
npm run dev
```

Le serveur de développement Vite démarre avec rechargement à chaud. L'URL
accepte des **paramètres de debug** utiles en développement et pour les
captures d'écran :

| Paramètre       | Effet                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `t`               | Force la date/heure simulée (ISO 8601, ex. `2026-06-21T19:00:00Z`) |
| `speed`           | Multiplicateur de vitesse de l'horloge (ex. `speed=60`)            |
| `season`          | Force la saison (`spring`, `summer`, `autumn`, `winter`)            |
| `weather`         | Force la météo (voir `src/world/weatherTypes.ts`)                   |
| `zoom`, `cx`, `cy`| Caméra fixe (zoom et centre, utile pour les captures)                |
| `debug=1`         | Active le panneau/mode debug                                        |
| `fps=1`           | Affiche le compteur d'images par seconde                            |
| `koitex=1`        | Affiche la planche de debug des textures de koïs                    |
| `decor=1`         | Affiche la planche de debug de tous les objets de décor              |

Exemple :
`http://localhost:5173/?t=2026-06-21T19:00:00Z&speed=60&season=autumn&weather=rain&debug=1`

## Tests et qualité

```bash
npm test          # Vitest (tests unitaires)
npm run test:watch
npm run lint       # ESLint, zéro avertissement toléré
npm run typecheck  # TypeScript strict, sans émission
npm run format     # Prettier (écrit les corrections)
npm run format:check
```

## Build Android (local)

1. Construire le web et synchroniser le projet natif :

   ```bash
   npm run build
   npx cap sync android
   ```

2. Compiler un APK de debug :

   ```bash
   cd android
   ./gradlew assembleDebug
   ```

   L'APK se trouve dans `android/app/build/outputs/apk/debug/`.

Le projet natif Android (`android/`) est versionné dans le dépôt (à
l'exception des répertoires de build, du cache Gradle et des clés de
signature, voir `.gitignore`) : inutile de relancer `npx cap add android`,
`npx cap sync android` suffit après chaque changement du code web ou de
`capacitor.config.ts`.

### Génération des icônes

```bash
npm run assets
```

Cette commande (`capacitor-assets generate --android`) régénère les icônes et
l'écran de démarrage Android à partir des sources dans `assets/` (elles-mêmes
produites par `node scripts/icons.mjs`).

## Publier une release (CI)

Le workflow `.github/workflows/release.yml` se déclenche sur un tag
`vX.Y.Z` (ou `vX.Y.Z-pre`) et publie automatiquement une GitHub Release avec
l'APK, le bundle AAB et la somme SHA-256 correspondante, signés avec votre
clé de release.

### 1. Créer un keystore de release (une seule fois)

```bash
keytool -genkeypair -v -keystore komorebi-release.keystore -alias komorebi \
  -keyalg RSA -keysize 4096 -validity 36500
```

> **Conservez précieusement ce fichier et son mot de passe.** Toute mise à
> jour future de l'application doit être signée avec **exactement la même
> clé** : Android refuse d'installer une mise à jour signée différemment, et
> le système de mise à jour in-app de Komorebi ne pourra pas installer
> l'APK par-dessus l'existant si la clé change.

### 2. Encoder le keystore en base64

- **Linux** :

  ```bash
  base64 -w0 komorebi-release.keystore > keystore.b64
  ```

- **macOS** :

  ```bash
  base64 -i komorebi-release.keystore | tr -d '\n' > keystore.b64
  ```

- **PowerShell (Windows)** :

  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("komorebi-release.keystore")) | Set-Content -NoNewline keystore.b64
  ```

### 3. Configurer les secrets GitHub

Dans les paramètres du dépôt (*Settings → Secrets and variables → Actions*),
créez ces quatre secrets :

| Secret                        | Valeur                                   |
| ------------------------------ | ------------------------------------------ |
| `ANDROID_KEYSTORE_BASE64`      | Contenu de `keystore.b64`                  |
| `ANDROID_KEYSTORE_PASSWORD`    | Mot de passe du keystore                   |
| `ANDROID_KEY_ALIAS`            | Alias de la clé (`komorebi` ci-dessus)     |
| `ANDROID_KEY_PASSWORD`         | Mot de passe de la clé                     |

Pour signer localement (sans CI), vous pouvez à la place créer un fichier
`android/keystore.properties` (ignoré par git) :

```properties
storeFile=../komorebi-release.keystore
storePassword=...
keyAlias=komorebi
keyPassword=...
```

(`storeFile` est résolu depuis `android/`, où vit `keystore.properties` ; ici
le keystore est supposé placé à la racine du dépôt.)

### 4. Publier

```bash
git tag v1.0.0
git push --tags
```

Le workflow calcule `versionName`/`versionCode` depuis le tag
(`scripts/version-from-tag.mjs`), construit l'APK et l'AAB signés, génère un
changelog depuis les commits (`scripts/changelog.mjs`) et crée la Release
GitHub avec les fichiers `komorebi-vX.Y.Z.apk`, `komorebi-vX.Y.Z.apk.sha256`
et `komorebi-vX.Y.Z.aab`.

## Mises à jour in-app

L'application vérifie périodiquement les GitHub Releases du dépôt configuré
dans `src/config/app.ts` (`APP_CONFIG.github.owner` / `APP_CONFIG.github.repo`),
recherche un asset dont le nom correspond à `komorebi-vX.Y.Z.apk`, télécharge
l'APK (avec reprise, via le plugin natif `KomorebiNative`), vérifie sa somme
SHA-256 par rapport au fichier `.sha256` publié à côté, puis propose son
installation. Voir `src/update/` (logique) et
`android/app/src/main/java/com/karelisio/komorebi/KomorebiNativePlugin.kt`
(téléchargement, vérification, installation côté natif).

## Architecture (`src/`)

| Dossier      | Contenu                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `config/`     | Configuration statique de l'application (`APP_CONFIG`).                    |
| `engine/`     | Boucle de jeu, horloge, caméra, gestes, haptique, démarrage, notifications. |
| `garden/`     | Catalogue, croissance et placement des plantations, progression.           |
| `i18n/`       | Internationalisation typée (français par défaut, anglais).                 |
| `pond/`       | Koïs : génétique, comportement de banc (boids), ondes.                     |
| `render/`     | Scène PixiJS (ciel, eau, décor, koïs, météo, qualité graphique).           |
| `save/`       | Sauvegarde locale versionnée, migrations, simulation hors-ligne.           |
| `state/`      | Stores applicatifs (zustand) : partie, réglages, UI, monde.               |
| `theme/`      | Thèmes d'interface, palette Material You dynamique.                       |
| `ui/`         | Composants React (HUD, feuilles de réglages, tutoriel, icônes).           |
| `update/`     | Vérification/téléchargement des mises à jour depuis GitHub Releases.      |
| `world/`      | Simulation du monde : ciel, saisons, météo, localisation, événements.     |
| `audio/`      | Moteur audio (synthèse, musique générative, DSP).                         |

Le projet natif Android généré par Capacitor vit dans `android/` (versionné,
voir plus haut) ; le plugin natif maison est dans
`android/app/src/main/java/com/karelisio/komorebi/`.

## Licence

[MIT](./LICENSE) — © 2026 Karelisio
