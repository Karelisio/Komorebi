import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karelisio.komorebi',
  appName: 'Komorebi',
  webDir: 'dist',
  android: {
    backgroundColor: '#1d2a44',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#1d2a44',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_komorebi',
      iconColor: '#E9B872',
    },
  },
};

export default config;
