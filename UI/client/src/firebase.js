// Import Firebase SDK functions
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCle6nc1na2zeCvCOgfk5zEdyQbB5Nivig",
  authDomain: "ebpf-f6a4d.firebaseapp.com",
  projectId: "ebpf-f6a4d",
  storageBucket: "ebpf-f6a4d.firebasestorage.app",
  messagingSenderId: "981238717052",
  appId: "1:981238717052:web:3f2cf2df6ecd482d6087f9",
  measurementId: "G-NFKFERXX4P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore DB instance
export const db = getFirestore(app);
