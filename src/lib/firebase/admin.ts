/**
 * Firebase Admin SDK Singleton
 * Initializes Firestore for server-side API routes
 * Supports both local dev (service account JSON) and Vercel (env vars)
 */

import { initializeApp, cert, App, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Singleton instances
let firebaseApp: App | undefined;
let firestoreDb: Firestore | undefined;

/**
 * Get or initialize Firebase Admin app
 * Must be called server-side only (API routes, getServerSideProps)
 */
export function getFirebaseAdmin(): App {
  // Return existing instance if available
  if (firebaseApp) {
    return firebaseApp;
  }

  // Prevent reinitialization error in dev (HMR)
  const existingApp = getApps().find(app => app.name === 'smart-lead-mailer-pro');
  if (existingApp) {
    firebaseApp = existingApp;
    return firebaseApp;
  }

  // Build credentials from environment
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Fix newline encoding

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env vars.'
    );
  }

  // Initialize Firebase Admin
  firebaseApp = initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    'smart-lead-mailer-pro' // Named app to avoid conflicts
  );

  return firebaseApp;
}

/**
 * Get Firestore instance with types
 * Usage: const db = getFirestoreDb(); db.collection<Job>('jobs')...
 */
export function getFirestoreDb(): Firestore {
  if (!firestoreDb) {
    const app = getFirebaseAdmin();
    firestoreDb = getFirestore(app);
  }
  return firestoreDb;
}

/**
 * Helper to get typed collection references
 * Example: const jobsCol = getCollection<Job>('jobs');
 */
export function getCollection<T>(collectionPath: string) {
  const db = getFirestoreDb();
  return db.collection(collectionPath) as FirebaseFirestore.CollectionReference<T>;
}

// Export for convenience
export { FieldValue } from 'firebase-admin/firestore';
