/**
 * GET /api/prospects
 * Fetches prospects for a specific job (with optional filters)
 * Query params: jobId (required), status (optional), limit (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProspectsForJob } from '@/lib/firebase/firestore';
import { ProspectStatus } from '@/lib/types';

/**
 * GET handler - List prospects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const jobId = searchParams.get('jobId');
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');

    // Validate required jobId
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid jobId query parameter' },
        { status: 400 }
      );
    }

    // Validate status if provided
    let status: ProspectStatus | undefined;
    if (statusParam) {
      const validStatuses: ProspectStatus[] = [
        'found', 'no_website', 'no_email', 'email_found', 'sent', 'bounced', 'unsubscribed'
      ];
      if (!validStatuses.includes(statusParam as ProspectStatus)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid status. Valid values: ${validStatuses.join(', ')}` 
          },
          { status: 400 }
        );
      }
      status = statusParam as ProspectStatus;
    }

    // Parse limit (default 50, max 500)
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;

    // Fetch from Firestore
    const { prospects, total } = await getProspectsForJob(jobId, { status, limit });

    return NextResponse.json({
      success: true,
      jobId,
      prospects,
      total,
      count: prospects.length,
    });
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
