import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.example.familychat',
  appName: 'FamilyChat',
  webDir: 'dist',
  plugins: {
    BackgroundRunner: {
      label: "org.example.familychat.task",
      src: "background.js",
      event: "myCustomEvent",
      repeat: true,
      interval: 15,
      autoStart: true
    },
    LocalNotifications: {
      smallIcon: "ic_stat_message.png",
      iconColor: "#488AFF",
      sound: "beep.wav"
    }
  }
};

export default config;
