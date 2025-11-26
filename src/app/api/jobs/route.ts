/**
 * POST /api/jobs
 * Creates a new campaign job (starts in 'draft' status)
 * GET /api/jobs
 * Returns all jobs for the dashboard (v1: no auth, returns all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob, getAllJobs } from '@/lib/firebase/firestore';
import { 
  sanitizeLocationInput, 
  sanitizeNiche, 
  sanitizeCountryCode, 
  sanitizeRadius, 
  sanitizeMaxBusinesses 
} from '@/lib/utils/sanitize';

// v1: Fixed internal user ID (no authentication)
const INTERNAL_USER_ID = 'system_user_v1';

/**
 * POST handler - Create new job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      niche, 
      targetZip, 
      targetCountry = 'US', 
      radiusKm, 
      maxBusinesses 
    } = body;

    // Validate required fields
    if (!niche || !targetZip || !radiusKm || !maxBusinesses) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields: niche, targetZip, radiusKm, maxBusinesses' 
        },
        { status: 400 }
      );
    }

    // Sanitize all inputs
    const sanitizedNiche = sanitizeNiche(niche);
    if (!sanitizedNiche) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid niche: must be 2-50 characters (letters, numbers, spaces, hyphens)' 
        },
        { status: 400 }
      );
    }

    const sanitizedZip = sanitizeLocationInput(targetZip);
    if (!sanitizedZip) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid targetZip: must be valid 5-digit ZIP or city name (2-100 chars)' 
        },
        { status: 400 }
      );
    }

    const sanitizedCountry = sanitizeCountryCode(targetCountry);
    const sanitizedRadius = sanitizeRadius(radiusKm);
    const sanitizedMax = sanitizeMaxBusinesses(maxBusinesses);

    // Create job document in Firestore
    const jobId = await createJob({
      userId: INTERNAL_USER_ID,
      status: 'draft',
      niche: sanitizedNiche,
      targetZip: sanitizedZip,
      targetCountry: sanitizedCountry,
      radiusKm: sanitizedRadius,
      maxBusinesses: sanitizedMax,
      stats: {
        found: 0,
        withWebsite: 0,
        withEmail: 0,
        sent: 0,
        bounced: 0,
        unsubscribed: 0,
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        jobId, 
        status: 'draft',
        message: 'Campaign created successfully. Cron will start processing automatically.' 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler - List all jobs (dashboard)
 */
export async function GET() {
  try {
    const jobs = await getAllJobs();
    
    return NextResponse.json({ 
      success: true, 
      jobs,
      count: jobs.length 
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
