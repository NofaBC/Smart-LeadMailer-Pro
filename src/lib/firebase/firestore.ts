/**
 * Typed Firestore CRUD Helpers
 * Provides type-safe operations for Jobs, Prospects, and Unsubscribes
 */

import { getFirestoreDb, getCollection, FieldValue } from './admin';
import { Job, Prospect, Unsubscribe, JobStatus, ProspectStatus } from '@/lib/types';
import { DocumentReference, CollectionReference, Query } from 'firebase-admin/firestore';

// ==================== COLLECTION REFS ====================

const jobsColl = (): CollectionReference<Job> => getCollection<Job>('jobs');
const prospectsColl = (): CollectionReference<Prospect> => getCollection<Prospect>('prospects');
const unsubscribesColl = (): CollectionReference<Unsubscribe> => getCollection<Unsubscribe>('unsubscribes');

// ==================== JOB OPERATIONS ====================

/**
 * Create a new campaign job
 */
export async function createJob(data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await jobsColl().add({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return docRef.id;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const doc = await jobsColl().doc(jobId).get();
  return doc.exists ? (doc.data() as Job) : null;
}

/**
 * Update job status and stats
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  stats?: Partial<Job['stats']>
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (stats) {
    // Merge stats fields individually to avoid overwriting entire object
    Object.keys(stats).forEach(key => {
      updateData[`stats.${key}`] = stats[key as keyof Job['stats']];
    });
  }

  await jobsColl().doc(jobId).update(updateData);
}

/**
 * Increment a specific stat counter
 */
export async function incrementJobStat(jobId: string, statField: keyof Job['stats'], amount = 1): Promise<void> {
  await jobsColl().doc(jobId).update({
    [`stats.${statField}`]: FieldValue.increment(amount),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ==================== PROSPECT OPERATIONS ====================

/**
 * Batch create prospects (for performance during Google Places import)
 */
export async function batchCreateProspects(jobId: string, prospects: Omit<Prospect, 'id' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
  const batch = getFirestoreDb().batch();
  const collection = prospectsColl();

  prospects.forEach(prospect => {
    const docRef = collection.doc(); // Auto-generate ID
    batch.set(docRef, {
      ...prospect,
      jobId,
      status: 'found' as ProspectStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  await batch.commit();
}

/**
 * Get paginated prospects for a job (for the detail page)
 */
export async function getProspectsForJob(
  jobId: string,
  options?: {
    status?: ProspectStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ prospects: Prospect[]; total: number }> {
  let query: Query<Prospect> = prospectsColl().where('jobId', '==', jobId);

  if (options?.status) {
    query = query.where('status', '==', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  // Note: Firestore doesn't support offset; use startAfter() with cursor for real pagination
  // This is simplified for v1

  const [prospectsSnaps, totalSnap] = await Promise.all([
    query.get(),
    prospectsColl().where('jobId', '==', jobId).count().get(),
  ]);

  const prospects = prospectsSnaps.docs.map(doc => doc.data());
  const total = totalSnap.data().count;

  return { prospects, total };
}

/**
 * Update prospect status and optional email
 */
export async function updateProspectStatus(
  prospectId: string,
  status: ProspectStatus,
  emailData?: {
    discoveredEmail?: string;
    emailSource?: Prospect['emailSource'];
  }
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (emailData?.discoveredEmail) {
    updateData.discoveredEmail = emailData.discoveredEmail;
    updateData.emailSource = emailData.emailSource || 'inferred';
  }

  await prospectsColl().doc(prospectId).update(updateData);
}

/**
 * Get prospects ready for sending (have email, not sent yet)
 */
export async function getProspectsForSending(jobId: string, batchSize: number): Promise<Prospect[]> {
  const snap = await prospectsColl()
    .where('jobId', '==', jobId)
    .where('status', '==', 'email_found')
    .limit(batchSize)
    .get();

  return snap.docs.map(doc => doc.data());
}

// ==================== UNSUBSCRIBE OPERATIONS ====================

/**
 * Check if email/domain is unsubscribed
 */
export async function isUnsubscribed(email: string): Promise<boolean> {
  const domain = email.split('@')[1].toLowerCase();
  
  const [emailSnap, domainSnap] = await Promise.all([
    unsubscribesColl().where('email', '==', email.toLowerCase()).limit(1).get(),
    unsubscribesColl().where('domain', '==', domain).limit(1).get(),
  ]);

  return !emailSnap.empty || !domainSnap.empty;
}

/**
 * Add email to unsubscribe list (called when user clicks unsubscribe link)
 */
export async function addUnsubscribe(email: string, jobId?: string): Promise<void> {
  const domain = email.split('@')[1].toLowerCase();
  
  await unsubscribesColl().add({
    id: '', // Will be overwritten by Firestore
    email: email.toLowerCase(),
    domain,
    unsubscribedAt: new Date(),
    jobId,
  });
}

// ==================== DASHBOARD QUERIES ====================

/**
 * Get all jobs for dashboard (no auth in v1, so returns all)
 */
export async function getAllJobs(limit = 50): Promise<Job[]> {
  const snap = await jobsColl()
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snap.docs.map(doc => doc.data());
}
