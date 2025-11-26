/**
 * GET /api/cron/process
 * Vercel Cron Job (runs every 2 minutes)
 * Processes campaign jobs through stages:
 * 1. draft → prospecting (find businesses)
 * 2. prospecting → discovering (find emails)
 * 3. discovering → sending (send emails)
 * 4. sending → completed (when done)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllJobs, 
  updateJobStatus, 
  incrementJobStat,
  batchCreateProspects 
} from '@/lib/firebase/firestore';
import { getProspectsFromPlaces } from '@/lib/services/places';
import { batchDiscoverEmails } from '@/lib/services/emailDiscovery';
import { batchSendEmails } from '@/lib/services/sendgrid';
import { JobStatus, Job } from '@/lib/types';

// Batch sizes to respect API rate limits
const PROSPECTING_BATCH_SIZE = 20; // Google Places max per request
const EMAIL_DISCOVERY_BATCH_SIZE = 50; // Process 50 prospects at a time
const SENDING_BATCH_SIZE = 10; // SendGrid free tier: 10 requests/sec

/**
 * Cron job entry point
 */
export async function GET(request: NextRequest) {
  // Optional: verify cron request (Vercel adds this header)
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting job processing...');

    // Fetch all jobs that need processing
    const jobs = await getAllJobs();
    const activeJobs = jobs.filter(job => 
      job.status === 'draft' || 
      job.status === 'prospecting' || 
      job.status === 'discovering' || 
      job.status === 'sending'
    );

    console.log(`[CRON] Found ${activeJobs.length} active jobs`);

    // Process each job
    for (const job of activeJobs) {
      try {
        await processJob(job);
      } catch (error) {
        console.error(`[CRON] Error processing job ${job.id}:`, error);
        // Mark job as failed but continue processing others
        await updateJobStatus(job.id, 'failed');
      }
    }

    return NextResponse.json({ 
      success: true, 
      processedJobs: activeJobs.length 
    });
  } catch (error) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Process a single job through its current stage
 */
async function processJob(job: Job) {
  console.log(`[CRON] Processing job ${job.id} (status: ${job.status})`);

  switch (job.status) {
    case 'draft':
      await handleProspecting(job);
      break;
    case 'prospecting':
      await handleProspecting(job);
      break;
    case 'discovering':
      await handleEmailDiscovery(job);
      break;
    case 'sending':
      await handleSending(job);
      break;
  }
}

/**
 * Stage 1: Find businesses via Google Places API
 */
async function handleProspecting(job: Job) {
  // Update status to prospecting if starting fresh
  if (job.status === 'draft') {
    await updateJobStatus(job.id, 'prospecting');
  }

  console.log(`[PROSPECTING] Finding businesses for ${job.niche} near ${job.targetZip}`);

  try {
    // Fetch businesses from Google Places
    const prospectsData = await getProspectsFromPlaces(job.id, {
      niche: job.niche,
      targetZip: job.targetZip,
      targetCountry: job.targetCountry,
      radiusKm: job.radiusKm,
      maxBusinesses: job.maxBusinesses,
    });

    console.log(`[PROSPECTING] Found ${prospectsData.length} businesses`);

    // Batch save to Firestore
    await batchCreateProspects(job.id, prospectsData);

    // Update job stats
    await incrementJobStat(job.id, 'found', prospectsData.length);
    const withWebsite = prospectsData.filter(p => p.website).length;
    await incrementJobStat(job.id, 'withWebsite', withWebsite);

    // Move to next stage
    await updateJobStatus(job.id, 'discovering');
    console.log(`[PROSPECTING] Completed, moving to discovering`);

  } catch (error) {
    console.error(`[PROSPECTING] Failed for job ${job.id}:`, error);
    await updateJobStatus(job.id, 'failed');
  }
}

/**
 * Stage 2: Discover emails for prospects with websites
 */
async function handleEmailDiscovery(job: Job) {
  console.log(`[DISCOVERING] Finding emails for job ${job.id}`);

  const { getProspectsForJob } = await import('@/lib/firebase/firestore');

  try {
    // Get prospects that need email discovery (have website, no email yet)
    const { prospects } = await getProspectsForJob(job.id, {
      status: 'found',
      limit: EMAIL_DISCOVERY_BATCH_SIZE,
    });

    if (prospects.length === 0) {
      // No more prospects to process, move to sending
      await updateJobStatus(job.id, 'sending');
      console.log(`[DISCOVERING] No more prospects, moving to sending`);
      return;
    }

    console.log(`[DISCOVERING] Processing ${prospects.length} prospects`);

    // Batch discover emails
    const results = await batchDiscoverEmails(prospects);

    // Update each prospect with results
    const { updateProspectStatus } = await import('@/lib/firebase/firestore');
    let emailFoundCount = 0;

    for (const result of results) {
      if (result.discoveredEmail) {
        emailFoundCount++;
      }
      await updateProspectStatus(result.prospectId, result.status, {
        discoveredEmail: result.discoveredEmail || undefined,
        emailSource: 'inferred',
      });
    }

    // Update job stats
    await incrementJobStat(job.id, 'withEmail', emailFoundCount);

    console.log(`[DISCOVERING] Found ${emailFoundCount} emails`);

    // If we processed less than batch size, might be done - check if there are more
    if (prospects.length < EMAIL_DISCOVERY_BATCH_SIZE) {
      const remaining = await getProspectsForJob(job.id, { status: 'found' });
      if (remaining.total === 0) {
        await updateJobStatus(job.id, 'sending');
        console.log(`[DISCOVERING] All prospects processed, moving to sending`);
      }
    }

  } catch (error) {
    console.error(`[DISCOVERING] Failed for job ${job.id}:`, error);
    await updateJobStatus(job.id, 'failed');
  }
}

/**
 * Stage 3: Send emails to prospects with discovered emails
 */
async function handleSending(job: Job) {
  console.log(`[SENDING] Sending emails for job ${job.id}`);

  const { getProspectsForSending } = await import('@/lib/firebase/firestore');

  try {
    // Get prospects ready to send (have email, not sent yet)
    const prospects = await getProspectsForSending(job.id, SENDING_BATCH_SIZE);

    if (prospects.length === 0) {
      // No more prospects to send, mark job as completed
      await updateJobStatus(job.id, 'completed');
      console.log(`[SENDING] All emails sent, job completed`);
      return;
    }

    console.log(`[SENDING] Sending ${prospects.length} emails`);

    // Batch send emails
    // v1: Use placeholder values - in production, get from user config
    const results = await batchSendEmails(prospects, job.id, {
      userName: process.env.DEFAULT_USER_NAME || 'Your Name',
      userCompany: process.env.DEFAULT_USER_COMPANY,
      userService: job.niche, // Use niche as default service description
    });

    // Update job stats
    await incrementJobStat(job.id, 'sent', results.sent);
    await incrementJobStat(job.id, 'bounced', results.failed);

    console.log(`[SENDING] Sent: ${results.sent}, Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.warn(`[SENDING] Errors:`, results.errors.slice(0, 3)); // Log first 3
    }

  } catch (error) {
    console.error(`[SENDING] Failed for job ${job.id}:`, error);
    await updateJobStatus(job.id, 'failed');
  }
}
