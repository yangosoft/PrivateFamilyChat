<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="wa-header" style="display: flex; align-items: center; background: #fff;">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/tab1" />
        </ion-buttons>
        <ion-avatar slot="start" style="margin-right: 12px;">
          <img :src="contactPicture || 'img/avatar.svg'" alt="Contact picture" />
        </ion-avatar>
        <ion-title style="font-weight: 500; color: #222; font-family: inherit; display: flex; align-items: center;">
          <span>{{ contactName }}</span>
          <ion-badge v-if="contactOnline !== null" :color="contactOnline ? 'success' : 'medium'"
            style="margin-left: 10px; min-width: 60px;">
            {{ contactOnline ? 'Online' : 'Offline' }}
          </ion-badge>
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content ref="contentRef" class="wa-content">
      <div class="wa-messages" ref="messagesRef">
        <template v-for="(msg, idx) in messages" :key="msg.id || idx">
          <div v-if="showDateDivider(idx)" class="wa-date-divider">
            {{ formatDate(msg.timestamp) }}
          </div>
          <div :class="msg.from === myId ? 'wa-msg wa-msg-me' : 'wa-msg wa-msg-contact'"
            v-if="idx === messages.length - 1" ref="lastMessageRef">
            <div class="wa-bubble">
              <span class="wa-text" v-html="linkify(msg.text)"></span>
              <span v-if="msg.timestamp" class="wa-time">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
            </div>
          </div>
          <div :class="msg.from === myId ? 'wa-msg wa-msg-me' : 'wa-msg wa-msg-contact'" v-else>
            <div class="wa-bubble">
              <span class="wa-text" v-html="linkify(msg.text)"></span>
              <span v-if="msg.timestamp" class="wa-time">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
            </div>
          </div>
        </template>
      </div>
      <div class="wa-footer">
        <input v-model="input" placeholder="Type a message..." @keyup.enter="sendMessage" class="wa-input" />
        <button class="wa-gps" @click="openGpsMenu" title="Send location">
          <img src="/img/gps.svg" alt="Send location" style="width: 24px; height: 24px;" />
        </button>
        <button @click="sendMessage" class="wa-send">Send</button>
      </div>
      <ion-modal :is-open="gpsMenuOpen" @didDismiss="gpsMenuOpen = false">
        <div class="wa-gps-menu">
          <h3>Enviar posición GPS</h3>
          <div v-if="gpsError" class="wa-gps-error">{{ gpsError }}</div>
          <div v-if="gpsLoading" class="wa-gps-loading">Obteniendo ubicación...</div>
          <div v-if="gpsCoords">
            <div class="wa-gps-coords">
              <strong>Latitude:</strong> {{ gpsCoords.latitude }}<br />
              <strong>Longitude:</strong> {{ gpsCoords.longitude }}
            </div>
            <button class="wa-gps-modal-btn wa-gps-send-btn" @click="confirmSendLocation">
              <ion-icon name="send-outline" style="margin-right: 8px;"></ion-icon>Enviar esta ubicación
            </button>
          </div>
          <div v-else>
            <button class="wa-gps-modal-btn wa-gps-get-btn" @click="sendCurrentLocation" :disabled="gpsLoading">
              <ion-icon name="locate-outline" style="margin-right: 8px;"></ion-icon>Obtener ubicación
            </button>
          </div>
          <button class="wa-gps-modal-btn wa-gps-cancel-btn" @click="closeGpsMenu">
            <ion-icon name="close-outline" style="margin-right: 8px;"></ion-icon>Cancelar
          </button>
        </div>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonFooter, IonInput, IonButton, IonBadge, IonAvatar, IonButtons, IonBackButton, IonModal } from '@ionic/vue';

// GPS modal state
const gpsMenuOpen = ref(false);
const gpsLoading = ref(false);
const gpsError = ref('');
const gpsCoords = ref<{ latitude: number; longitude: number } | null>(null);

function openGpsMenu() {
  gpsMenuOpen.value = true;
  gpsError.value = '';
  gpsCoords.value = null;
  gpsLoading.value = false;
}

function closeGpsMenu() {
  gpsMenuOpen.value = false;
  gpsError.value = '';
  gpsCoords.value = null;
  gpsLoading.value = false;
}

