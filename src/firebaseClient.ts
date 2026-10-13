import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth, onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth'
import {
  collection, deleteDoc, doc, getFirestore, onSnapshot, setDoc,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps()[0] ?? initializeApp(config)
const auth = getAuth(app)
const db = getFirestore(app)

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user)
}

export async function signOutUser() {
  await signOut(auth)
}

export function watchCollection<T extends { id: string } = { id: string }>(
  name: string,
  callback: (records: T[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, 'couples', 'main', name),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]),
    onError,
  )
}

export async function saveSharedRecord(
  name: string,
  id: string,
  data: Record<string, unknown>,
) {
  await setDoc(doc(db, 'couples', 'main', name, id), data, { merge: true })
}

export async function removeSharedRecord(name: string, id: string) {
  await deleteDoc(doc(db, 'couples', 'main', name, id))
}
