/**
 * New Campaign Form Page
 * Creates a new job via POST /api/jobs
 * Redirects to dashboard on success
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCampaign() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    niche: '',
    targetZip: '',
    targetCountry: 'US',
    radiusKm: 10,
    maxBusinesses: 20,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      setSuccess(true);
      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Create job error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'radiusKm' || name === 'maxBusinesses' ? parseInt(value, 10) || 0 : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Campaign</h1>
          <p className="text-gray-600 mt-1">Set up your outreach targeting</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            Campaign created successfully! Redirecting to dashboard...
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          {/* Niche */}
          <div>
            <label htmlFor="niche" className="block text-sm font-medium text-gray-700 mb-2">
              Business Type / Niche
            </label>
            <input
              type="text"
              id="niche"
              name="niche"
              required
              placeholder="e.g., acupuncture clinic"
              value={formData.niche}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Keywords to search for businesses (2-50 chars, letters/numbers/hyphens)
            </p>
          </div>

          {/* Target ZIP/City */}
          <div>
            <label htmlFor="targetZip" className="block text-sm font-medium text-gray-700 mb-2">
              Target ZIP Code or City
            </label>
            <input
              type="text"
              id="targetZip"
              name="targetZip"
              required
              placeholder="e.g., 90210 or Beverly Hills"
              value={formData.targetZip}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              5-digit US ZIP or city name
            </p>
          </div>

          {/* Country */}
          <div>
            <label htmlFor="targetCountry" className="block text-sm font-medium text-gray-700 mb-2">
              Country
            </label>
            <select
              id="targetCountry"
              name="targetCountry"
              value={formData.targetCountry}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="US">United States (US)</option>
              <option value="CA">Canada (CA)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="AU">Australia (AU)</option>
              <option value="DE">Germany (DE)</option>
              <option value="FR">France (FR)</option>
              <option value="ES">Spain (ES)</option>
              <option value="IT">Italy (IT)</option>
              <option value="JP">Japan (JP)</option>
              <option value="BR">Brazil (BR)</option>
              <option value="MX">Mexico (MX)</option>
              <option value="IN">India (IN)</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Radius */}
          <div>
            <label htmlFor="radiusKm" className="block text-sm font-medium text-gray-700 mb-2">
              Search Radius (km)
            </label>
            <input
              type="number"
              id="radiusKm"
              name="radiusKm"
              required
              min={1}
              max={50}
              value={formData.radiusKm}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max 50km (Google Places API limit)
            </p>
          </div>

          {/* Max Businesses */}
          <div>
            <label htmlFor="maxBusinesses" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Businesses to Target
            </label>
            <input
              type="number"
              id="maxBusinesses"
              name="maxBusinesses"
              required
              min={1}
              max={1000}
              value={formData.maxBusinesses}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Reasonable cap: 1-1000 businesses
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-between">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 font-medium text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating Campaign...' : 'Create Campaign'}
            </button>
          </div>
        </form>

        {/* How it works */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">How it works:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Campaign starts in "draft" status</li>
            <li>Cron finds businesses via Google Places (2 min)</li>
            <li>Infers emails from websites (info@domain.com)</li>
            <li>Sends emails via SendGrid in batches</li>
            <li>Track stats on the dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