function sendCurrentLocation() {
  gpsLoading.value = true;
  gpsError.value = '';
  gpsCoords.value = null;
  if (!navigator.geolocation) {
    gpsError.value = 'Geolocation is not supported by your browser.';
    gpsLoading.value = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsCoords.value = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      };
      gpsLoading.value = false;
    },
    (err) => {
      gpsError.value = 'Could not get location: ' + err.message;
      gpsLoading.value = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function confirmSendLocation() {
  if (!gpsCoords.value) return;
  // Send as a special message format
  const locText = `📍 Location: https://maps.google.com/?q=${gpsCoords.value.latitude},${gpsCoords.value.longitude}`;
  if (ws.value && ws.value.readyState === WebSocket.OPEN && token && contactId.value && myId) {
    ws.value.send(
      JSON.stringify({
        type: 'chat',
        to: Number(contactId.value),
        text: locText
      })
    );
    messages.value.push({ text: locText, from: myId, timestamp: new Date().toISOString() });
    nextTick(() => scrollToLastMessage());
  }
  closeGpsMenu();
}

// Utility to convert URLs in text to clickable links (with basic sanitization)
function linkify(text: string): string {
  if (!text) return '';
  // Escape HTML special chars
  const escapeHtml = (str: string) => str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]!));
  // Regex for URLs
  const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
  return escapeHtml(text).replace(urlRegex, url => {
    let href = url;
    if (!href.startsWith('http')) href = 'http://' + href;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function formatDate(ts?: string) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString();
}

function showDateDivider(idx: number) {
  if (idx === 0) return true;
  const prev = messages.value[idx - 1];
  const curr = messages.value[idx];
  if (!prev?.timestamp || !curr?.timestamp) return false;
  const prevDate = new Date(prev.timestamp).toDateString();
  const currDate = new Date(curr.timestamp).toDateString();
  return prevDate !== currDate;
}


import { onMounted, ref, watch, nextTick } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonFooter, IonInput, IonButton, IonBadge, IonAvatar, IonButtons, IonBackButton } from '@ionic/vue';

const serverUrl = ref(localStorage.getItem('chat_server_url') || 'http://localhost:3000');
// WebSocket connection managed by composable
// Listen for server URL changes from Tab3Page
window.addEventListener('storage', (e) => {
  if (e.key === 'chat_server_url') {
    serverUrl.value = e.newValue || '';
    fetchChat();

  }
});

const route = useRoute();
const contactId = ref('');
const contactPicture = ref('');
const contactName = ref('Contact');
const myId = Number(localStorage.getItem('chat_user_id'));
const messages = ref<Array<{ id?: number; text: string; from: number; timestamp?: string }>>([]);
const input = ref('');
const token = localStorage.getItem('chat_token') || '';
const { ws, connected: wsConnected } = useWebSocket(serverUrl.value, token, (msg) => {
  console.log('WebSocket message received:', msg);
  if (msg.type === 'auth' && msg.success) {
    // Authenticated
  } else if (msg.type === 'chat' && (msg.from == Number(contactId.value) || msg.from == myId)) {
    messages.value.push({ text: msg.text, from: msg.from, timestamp: msg.timestamp });
    nextTick(() => scrollToLastMessage());
  }
});
const contentRef = ref();
const messagesRef = ref();
const chats = ref<Record<number, Array<{ id?: number; text: string; from: number; timestamp?: string }>>>({});
const lastMessageRef = ref();
const contactOnline = ref<boolean | null>(null);

function loadStoredMessages() {
  const allChats = JSON.parse(localStorage.getItem('all_chats') || '{}');
  if (contactId.value && allChats[contactId.value]) {
    messages.value = allChats[contactId.value];
  } else {
    messages.value = [];
  }
}


function setContactFromRoute() {
  contactId.value = route.query.id as string || '';
  contactPicture.value = 'img/avatar.svg';
  if (route.query.picture as string) {
    contactPicture.value = serverUrl.value + (route.query.picture as string) || 'img/avatar.svg';
  }
  console.log('Route query:', route.query.picture);
  contactName.value = route.query.name as string || 'Contact';
}

onMounted(() => {
  setContactFromRoute();
  messages.value = [];
  fetchChat();
  checkContactOnline();
});

// Watch for route changes (including when user selects a new contact)
watch(() => route.fullPath, () => {
  setContactFromRoute();
  messages.value = [];
  fetchChat();
});

async function fetchChat() {
  if (!token || !contactId.value) return;
  try {
    const response = await fetch(`${serverUrl.value}/chats/${contactId.value}`, {
      headers: { Authorization: token }
    });
    const data = await response.json();
    if (data.success && Array.isArray(data.messages)) {
      messages.value = data.messages;
      console.log('Fetched messages:', data.messages);

      // Update localStorage for instant access next time
      const allChats = JSON.parse(localStorage.getItem('all_chats') || '{}');
      allChats[contactId.value] = data.messages;
      localStorage.setItem('all_chats', JSON.stringify(allChats));
      scrollToLastMessage();
      nextTick(() => scrollToLastMessage());
    }
  } catch (e) { }
}

function checkContactOnline() {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN || !contactId.value) return;
  ws.value.send(JSON.stringify({ type: 'is_connected', userId: Number(contactId.value) }));
}

if (ws.value) {
  ws.value.addEventListener('message', (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'is_connected' && String(msg.userId) === String(contactId.value)) {
        contactOnline.value = !!msg.connected;
      }
    } catch { }
  });
}

