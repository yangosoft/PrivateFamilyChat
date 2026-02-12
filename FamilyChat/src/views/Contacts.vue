<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-avatar slot="start" style="margin-right: 12px;">
          <img :src="myPicture" alt="My picture" />
        </ion-avatar>
        <ion-title>{{ myName || 'My Account' }}</ion-title>
        <div style="display: flex; align-items: center; margin-left: 16px;">
          <ion-badge :color="connected ? 'success' : 'medium'" style="margin-right: 6px;">
            {{ connected ? 'Conectado' : 'Desconectado' }}
          </ion-badge>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Contactos</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list>
        <ion-item v-for="contact in contacts" :key="contact.id" @click="openChat(contact)">
          <ion-avatar slot="start">
            <img :src="serverUrl + contact.picture || 'img/avatar.svg'" alt="Contact picture" />
          </ion-avatar>
          <ion-label style="display: flex; align-items: center;">
            <span>{{ contact.name }}</span>
            <ion-badge v-if="pendingCounts[contact.id] && pendingCounts[contact.id] > 0" color="danger"
              style="margin-left:8px;">
              {{ pendingCounts[contact.id] }}
            </ion-badge>
            <ion-badge :color="contactOnlineStatus[contact.id] ? 'success' : 'medium'"
              style="margin-left:8px; min-width: 60px;">
              {{ contactOnlineStatus[contact.id] ? 'Online' : 'Offline' }}
            </ion-badge>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>



<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import { onIonViewWillEnter } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonAvatar, IonLabel, IonBadge } from '@ionic/vue';
import { Preferences } from '@capacitor/preferences';

const token = ref(localStorage.getItem('chat_token'));
const contacts = ref<Array<{ id: number; name: string; picture: string }>>([]);
const pendingCounts = ref<Record<number, number>>({});
const contactOnlineStatus = ref<Record<number, boolean>>({});

const myId = ref(Number(localStorage.getItem('chat_user_id')) || null);
const myName = ref(localStorage.getItem('chat_username') || '');
const myPicture = ref(localStorage.getItem('chat_user_picture') || 'img/avatar.svg');
const serverUrl = ref(localStorage.getItem('chat_server_url') || 'http://localhost:3000');


// Listen for server URL changes from Tab3Page
window.addEventListener('storage', (e) => {
  if (e.key === 'chat_server_url') {
    serverUrl.value = e.newValue || '';
    refreshAll();
  }
});
// WebSocket is now managed globally via composable
const chats = ref<Record<number, Array<{ id?: number; text: string; from: number; timestamp?: string }>>>({});

const router = useRouter();

function openChat(contact: { id: number; name: string; picture: string }) {
  // Save the current chat for this contact to localStorage so ChatPage can load it instantly
  const allChats = JSON.parse(localStorage.getItem('all_chats') || '{}');
  const chatHistory = chats.value && chats.value[contact.id] ? chats.value[contact.id] : [];
  allChats[contact.id] = chatHistory;
  localStorage.setItem('all_chats', JSON.stringify(allChats));
  router.push({
    path: '/tabs/chat',
    query: { id: contact.id, name: contact.name, picture: contact.picture }
  });
}

async function updateContactsAndMe() {
  myId.value = Number(localStorage.getItem('chat_user_id')) || null;
  token.value = localStorage.getItem('chat_token');
  myName.value = localStorage.getItem('chat_username') || '';
  if (!token.value) {
    contacts.value = [];
    myName.value = '';
    myPicture.value = 'https://ionicframework.com/docs/img/demos/avatar.svg';
    return;
  }
  const response = await fetch(`${serverUrl.value}/contacts`, {
    headers: { Authorization: token.value }
  });
  const data = await response.json();
  if (data.success && Array.isArray(data.contacts)) {
    const filtered = data.contacts.filter((c: { id: number; name: string; picture: string }) => c.id !== myId.value);
    contacts.value = filtered;
    console.log('Fetched contacts:', contacts.value);
    const me = data.contacts.find((c: { id: number; name: string; picture: string }) => c.id === myId.value);
    if (me) {
      myName.value = me.name;
      myPicture.value = me.picture ? (me.picture.startsWith('http') ? me.picture : serverUrl.value + me.picture) : (localStorage.getItem('chat_user_picture') || 'img/avatar.svg');
    }
  } else {
    contacts.value = [];
  }
}



