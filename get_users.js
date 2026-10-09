import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app);

const run = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const users = snap.docs.map(d => d.data());
    console.log(users);
    process.exit(0);
};
run();
