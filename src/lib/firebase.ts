import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "plucky-aegis-408915",
  appId: "1:564796706827:web:392d7514feecfd627f770e",
  apiKey: "AIzaSyDZHL0cknHt3W6gkIUQD0f2L-w8ZPBqTRw",
  authDomain: "plucky-aegis-408915.firebaseapp.com",
  storageBucket: "plucky-aegis-408915.firebasestorage.app",
  messagingSenderId: "564796706827",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "ai-studio-eslgamestudioai-3eb6c438-fab4-4cca-9a82-b91a4aede8f0");
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const facebookProvider = new FacebookAuthProvider();

export { auth, db, googleProvider, facebookProvider };
