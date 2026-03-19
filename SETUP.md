# NurseTime Web — Setup Guide

## 1. Firebase Project Setup

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `NurseTime`
3. Disable Google Analytics (optional) → **Create project**

### Enable Authentication
1. In the Firebase console → **Authentication** → **Get started**
2. **Sign-in method** tab → Enable **Email/Password**

### Enable Firestore
1. **Firestore Database** → **Create database**
2. Choose **Start in production mode** → select a region → **Enable**

### Add Firestore Security Rules
In Firestore → **Rules** tab, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Click **Publish**.

### Get your Firebase Config
1. **Project Settings** (gear icon) → **Your apps** → **Add app** → **Web** (</>)
2. Register app name `NurseTime Web`
3. Copy the `firebaseConfig` object

## 2. Paste Firebase Config

Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 3. Generate App Icons

1. Open `icons/generate-icons.html` in a browser
2. Right-click each canvas → **Save image as**
   - First canvas → save as `icons/icon-192.png`
   - Second canvas → save as `icons/icon-512.png`

## 4. Run / Host the App

### Local development (any static server):
```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# VS Code: use Live Server extension
```

Then open: `http://localhost:8080`

### Deploy to Firebase Hosting (recommended for iOS PWA):
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, public dir = "."
firebase deploy
```

Your app will be at `https://your-project.web.app`

> **iOS PWA tip:** Open the hosted URL in Safari → tap Share → **Add to Home Screen**.
> The app will launch fullscreen with no browser chrome.

## 5. First Use

1. Open the app → tap **Sign Up** → create your account
2. Go to **Settings** tab → enter your name, employer, and hourly rates
3. Tap **Save Settings**
4. Switch to **Clock** tab → tap **CLOCK IN** to start your first shift!

---

## File Structure

```
NurseAppWeb/
├── index.html            Main app shell
├── manifest.json         PWA install manifest
├── service-worker.js     Offline caching
├── SETUP.md              This file
├── css/
│   └── app.css           All custom styles
├── js/
│   ├── firebase-config.js  ← EDIT THIS with your Firebase config
│   ├── shift-utils.js    Pure calculation functions
│   ├── db.js             Firestore CRUD
│   ├── auth.js           Firebase Auth
│   ├── clock.js          Clock tab
│   ├── calendar.js       Calendar tab
│   ├── pay.js            Pay tab
│   └── settings.js       Settings tab
└── icons/
    ├── generate-icons.html  Open in browser to generate icons
    ├── icon-192.png         (generate and save here)
    └── icon-512.png         (generate and save here)
```
