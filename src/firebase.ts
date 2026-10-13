import type { User } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every(Boolean)
export const allowedEmails = (import.meta.env.VITE_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean)

const loadFirebase = () => import('./firebaseClient')
const reportLoadFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Firebase could not be loaded.'
  window.dispatchEvent(new CustomEvent('us-exe-firebase-error', { detail: message }))
}

export function watchAuth(callback: (user: User | null) => void) {
  if (!firebaseConfigured) return () => {}
  let cancelled = false
  let unsubscribe: (() => void) | undefined
  void loadFirebase().then((client) => {
    if (!cancelled) unsubscribe = client.watchAuth((user) => {
      if (!user) {
        callback(null)
      } else if (allowedEmails.includes(user.email?.toLowerCase() ?? '') && user.emailVerified) {
        callback(user)
      } else if (!user.emailVerified && allowedEmails.includes(user.email?.toLowerCase() ?? '')) {
        callback(null)
      } else {
        callback(null)
        void client.signOutUser().catch(reportLoadFailure)
      }
    })
  }).catch(reportLoadFailure)
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

export async function signIn(email: string, password: string) {
  if (!firebaseConfigured) throw new Error('Firebase is not configured yet.')
  if (!allowedEmails.includes(email.trim().toLowerCase())) {
    throw new Error('This email is not on the two-person access list.')
  }
  const client = await loadFirebase()
  const credential = await client.signIn(email.trim(), password)
  if (!credential.user.emailVerified) {
    try {
      await client.sendVerificationEmail(credential.user)
    } finally {
      await client.signOutUser()
    }
    return { verificationSent: true as const }
  }
  return { verificationSent: false as const, credential }
}

export async function signOutUser() {
  if (!firebaseConfigured) return
  const client = await loadFirebase()
  await client.signOutUser()
}

export function watchCollection<T extends { id: string } = { id: string }>(
  name: string,
  callback: (records: T[]) => void,
  onError: (error: Error) => void,
) {
  if (!firebaseConfigured) return () => {}
  let cancelled = false
  let unsubscribe: (() => void) | undefined
  void loadFirebase().then((client) => {
    if (!cancelled) unsubscribe = client.watchCollection<T>(name, callback, onError)
  }).catch((reason: unknown) => {
    if (reason instanceof Error) onError(reason)
    else onError(new Error('Firebase could not be loaded.'))
  })
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

export async function saveSharedRecord(
  name: string,
  id: string,
  data: Record<string, unknown>,
) {
  const client = await loadFirebase()
  await client.saveSharedRecord(name, id, data)
}

export async function removeSharedRecord(name: string, id: string) {
  const client = await loadFirebase()
  await client.removeSharedRecord(name, id)
}
