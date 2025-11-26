/**
 * Email Discovery Service (v1 - Simple Inference)
 * Generates likely contact emails from domain names
 * No scraping, no verification in v1
 */

import { Prospect, ProspectStatus } from '@/lib/types';
import { isUnsubscribed } from '../firebase/firestore';

// Common local business email patterns (in priority order)
const EMAIL_PATTERNS = [
  'info@{domain}',
  'contact@{domain}',
  'hello@{domain}',
  'admin@{domain}',
  'support@{domain}',
  'business@{domain}',
];

/**
 * Extract domain from full URL
 * Example: https://www.example.com/path -> example.com
 */
export function extractDomain(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    // Ensure protocol exists
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    
    // Remove www. and return clean domain
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

/**
 * Generate inferred email addresses for a domain
 */
export function generateInferredEmails(domain: string): string[] {
  return EMAIL_PATTERNS.map(pattern => pattern.replace('{domain}', domain));
}

/**
 * Discover email for a single prospect
 * Returns first non-unsubscribed email pattern
 */
export async function discoverEmailForProspect(
  prospect: Pick<Prospect, 'id' | 'website'>
): Promise<{
  discoveredEmail: string | null;
  status: ProspectStatus;
}> {
  // No website = can't find email
  if (!prospect.website) {
    return {
      discoveredEmail: null,
      status: 'no_website',
    };
  }

  // Extract domain
  const domain = extractDomain(prospect.website);
  if (!domain) {
    return {
      discoveredEmail: null,
      status: 'no_email',
    };
  }

  // Try each email pattern
  const candidateEmails = generateInferredEmails(domain);
  for (const email of candidateEmails) {
    const unsubscribed = await isUnsubscribed(email);
    if (!unsubscribed) {
      // Found a viable email
      return {
        discoveredEmail: email,
        status: 'email_found',
      };
    }
  }

  // All patterns are unsubscribed
  return {
    discoveredEmail: null,
    status: 'no_email',
  };
}

/**
 * Batch process emails for multiple prospects
 * Used by the cron job to discover emails in bulk
 */
export async function batchDiscoverEmails(
  prospects: Prospect[]
): Promise<Array<{
  prospectId: string;
  discoveredEmail: string | null;
  status: ProspectStatus;
}>> {
  const results = await Promise.all(
    prospects.map(async (prospect) => {
      const result = await discoverEmailForProspect(prospect);
      return {
        prospectId: prospect.id,
        discoveredEmail: result.discoveredEmail,
        status: result.status,
      };
    })
  );

  return results;
}
