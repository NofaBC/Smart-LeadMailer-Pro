/**
 * POST /api/send
 * Manual trigger to force-send a batch of emails for a job
 * Used for testing/debugging (bypasses cron wait)
 * Requires DEBUG_API_KEY header in production
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob, getProspectsForSending } from '@/lib/firebase/firestore';
import { batchSendEmails } from '@/lib/services/sendgrid';

const DEBUG_API_KEY = process.env.DEBUG_API_KEY;

/**
 * POST handler - Force send a batch
 */
export async function POST(request: NextRequest) {
  // Optional debug auth (only enforced in production if DEBUG_API_KEY is set)
  if (process.env.NODE_ENV === 'production' && DEBUG_API_KEY) {
    const authHeader = request.headers.get('x-debug-api-key');
    if (authHeader !== DEBUG_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: invalid debug API key' },
        { status: 401 }
      );
    }
  }

  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid jobId in request body' },
        { status: 400 }
      );
    }

    // Verify job exists and is in correct status
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Only allow sending if job is actively sending
    if (job.status !== 'sending') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Job is not in sending status (current: ${job.status}). Wait for cron to advance stages.` 
        },
        { status: 400 }
      );
    }

    // Fetch prospects ready to send (10 at a time)
    const prospects = await getProspectsForSending(jobId, 10);

    if (prospects.length === 0) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'No prospects ready to send (all sent or no emails found)',
          sent: 0, 
          failed: 0, 
          errors: [] 
        },
        { status: 200 }
      );
    }

    console.log(`[MANUAL SEND] Sending ${prospects.length} emails for job ${jobId}`);

    // Send emails
    const results = await batchSendEmails(prospects, jobId, {
      userName: process.env.DEFAULT_USER_NAME || 'Your Name',
      userCompany: process.env.DEFAULT_USER_COMPANY,
      userService: job.niche, // Default service description
    });

    return NextResponse.json({
      success: true,
      message: `Sent ${results.sent} emails, ${results.failed} failed`,
      ...results,
    });

  } catch (error) {
    console.error('Manual send error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
