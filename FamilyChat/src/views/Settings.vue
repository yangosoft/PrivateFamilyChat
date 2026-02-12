<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Settings</ion-title>
        </ion-toolbar>
      </ion-header>



      <ion-card v-if="!isLoggedIn">
        <ion-card-header>
          <ion-card-title>Login</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Username</ion-label>
            <ion-input v-model="username" type="text" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Password</ion-label>
            <ion-input v-model="password" type="password" />
          </ion-item>
          <ion-button expand="block" @click="login">Login</ion-button>
          <ion-text color="primary" v-if="loginMessage" style="margin-top:8px;display:block">{{ loginMessage
            }}</ion-text>
        </ion-card-content>
      </ion-card>
      <ion-card v-else>
        <ion-card-header>
          <ion-card-title>Account</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-button expand="block" color="danger" @click="logout">Logout</ion-button>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Settings</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label>Enable Notifications</ion-label>
            <ion-toggle v-model="notificationsEnabled" />
          </ion-item>
          <ion-item>
            <ion-label>Change Picture</ion-label>
            <input type="file" accept="image/*" @change="onPictureChange" />
            <img v-if="pictureUrl" :src="pictureUrl" alt="Profile"
              style="max-width: 80px; border-radius: 50%; margin-left: 16px;" />
          </ion-item>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Server Settings</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Server URL</ion-label>
            <ion-input v-model="serverUrl" placeholder="http://127.0.0.1:3000" />
          </ion-item>
          <ion-button expand="block" @click="saveServerUrl" style="margin-top: 8px;">Save Server URL</ion-button>
          <ion-text color="medium" style="font-size: 0.9em;">WebSocket will use ws(s):// based on this
            address.</ion-text>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>Version</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label>Version: 1.0.1</ion-label>
          </ion-item>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonToggle, IonText } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { Preferences } from '@capacitor/preferences';


import { computed, watch } from 'vue';
const username = ref('');
const password = ref('');
const loginMessage = ref('');
const notificationsEnabled = ref(false);
const pictureUrl = ref<string | null>(null);
const serverUrl = ref(localStorage.getItem('chat_server_url') || 'http://localhost:3000');

const token = ref(localStorage.getItem('chat_token'));
const isLoggedIn = computed(() => !!token.value);

// Load from Preferences on mount
import { onMounted } from 'vue';
onMounted(async () => {
  const [tokenPref, userIdPref, usernamePref, userPicPref, serverUrlPref] = await Promise.all([
    Preferences.get({ key: 'chat_token' }),
    Preferences.get({ key: 'chat_user_id' }),
    Preferences.get({ key: 'chat_username' }),
    Preferences.get({ key: 'chat_user_picture' }),
    Preferences.get({ key: 'chat_server_url' })
  ]);
  if (tokenPref.value) token.value = tokenPref.value;
  if (userIdPref.value) localStorage.setItem('chat_user_id', userIdPref.value);
  if (usernamePref.value) username.value = usernamePref.value;
  if (userPicPref.value) pictureUrl.value = userPicPref.value;
  if (serverUrlPref.value) serverUrl.value = serverUrlPref.value;
});

watch(token, async (val) => {
  if (val) {
    username.value = '';
    password.value = '';
    await Preferences.set({ key: 'chat_token', value: val });
  } else {
    await Preferences.remove({ key: 'chat_token' });
  }
});
const router = useRouter();
async function login() {
  try {
    const response = await fetch(serverUrl.value + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    const result = await response.json();
    if (result.success && result.token && result.id) {
      localStorage.setItem('chat_token', result.token);
      localStorage.setItem('chat_user_id', result.id);
      localStorage.setItem('chat_username', result.username);
      token.value = result.token;
      loginMessage.value = 'Login successful! User id: ' + result.id;
      // Store in Preferences as well
      await Preferences.set({ key: 'chat_token', value: result.token });
      await Preferences.set({ key: 'chat_user_id', value: String(result.id) });
      await Preferences.set({ key: 'chat_username', value: result.username });
      // Force storage event for other tabs/components
      window.dispatchEvent(new StorageEvent('storage', { key: 'chat_token', newValue: result.token }));
      // Redirect to contact list
      router.replace('/tabs/tab1');
    } else {
      loginMessage.value = result.message || 'Login failed.';
    }
  } catch (e) {
    loginMessage.value = 'Network or server error.';
  }
}

async function logout() {
  localStorage.removeItem('chat_token');
  localStorage.removeItem('chat_user_id');
  token.value = null;
  await Preferences.remove({ key: 'chat_token' });
  await Preferences.remove({ key: 'chat_user_id' });
  await Preferences.remove({ key: 'chat_username' });
  await Preferences.remove({ key: 'chat_user_picture' });
}

async function onPictureChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !token.value) return;
  const formData = new FormData();
  formData.append('picture', file);
  try {
    const resp = await fetch(serverUrl.value + '/contacts/picture', {
      method: 'POST',
      headers: { authorization: token.value },
      body: formData
    });
    const result = await resp.json();
    if (result.success && result.picture) {
      pictureUrl.value = serverUrl.value + result.picture;
      // Optionally update localStorage for other pages
      localStorage.setItem('chat_user_picture', pictureUrl.value);
      await Preferences.set({ key: 'chat_user_picture', value: pictureUrl.value });
    }
  } catch (e) {
    // Optionally show error
  }
}



async function saveServerUrl() {
  localStorage.setItem('chat_server_url', serverUrl.value);
  await Preferences.set({ key: 'chat_server_url', value: serverUrl.value });
  // Notify other tabs/pages
  window.dispatchEvent(new StorageEvent('storage', { key: 'chat_server_url', newValue: serverUrl.value }));
}
</script>
