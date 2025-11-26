/**
 * GET /api/unsubscribe
 * Handles unsubscribe link clicks (RFC 8058 one-click unsubscribe)
 * Token format: base64url(prospectId:email)
 */

import { NextRequest, NextResponse } from 'next/server';
import { addUnsubscribe } from '@/lib/firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('Invalid unsubscribe link: missing token', { status: 400 });
  }

  try {
    // Decode token: base64url(prospectId:email)
    const decoded = decodeBase64Url(token);
    const [prospectId, email] = decoded.split(':');

    if (!prospectId || !email) {
      return new NextResponse('Invalid unsubscribe link: malformed token', { status: 400 });
    }

    // Get prospect data to verify
    const db = getFirestoreDb();
    const prospectDoc = await db.collection('prospects').doc(prospectId).get();

    if (!prospectDoc.exists) {
      // Still add to unsubscribe list even if prospect not found (safety)
      await addUnsubscribe(email);
      return generateConfirmationPage(email);
    }

    const prospect = prospectDoc.data() as any;

    // Verify email matches (security check)
    if (prospect.discoveredEmail !== email) {
      return new NextResponse('Invalid unsubscribe link: email mismatch', { status: 400 });
    }

    // Add to unsubscribe list
    await addUnsubscribe(email, prospect.jobId);

    // Update prospect status to unsubscribed
    await prospectDoc.ref.update({
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    });

    return generateConfirmationPage(email);

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new NextResponse('An error occurred processing your unsubscribe request', { status: 500 });
  }
}

/**
 * Decode base64url token to UTF-8 string
 * Compatible with all Node.js versions
 */
function decodeBase64Url(token: string): string {
  // Replace URL-safe chars with standard base64 chars
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Generate simple HTML confirmation page
 */
function generateConfirmationPage(email: string): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Unsubscribed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          h1 { color: #2563eb; }
          p { color: #666; line-height: 1.6; }
          .container { border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Unsubscribed Successfully</h1>
          <p>You've been unsubscribed from future emails to <strong>${escapeHtml(email)}</strong>.</p>
          <p>No further emails will be sent to this address.</p>
        </div>
      </body>
    </html>
  `.trim();

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Simple HTML escape for confirmation page
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
