import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.u1145h.homelab',
  appName: 'HomeLab',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#111314'
    },
    NavigationBar: {
      color: 'transparent',
      dividerColor: 'transparent',
      style: 'DARK'
    }
  }
};

export default config;
