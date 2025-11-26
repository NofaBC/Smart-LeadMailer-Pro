/**
 * Google Places API Service
 * Finds businesses by niche and location (ZIP/city + radius)
 * Uses the new Places API (v1) for text search
 */

import { Prospect } from '@/lib/types';

// Types for internal use in this service
export interface PlacesSearchParams {
  niche: string; // e.g., "acupuncture clinic"
  targetZip: string;
  targetCountry: string;
  radiusKm: number;
  maxBusinesses: number;
}

// Cleaned result before converting to Prospect
export interface PlacesBusiness {
  name: string;
  address: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  placeId: string;
}

// Geocoding response
interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Geocode ZIP/city to coordinates using Google Geocoding API
 */
async function geocodeLocation(zipOrCity: string, country: string): Promise<GeocodingResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const query = `${zipOrCity}, ${country}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status} for query "${query}"`);
  }

  const location = data.results[0].geometry.location;
  return {
    lat: location.lat,
    lng: location.lng,
    formattedAddress: data.results[0].formatted_address,
  };
}

/**
 * Convert radius in km to meters for Places API
 */
function radiusKmToMeters(radiusKm: number): number {
  return Math.min(Math.round(radiusKm * 1000), 50000); // Max 50,000m per Places API
}

/**
 * Search for businesses using Google Places API (New)
 * Uses text search for flexibility with niche keywords
 */
export async function searchBusinesses(params: PlacesSearchParams): Promise<PlacesBusiness[]> {
  const { niche, targetZip, targetCountry, radiusKm, maxBusinesses } = params;

  // 1. Geocode the location
  const location = await geocodeLocation(targetZip, targetCountry);
  
  // 2. Prepare Places API request
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';
  
  // Build search text - include location for better results
  const searchText = `${niche} near ${targetZip}, ${targetCountry}`;
  
  const requestBody = {
    textQuery: searchText,
    locationBias: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: radiusKmToMeters(radiusKm),
      },
    },
    pageSize: Math.min(maxBusinesses, 20), // 20 is max per request
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.id',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Places API error: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  
  if (!data.places || !Array.isArray(data.places)) {
    return [];
  }

  // 3. Map and clean results
  const businesses: PlacesBusiness[] = data.places.map((place: any) => ({
    name: place.displayName?.text || 'Unknown Business',
    address: place.formattedAddress || '',
    website: place.websiteUri ? cleanWebsiteUrl(place.websiteUri) : undefined,
    phone: place.nationalPhoneNumber || undefined,
    rating: place.rating || undefined,
    reviewCount: place.userRatingCount || undefined,
    placeId: place.id,
  }));

  // 4. Handle pagination if we need more results
  let allBusinesses = businesses;
  
  if (data.nextPageToken && allBusinesses.length < maxBusinesses) {
    const remaining = maxBusinesses - allBusinesses.length;
    const nextPageResults = await fetchNextPage(data.nextPageToken, remaining, apiKey);
    allBusinesses = [...allBusinesses, ...nextPageResults];
  }

  return allBusinesses.slice(0, maxBusinesses);
}

/**
 * Fetch next page of Places API results
 */
async function fetchNextPage(pageToken: string, maxBusinesses: number, apiKey: string): Promise<PlacesBusiness[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  
  const requestBody = {
    pageToken,
    pageSize: Math.min(maxBusinesses, 20),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.id',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  
  if (!data.places || !Array.isArray(data.places)) {
    return [];
  }

  return data.places.map((place: any) => ({
    name: place.displayName?.text || 'Unknown Business',
    address: place.formattedAddress || '',
    website: place.websiteUri ? cleanWebsiteUrl(place.websiteUri) : undefined,
    phone: place.nationalPhoneNumber || undefined,
    rating: place.rating || undefined,
    reviewCount: place.userRatingCount || undefined,
    placeId: place.id,
  }));
}

/**
 * Clean and validate website URL to domain root
 */
function cleanWebsiteUrl(url: string): string | undefined {
  if (!url) return undefined;
  
  try {
    // Ensure protocol
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    
    // Return root domain only (remove paths for v1 simplicity)
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch (e) {
    return undefined;
  }
}

/**
 * Main function: Get prospects from Places API
 * Returns data ready to be saved as Prospect documents
 */
export async function getProspectsFromPlaces(
  jobId: string,
  params: PlacesSearchParams
): Promise<Omit<Prospect, 'id' | 'status' | 'createdAt' | 'updatedAt'>[]> {
  const businesses = await searchBusinesses(params);
  
  return businesses.map(business => ({
    jobId,
    placeId: business.placeId,
    name: business.name,
    address: business.address,
    website: business.website,
    phone: business.phone,
    rating: business.rating,
    reviewCount: business.reviewCount,
    discoveredEmail: undefined, // Will be filled by emailDiscovery service
    emailSource: 'inferred',
    sendGridMessageId: undefined,
    sentAt: undefined,
    bouncedAt: undefined,
    bounceReason: undefined,
    unsubscribedAt: undefined,
  }));
}
