/**
 * Dashboard Page
 * Lists all campaign jobs with stats and status
 * Auto-refreshes to show progress as cron processes
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { JobDashboardResponse } from '@/lib/types';

export default function Dashboard() {
  const [jobs, setJobs] = useState<JobDashboardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs on mount and every 10 seconds
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch jobs');
      }

      setJobs(data.jobs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Fetch jobs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-medium';
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      prospecting: 'bg-blue-100 text-blue-700',
      discovering: 'bg-purple-100 text-purple-700',
      sending: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    } as const;

    return <span className={`${baseClasses} ${styles[status as keyof typeof styles]}`}>{status}</span>;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Smart LeadMailer Pro™</h1>
            <p className="text-gray-600 mt-1">Campaign Dashboard</p>
          </div>
          <Link
            href="/jobs/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Campaign
          </Link>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Jobs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <p className="mb-4">No campaigns yet</p>
                    <Link
                      href="/jobs/new"
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Create your first campaign →
                    </Link>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{job.niche}</div>
                      <div className="text-sm text-gray-500">Max: {job.maxBusinesses} businesses</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {job.targetZip}, {job.targetCountry}
                      <div className="text-gray-500">Radius: {job.radiusKm}km</div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="space-y-1">
                        <div className="text-gray-900">
                          <span className="font-medium">{job.stats.found}</span> found
                        </div>
                        <div className="text-gray-500">
                          <span className="font-medium">{job.stats.withEmail}</span> with email
                        </div>
                        <div className="text-gray-500">
                          <span className="font-medium">{job.stats.sent}</span> sent
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Auto-refreshes every 10 seconds • Cron processes jobs every 2 minutes
        </div>
      </div>
    </div>
  );
}
