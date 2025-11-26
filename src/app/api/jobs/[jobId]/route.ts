/**
 * GET /api/jobs/[jobId]
 * Fetches a single campaign job by ID (for detail page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/firebase/firestore';

/**
 * GET handler - Retrieve single job
 */
export async function GET(
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

    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error(`Error fetching job ${params?.jobId}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
