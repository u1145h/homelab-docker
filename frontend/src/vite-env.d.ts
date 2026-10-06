/// <reference types="vite/client" />

declare module '@mui/icons-material/*' {
  import { SvgIconComponent } from '@mui/material';
  const component: SvgIconComponent;
  export default component;
}

declare module '@capacitor/screen-orientation' {
  export const ScreenOrientation: {
    lock(options: { orientation: 'landscape' | 'portrait' | 'landscape-primary' | 'landscape-secondary' | 'portrait-primary' | 'portrait-secondary' | string }): Promise<void>;
    unlock(): Promise<void>;
    getCurrentOrientation(): Promise<{ type: string }>;
  };
}

