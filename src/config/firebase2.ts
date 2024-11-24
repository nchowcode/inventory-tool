// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC08TRVMw-VAM2NXbb7keN4jb7DGSNrk9o",
  authDomain: "inventory-manager-c3a7e.firebaseapp.com",
  projectId: "inventory-manager-c3a7e",
  storageBucket: "inventory-manager-c3a7e.firebasestorage.app",
  messagingSenderId: "47211038381",
  appId: "1:47211038381:web:6d548878dac8177656a824",
  measurementId: "G-5831WYQGGF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);