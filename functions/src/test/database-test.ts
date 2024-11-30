// test that db connected successfully
import { db } from "../config/firebase.js";
import {
  getFirestore,
  collection,
  getDocs,
  Firestore,
} from "firebase/firestore";

async function getUsers(db: Firestore) {
  const users = collection(db, "users");
  return users;
}

console.log("RAN DB TEST FILE");
console.log(getUsers(db));
