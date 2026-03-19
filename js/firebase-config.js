// ============================================================
// FIREBASE CONFIGURATION
// Replace the values below with your own Firebase project config.
// Get it from: Firebase Console → Project Settings → Your apps → Web app
// ============================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAuNs7iHVxIp3JZWk8W1adrDaHLZsA5pno",
  authDomain: "nursetime-3287d.firebaseapp.com",
  projectId: "nursetime-3287d",
  storageBucket: "nursetime-3287d.firebasestorage.app",
  messagingSenderId: "520396555098",
  appId: "1:520396555098:web:42db19d2f0b7512b512963",
  measurementId: "G-M46RENSSYM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Enable Firestore offline persistence (works great on iOS PWA)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: multiple tabs open.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this browser.');
  }
});
