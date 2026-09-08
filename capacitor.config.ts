import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.twelve.customer',
  appName: 'Twelve',
  webDir: 'dist',
  server: {
    url: 'https://food-delivery-arabic.web.app',
    cleartext: true,
    allowNavigation: [
      'food-delivery-arabic.web.app',
      '*.web.app',
      'wa.me',
      'api.whatsapp.com',
      'whatsapp://*',
      'tel:*'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000
    }
  }
};

export default config;