watch([() => contactId.value, wsConnected], ([newId, isWsConnected]) => {
  if (isWsConnected && newId) {
    setTimeout(checkContactOnline, 300);
  }
});

function sendMessage() {
  if (!input.value || !token || !contactId.value || !ws.value || ws.value.readyState !== WebSocket.OPEN || !myId) return;
  ws.value.send(JSON.stringify({ type: 'chat', to: Number(contactId.value), text: input.value }));
  console.log(JSON.stringify({ type: 'chat', to: Number(contactId.value), text: input.value }));
  input.value = '';
  nextTick(() => scrollToLastMessage());
}

function scrollToLastMessage() {
  messagesRef.value.scrollIntoView({ behavior: 'smooth', block: 'end' });
  console.log('Scrolling to last message');
  /*nextTick(() => {
    const el = lastMessageRef.value;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }else
    {
      console.log('Last message element not found');
    }
  });*/
}


</script>

<style scoped>
/* Date divider */
.wa-date-divider {
  text-align: center;
  margin: 16px 0 8px 0;
  color: #888;
  font-size: 0.9em;
  background: #e0e0e0;
  display: inline-block;
  padding: 3px 16px;
  border-radius: 12px;
}

/* WhatsApp-like chat styles */

.wa-header {
  background: #075e54;
  color: #fff;
}

@media (prefers-color-scheme: dark) {
  .wa-header {
    background: #222;
    color: #fff;
  }

  .wa-header ion-title,
  .wa-header ion-avatar,
  .wa-header ion-back-button,
  .wa-header * {
    color: #fff !important;
  }
}

.wa-avatar img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.wa-title {
  color: #b7adad;
  font-weight: 500;
}

.wa-content {
  --padding-bottom: 0;
  background: #ece5dd;
  position: relative;
  overflow: hidden;
}

.wa-messages {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  flex: 1 1 auto;
  padding: 60px 0 70px 0;
  /* header and footer space */
  overflow-x: hidden;
  overflow-y: auto;
}

.wa-msg {
  display: flex;
  margin: 2px 10px;
}

.wa-msg-me {
  justify-content: flex-end;
}

.wa-msg-contact {
  justify-content: flex-start;
}

.wa-bubble {
  max-width: 75vw;
  padding: 10px 16px;
  border-radius: 18px;
  margin-bottom: 2px;
  word-break: break-word;
  font-size: 1em;
  background: #dcf8c6;
  color: #222;
}

.wa-msg-contact .wa-bubble {
  background: #fff;
  border: 1px solid #e0e0e0;
}

.wa-time {
  display: block;
  color: #888;
  font-size: 0.75em;
  margin-top: 2px;
  text-align: right;
}

.wa-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 8px 10px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

@media (prefers-color-scheme: dark) {
  .wa-footer {
    background: #181818;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.5);
  }

  .wa-input {
    background: #222;
    color: #000 !important;
    caret-color: #25d366;
  }

  .wa-send {
    background: #25d366;
    color: #fff;
  }
}

.wa-input {
  flex: 1;
  border: none;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 1em;
  margin-right: 8px;
  background: #f0f0f0;
  color: #222;
  outline: none;
}

.wa-send {
  background: #25d366;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-weight: bold;
  font-size: 1em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.wa-send:active {
  background: #128c7e;
}

.wa-gps {
  background: #fff;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.wa-gps:active {
  background: #e0e0e0;
}


.wa-gps-menu {
  padding: 32px 24px 24px 24px;
  text-align: center;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
}

.wa-gps-modal-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  margin: 10px 0 0 0;
  font-size: 1.08em;
  font-weight: 500;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  outline: none;
}

.wa-gps-send-btn {
  background: #25d366;
  color: #fff;
}

.wa-gps-send-btn:active {
  background: #128c7e;
}

.wa-gps-get-btn {
  background: #f0f0f0;
  color: #222;
}

.wa-gps-get-btn:active {
  background: #e0e0e0;
}

.wa-gps-get-btn:disabled {
  background: #e0e0e0;
  color: #aaa;
  cursor: not-allowed;
}

.wa-gps-cancel-btn {
  background: #fff;
  color: #d32f2f;
  border: 1px solid #d32f2f;
}

.wa-gps-cancel-btn:active {
  background: #fbe9e7;
}

.wa-gps-error {
  color: #d32f2f;
  margin-bottom: 2em;
  font-weight: 500;
}

.wa-gps-loading {
  margin-bottom: 2em;
  color: #888;
}

.wa-gps-coords {
  margin-bottom: 1em;
  font-size: 1em;
  color: #333;
}

/* Hide all scrollbars */
.wa-content::-webkit-scrollbar,
.wa-messages::-webkit-scrollbar {
  display: none;
}

.wa-content,
.wa-messages {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>