<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { LocalNotifications } from '@capacitor/local-notifications';

LocalNotifications.checkPermissions().then((result) => {
  console.log('Notification permission status:', result.display);
  if (result.display !== 'granted') {
    LocalNotifications.requestPermissions().then((result) => {
      if (result.display === 'granted') {
        console.log('Notification permission granted');
      }
    });
  }
});
</script>
