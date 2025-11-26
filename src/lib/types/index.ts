/**
 * Smart LeadMailer Pro™ - Core Types
 * Defines all data structures for Jobs, Prospects, and Email Events
 */

// Campaign job status
export type JobStatus = 'draft' | 'prospecting' | 'discovering' | 'sending' | 'completed' | 'failed';
export type ProspectStatus = 'found' | 'no_website' | 'no_email' | 'email_found' | 'sent' | 'bounced' | 'unsubscribed';

// Main campaign object stored in Firestore
export interface Job {
  id: string;
  userId: string; // For future auth; v1 uses a fixed internal ID
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  
  // Campaign config
  niche: string; // e.g., "acupuncture clinic"
  targetZip: string; // ZIP code or city
  targetCountry: string; // ISO2 code, e.g., "US"
  radiusKm: number; // Search radius
  maxBusinesses: number; // Cap on prospects
  
  // Runtime stats (updated as job progresses)
  stats: {
    found: number; // Total businesses discovered
    withWebsite: number;
    withEmail: number;
    sent: number;
    bounced: number;
    unsubscribed: number;
  };
}

// Prospect discovered via Google Places
export interface Prospect {
  id: string;
  jobId: string; // FK to Job
  status: ProspectStatus;
  createdAt: Date;
  updatedAt: Date;
  
  // Google Places data
  name: string;
  address: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  placeId: string; // Google Place ID for deduplication
  
  // Email discovery
  discoveredEmail?: string;
  emailSource: 'inferred' | 'scraped' | 'verified'; // v1 only uses 'inferred'
  
  // Sending metadata
  sendGridMessageId?: string;
  sentAt?: Date;
  bouncedAt?: Date;
  bounceReason?: string;
  unsubscribedAt?: Date;
}

// Unsubscribe record for compliance
export interface Unsubscribe {
  id: string;
  email: string;
  domain: string;
  unsubscribedAt: Date;
  jobId?: string; // Optional: which campaign caused it
}

// API request/response types
export interface CreateJobRequest {
  niche: string;
  targetZip: string;
  targetCountry?: string;
  radiusKm: number;
  maxBusinesses: number;
}

export interface JobDashboardResponse {
  id: string;
  status: JobStatus;
  niche: string;
  targetZip: string;
  createdAt: string; // ISO string
  stats: Job['stats'];
}

// SendGrid event webhook payload (simplified)
export interface SendGridEvent {
  email: string;
  event: 'delivered' | 'bounce' | 'dropped' | 'unsubscribe';
  sg_message_id: string;
  reason?: string;
}
