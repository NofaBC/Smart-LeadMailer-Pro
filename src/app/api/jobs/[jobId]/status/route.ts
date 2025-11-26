/**
 * PATCH /api/jobs/[jobId]/status
 * Updates the status of a campaign job (used by cron job)
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/firebase/firestore';
import { JobStatus } from '@/lib/types';

/**
 * PATCH handler - Update job status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid jobId' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses: JobStatus[] = ['draft', 'prospecting', 'discovering', 'sending', 'completed', 'failed'];
    if (!status || !validStatuses.includes(status as JobStatus)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Optional: update stats if provided
    const { stats } = body;

    // Update in Firestore
    await updateJobStatus(jobId, status as JobStatus, stats);

    return NextResponse.json({
      success: true,
      message: `Job status updated to ${status}`,
    });
  } catch (error) {
    console.error(`Error updating job ${params?.jobId} status:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
