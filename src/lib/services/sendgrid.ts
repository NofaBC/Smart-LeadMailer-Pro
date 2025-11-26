/**
 * SendGrid Email Service
 * Handles sending outreach emails with compliance headers
 * Updates prospect records with send/bounce status
 */

import sgMail from '@sendgrid/mail';
import { Prospect, ProspectStatus } from '@/lib/types';
import { updateProspectStatus } from '@/lib/firebase/firestore';

// Initialize SendGrid client
const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  throw new Error('SENDGRID_API_KEY is not configured');
}
sgMail.setApiKey(apiKey);

// Email template configuration
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Smart LeadMailer Pro';
const REPLY_TO_EMAIL = process.env.SENDGRID_REPLY_TO_EMAIL || 'your-email@yourdomain.com';

interface SendParams {
  prospect: Prospect;
  userName: string;
  userCompany?: string;
  userService?: string;
  jobId: string;
}

/**
 * Generate unsubscribe URL for a prospect
 */
function generateUnsubscribeUrl(prospectId: string, email: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const token = Buffer.from(`${prospectId}:${email}`).toString('base64'); // Simple token for v1
  return `${baseUrl}/api/unsubscribe?token=${token}`;
}

/**
 * Build email content with user-provided details
 */
function buildEmailContent(params: SendParams): { subject: string; html: string; text: string } {
  const { prospect, userName, userCompany, userService } = params;

  // Simple template - user can customize this in v2
  const subject = `Quick question about ${prospect.name}`;

  const html = `
    <p>Hi ${prospect.name} team,</p>

    <p>I'm ${userName}${userCompany ? ` from ${userCompany}` : ''}. I noticed your ${prospect.name} and wanted to reach out about ${userService || 'our services'}.</p>

    <p>Would you be open to a brief conversation about how we might help you grow your business?</p>

    <p>Best regards,<br/>
    ${userName}</p>

    <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
    <p style="font-size:12px;color:#666;">
      <a href="${generateUnsubscribeUrl(params.prospect.id, params.prospect.discoveredEmail || '')}">Unsubscribe</a> from future emails
    </p>
  `.trim();

  const text = `
Hi ${prospect.name} team,

I'm ${userName}${userCompany ? ` from ${userCompany}` : ''}. I noticed your ${prospect.name} and wanted to reach out about ${userService || 'our services'}.

Would you be open to a brief conversation about how we might help you grow your business?

Best regards,
${userName}

---
Unsubscribe: ${generateUnsubscribeUrl(params.prospect.id, params.prospect.discoveredEmail || '')}
  `.trim();

  return { subject, html, text };
}

/**
 * Send a single email to a prospect
 */
export async function sendEmailToProspect(params: SendParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!prospect.discoveredEmail) {
    return {
      success: false,
      error: 'No email address available for this prospect',
    };
  }

  const { subject, html, text } = buildEmailContent(params);

  const msg = {
    to: params.prospect.discoveredEmail,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: REPLY_TO_EMAIL,
    subject,
    html,
    text,
    headers: {
      // RFC 8058 compliant List-Unsubscribe header
      'List-Unsubscribe': `<${generateUnsubscribeUrl(params.prospect.id, params.prospect.discoveredEmail)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    customArgs: {
      jobId: params.jobId,
      prospectId: params.prospect.id,
    },
    trackingSettings: {
      clickTracking: { enable: false }, // Disable for compliance, enable if needed
      openTracking: { enable: true },
    },
  };

  try {
    const response = await sgMail.send(msg);
    const messageId = response[0].headers['x-message-id'];

    // Update prospect status in Firestore
    await updateProspectStatus(params.prospect.id, 'sent', {
      discoveredEmail: params.prospect.discoveredEmail,
      emailSource: 'inferred',
    });

    // Also update the message ID
    const { getFirestoreDb } = await import('@/lib/firebase/admin');
    await getFirestoreDb()
      .collection('prospects')
      .doc(params.prospect.id)
      .update({
        sendGridMessageId: messageId,
        sentAt: new Date(),
        updatedAt: new Date(),
      });

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    console.error(`Failed to send email to ${params.prospect.discoveredEmail}:`, error);

    // Mark as bounced if it's a permanent failure
    const isPermanentBounce = error?.response?.statusCode === 400 || error?.code === 400;
    if (isPermanentBounce) {
      await updateProspectStatus(params.prospect.id, 'bounced', {
        discoveredEmail: params.prospect.discoveredEmail,
        emailSource: 'inferred',
      });
      
      const { getFirestoreDb } = await import('@/lib/firebase/admin');
      await getFirestoreDb()
        .collection('prospects')
        .doc(params.prospect.id)
        .update({
          bouncedAt: new Date(),
          bounceReason: error.message?.substring(0, 500),
          updatedAt: new Date(),
        });
    }

    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Batch send emails to multiple prospects
 * Called by the cron job
 */
export async function batchSendEmails(
  prospects: Prospect[],
  jobId: string,
  userConfig: {
    userName: string;
    userCompany?: string;
    userService?: string;
  }
): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Send sequentially to avoid rate limiting (SendGrid allows 10 req/sec on free tier)
  for (const prospect of prospects) {
    const result = await sendEmailToProspect({
      prospect,
      jobId,
      userName: userConfig.userName,
      userCompany: userConfig.userCompany,
      userService: userConfig.userService,
    });

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push(`${prospect.name}: ${result.error}`);
    }

    // Small delay to respect rate limits (100ms = ~10 req/sec)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Handle SendGrid webhook events (delivered / bounce / unsubscribe)
 * This is called by /api/webhooks/sendgrid when SendGrid POSTs events
 */
export async function handleSendGridEvent(eventData: any): Promise<void> {
  const { email, event: eventType, sg_message_id, reason } = eventData;

  // Extract message ID (SendGrid format: "message-id.pid.user-id")
  const messageId = sg_message_id?.split('.')[0];

  if (!messageId || !email) {
    return; // Can't process without these
  }

  const { getFirestoreDb } = await import('@/lib/firebase/admin');
  const db = getFirestoreDb();

  // Find prospect by message ID
  const prospectSnap = await db
    .collection('prospects')
    .where('sendGridMessageId', '==', messageId)
    .limit(1)
    .get();

  if (prospectSnap.empty) {
    return; // Prospect not found
  }

  const prospectDoc = prospectSnap.docs[0];
  const prospectId = prospectDoc.id;

  // Update based on event type
  switch (eventType) {
    case 'bounce':
    case 'dropped':
      await updateProspectStatus(prospectId, 'bounced', {
        discoveredEmail: email,
        emailSource: 'inferred',
      });
      
      await prospectDoc.ref.update({
        bouncedAt: new Date(),
        bounceReason: reason?.substring(0, 500) || eventType,
        updatedAt: new Date(),
      });
      break;

    case 'unsubscribe':
      // Add to unsubscribe list
      const { addUnsubscribe } = await import('@/lib/firebase/firestore');
      await addUnsubscribe(email, prospectDoc.data().jobId);
      
      await updateProspectStatus(prospectId, 'unsubscribed', {
        discoveredEmail: email,
        emailSource: 'inferred',
      });
      
      await prospectDoc.ref.update({
        unsubscribedAt: new Date(),
        updatedAt: new Date(),
      });
      break;

    case 'delivered':
      // Already marked as sent, no action needed
      break;
  }
}