async function updatePendingCountsAndWS() {
  if (!token.value) return;
  // Fetch pending message counts
  const resp2 = await fetch(`${serverUrl.value}/chats/pending/counts`, {
    headers: { Authorization: token.value }
  });
  const data2 = await resp2.json();
  console.log('Fetched pending counts:', data2);
  if (data2.success && data2.by_contact) {
    // Clear previous pending counts
    pendingCounts.value = {};
    for (const contactId in data2.by_contact) {
      if (Object.prototype.hasOwnProperty.call(data2.by_contact, contactId)) {
        const count = data2.by_contact[contactId];
        pendingCounts.value[Number(contactId)] = Number(count);
        console.log(`Pending count for contact ${contactId}: ${count}`);
      }
    }
  }

}

// Setup global WebSocket for notifications and connection status
const { ws: globalWs, connected } = useWebSocket(serverUrl.value, token.value || '', (msg) => {
  console.log('WebSocket message received in Contacts.vue:', msg);
  if ((msg.type === 'notify' || msg.type === 'new_message' || msg.type === 'chat') && msg.from) {
    const cid = parseInt(msg.from, 10);
    if (!isNaN(cid)) {
      pendingCounts.value[cid] = (pendingCounts.value[cid] || 0) + 1;
    }
  }else if (msg.type === 'new_messages' && msg.timestamp) {
    console.log('Received new_messages notification from server at', msg.timestamp);
    // Handle new_messages notification if needed
    updatePendingCountsAndWS();
  }
});

// Helper to check online status for all contacts
function checkContactsOnline() {
  if (!globalWs.value || globalWs.value.readyState !== 1) return;
  contacts.value.forEach(contact => {
    try {
      globalWs.value.send(JSON.stringify({ type: 'is_connected', userId: contact.id }));
    } catch { }
  });
}

// Listen for is_connected responses
if (globalWs.value) {
  globalWs.value.addEventListener('message', (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'is_connected' && typeof msg.userId !== 'undefined') {
        contactOnlineStatus.value[msg.userId] = !!msg.connected;
      }else if (msg.type === 'new_messages' && msg.timestamp) {
        console.log('Received new_messages notification from server at', msg.timestamp);
        // Handle new_messages notification if needed
        updatePendingCountsAndWS();
      }
    } catch { }
  });
}

watch([contacts, connected], ([newContacts, isWsConnected]) => {
  if (isWsConnected && newContacts.length > 0) {
    setTimeout(checkContactsOnline, 300); // Give ws a moment to connect
  }
});

async function fetchAllChats(token: string) {
  const contactIds = contacts.value.map(c => c.id);
  const chatResults: Record<number, Array<{ id?: number; text: string; from: number; timestamp?: string }>> = {};
  for (const id of contactIds) {
    try {
      const resp = await fetch(`${serverUrl.value}/chats/${id}`, {
        headers: { Authorization: token }
      });
      const data = await resp.json();
      if (data.success && Array.isArray(data.messages)) {
        chatResults[id] = data.messages;
      } else {
        chatResults[id] = [];
      }
    } catch {
      chatResults[id] = [];
    }
  }
  chats.value = chatResults;
}

async function refreshAll() {
  await updateContactsAndMe();
  await updatePendingCountsAndWS();
}

let onlineStatusInterval: ReturnType<typeof setInterval> | null = null;
let pendingCountsInterval: ReturnType<typeof setInterval> | null = null;

function startOnlineStatusInterval() {
  if (onlineStatusInterval) clearInterval(onlineStatusInterval);
  onlineStatusInterval = setInterval(checkContactsOnline, 60000); // every minute
}

function stopOnlineStatusInterval() {
  if (onlineStatusInterval) {
    clearInterval(onlineStatusInterval);
    onlineStatusInterval = null;
  }
}

function startCheckPendingCountsInterval() {
  if (pendingCountsInterval) clearInterval(pendingCountsInterval);
  pendingCountsInterval = setInterval(updatePendingCountsAndWS, 30000); // every 30 seconds
}

function stopCheckPendingCountsInterval() {
  if (pendingCountsInterval) {
    clearInterval(pendingCountsInterval);
    pendingCountsInterval = null;
  }
}


onMounted(async () => {
  refreshAll();
  checkContactsOnline(); // refresh on view display
  startOnlineStatusInterval();
  startCheckPendingCountsInterval();
});

onIonViewWillEnter(() => {
  refreshAll();
  checkContactsOnline(); // refresh on view display
  startOnlineStatusInterval();
  startCheckPendingCountsInterval();
});

onUnmounted(() => {
  stopOnlineStatusInterval();
  stopCheckPendingCountsInterval();
});


watch(token, () => {
  refreshAll();
});



window.addEventListener('storage', (e) => {
  if (e.key === 'chat_token' || e.key === 'chat_user_id') {
    refreshAll();
  }
});

watch([contacts, token], ([newContacts, newToken]) => {
  if (newToken && newContacts.length > 0) {
    //fetchAllChats(newToken);
  }
});
</script>
