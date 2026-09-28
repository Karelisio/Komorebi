import { t } from '@/i18n';

export function App() {
  return (
    <main className="app">
      <h1 className="title">{t('app.name')}</h1>
      <p className="subtitle">{t('app.tagline')}</p>
    </main>
  );
}
