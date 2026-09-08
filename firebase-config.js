import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyBrcBeV4Vxt51lgWbsFc1RRxWFsYEWx9jc",
  authDomain: "food-delivery-arabic.firebaseapp.com",
  projectId: "food-delivery-arabic",
  storageBucket: "food-delivery-arabic.firebasestorage.app",
  messagingSenderId: "334450775577",
  appId: "1:334450775577:web:b455cac674f26385eb3c88"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;