/**
 * Validation & Sanitization Utilities
 * Keeps inputs clean and safe before hitting APIs or Firestore
 */

/**
 * Validate US ZIP code or city string
 * Allows: 5-digit ZIP, ZIP+4 (12345-6789), or city names
 */
export function sanitizeLocationInput(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  // Trim whitespace
  const cleaned = input.trim();

  // Check for US ZIP code (5 digits or ZIP+4 format)
  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (zipRegex.test(cleaned)) {
    return cleaned;
  }

  // For city names: limit length, remove dangerous characters
  if (cleaned.length >= 2 && cleaned.length <= 100) {
    // Remove special characters but keep spaces, commas, hyphens
    const sanitized = cleaned.replace(/[^\w\s,.'-]/g, '');
    return sanitized.trim();
  }

  return null;
}

/**
 * Extract and validate domain from any URL string
 * Returns clean domain (e.g., example.com) or null
 */
export function extractDomain(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    // Add protocol if missing
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    
    // Clean: lowercase, remove www, remove port numbers
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    // Basic validation: must have TLD
    if (domain.includes('.') && domain.split('.').pop()?.length >= 2) {
      return domain;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Clean website URL to root domain format
 * Example: https://www.example.com/path -> https://example.com
 */
export function cleanWebsiteUrl(url: string): string | undefined {
  if (!url) return undefined;

  const domain = extractDomain(url);
  if (!domain) return undefined;

  return `https://${domain}`;
}

/**
 * Sanitize business niche search term
 * Removes dangerous characters, limits length
 */
export function sanitizeNiche(niche: string): string | null {
  if (!niche || typeof niche !== 'string') return null;

  const cleaned = niche.trim();
  
  if (cleaned.length < 2 || cleaned.length > 50) return null;

  // Remove special characters but keep letters, numbers, spaces, hyphens
  const sanitized = cleaned.replace(/[^\w\s-]/g, '');
  
  return sanitized.trim();
}

/**
 * Validate and normalize ISO 2-letter country code
 * Returns uppercase code or defaults to 'US'
 */
export function sanitizeCountryCode(country: string): string {
  if (!country || typeof country !== 'string') return 'US';

  const cleaned = country.trim().toUpperCase();
  
  // Simple regex for 2-letter codes (full validation would need a list)
  const isValid = /^[A-Z]{2}$/.test(cleaned);
  
  return isValid ? cleaned : 'US';
}

/**
 * Sanitize business name for email templates
 * Limits length and removes problematic characters
 */
export function sanitizeBusinessName(name: string): string {
  if (!name || typeof name !== 'string') return 'Business';

  const cleaned = name.trim();
  
  // Limit to 100 chars
  if (cleaned.length > 100) {
    return cleaned.substring(0, 97) + '...';
  }

  // Remove HTML/script tags and special characters that could break templates
  const sanitized = cleaned.replace(/<[^>]*>/g, '').replace(/["\\]/g, '');
  
  return sanitized || 'Business';
}

/**
 * Validate radius (1-50 km, respecting Places API limits)
 */
export function sanitizeRadius(radiusKm: number): number {
  const radius = Number(radiusKm);
  if (isNaN(radius) || radius < 1) return 5; // Default to 5km
  if (radius > 50) return 50; // Max 50km
  return Math.round(radius);
}

/**
 * Validate max businesses (1-1000, prevent abuse)
 */
export function sanitizeMaxBusinesses(max: number): number {
  const maxNum = Number(max);
  if (isNaN(maxNum) || maxNum < 1) return 10; // Default to 10
  if (maxNum > 1000) return 1000; // Reasonable cap
  return Math.round(maxNum);
}

/**
 * Escape user input for safe use in email templates (prevent XSS)
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}
