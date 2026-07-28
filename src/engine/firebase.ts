import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase Realtime Database Configuration
const firebaseConfig = {
  databaseURL: 'https://ssr-zombie-default-rtdb.asia-southeast1.firebasedatabase.app/',
};

// Initialize Firebase App & Realtime Database instance
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const rtdb = getDatabase(firebaseApp);
