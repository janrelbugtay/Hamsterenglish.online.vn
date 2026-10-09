import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "plucky-aegis-408915",
  appId: "1:564796706827:web:392d7514feecfd627f770e",
  apiKey: "AIzaSyDZHL0cknHt3W6gkIUQD0f2L-w8ZPBqTRw",
  authDomain: "plucky-aegis-408915.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-eslgamestudioai-3eb6c438-fab4-4cca-9a82-b91a4aede8f0");

async function run() {
  const snapshot = await getDocs(collection(db, 'users'));
  const users: any[] = [];
  snapshot.forEach(doc => {
    users.push(doc.data());
  });
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}
run();
