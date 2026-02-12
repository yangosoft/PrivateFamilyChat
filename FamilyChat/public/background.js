

// const permissions = LocalNotifications.checkPermissions();
// if (permissions.display !== 'granted'){
// CapacitorNotifications.requestPermissions();
// }

// // Function to check for pending messages and notify
// async function checkPendingMessagesAndNotify() {

//   const [{ value: token }, { value: serverUrl }] = await Promise.all([
//     CapacitorKV.get({ key: 'chat_token' }),
//     CapacitorKV.get({ key: 'chat_server_url' })
//   ]);

//   if (!token || !serverUrl) {
//     console.error('Token or server URL not found in preferences');
//   }



//   try {

//     CapacitorNotifications.schedule([
//       {
//         id: 100,
//         title: 'Enterprise Background Runner',
//         body: 'Received silent push notification',
//         schedule: { at: new Date(Date.now() + 1000) },
//       },
//     ]);

//     const resp = await fetch(`${serverUrl}/chats/pending/counts`, {
//       headers: { Authorization: token }
//     });

//     const data = JSON.stringify(resp);
//     if (data.success && data.counts) {
//       const totalPending = Object.values(data.counts).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
//       if (totalPending >= 0 && LocalNotifications && LocalNotifications.schedule) {
//         await LocalNotifications.schedule({
//           notifications: [
//             {
//               title: 'FamilyChat',
//               body: `You have ${totalPending} pending message${totalPending > 1 ? 's' : ''}!`,
//               id: Date.now(),
//               schedule: { at: new Date(Date.now() + 1000) },
//               sound: null,
//               attachments: null,
//               actionTypeId: '',
//               extra: null
//             }
//           ]
//         });
//         // Try to launch the app if possible (Android only, using Capacitor App plugin)
//         if (App && App.launch) {
//           App.launch();
//         }
//       }
//     } else {
//       await LocalNotifications.schedule({
//         notifications: [
//           {
//             title: 'FamilyChat',
//             body: 'You have 0 pending message!',
//             id: Date.now(),
//             schedule: { at: new Date(Date.now() + 1000) },
//             sound: null,
//             attachments: null,
//             actionTypeId: '',
//             extra: null
//           }
//         ]
//       });
//     }
//   } catch (e) {
//     // Network or server error
//     console.error('Error checking pending messages:', e);
//   }
// }

// addEventListener('myCustomEvent', async (resolve, reject, args) => {
//   console.log('do something to update the system here');
//   try {
//     await checkPendingMessagesAndNotify();
//     resolve();
//   } catch (e) {
//     reject(e);
//   }
// });


/*
const permissions = CapacitorNotifications.checkPermissions();
if (permissions.display !== 'granted'){
CapacitorNotifications.requestPermissions();
}

// Function to check for pending messages and notify
function checkPendingMessagesAndNotify() {


    const token = CapacitorKV.get('chat_token');
    const serverUrl = CapacitorKV.get('chat_server_url');


  if (!token || !serverUrl) {
    console.error('Token or server URL not found in preferences');
  }





    CapacitorNotifications.schedule([
      {
        id: 100,
        title: 'Enterprise Background Runner',
        body: 'Received silent push notification',
        schedule: { at: new Date(Date.now() + 1000) },
      },
    ]);

    const resp = await fetch(`${serverUrl}/chats/pending/counts`, {
      headers: { Authorization: token }
    });
    console.log(JSON.stringify(resp));
}*/

addEventListener('myCustomEvent', (resolve, reject, args) => {
  console.log('do something to update the system here');
  //checkPendingMessagesAndNotify();
  //resolve();
  try {
    console.log('received silent push notification');
    const token = CapacitorKV.get('chat_token');
    const serverUrl = CapacitorKV.get('chat_server_url');

    const resp = await fetch(`${serverUrl}/chats/pending/counts`, {
      headers: { Authorization: token }
    });


    const data = await resp.json();
    console.log('response data:', data);

    if ((data.success !== undefined) && (data.pending > 0)) {

      CapacitorNotifications.schedule([
        {
          id: Date.now(),
          title: 'FamilyChat',
          body: 'Tienes nuevos mensajes',
        },
      ]);
    }

    resolve();
  } catch (err) {
    reject();
  }
});