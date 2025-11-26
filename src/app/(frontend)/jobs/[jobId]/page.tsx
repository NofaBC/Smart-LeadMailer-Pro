/**
 * Job Detail Page
 * Shows campaign stats, prospects list, and status filters
 * Auto-refreshes to show live progress
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Prospect, Job, ProspectStatus } from '@/lib/types';

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  
  const [job, setJob] = useState<Job | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');

  // Fetch job details and prospects
  const fetchData = async () => {
    try {
      // Fetch job
      const jobRes = await fetch(`/api/jobs/${jobId}`);
      const jobData = await jobRes.json();
      
      if (!jobData.success) {
        throw new Error(jobData.error || 'Failed to fetch job');
      }
      
      setJob(jobData.job);

      // Fetch prospects with filter
      const filterParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
      const prospectsRes = await fetch(`/api/prospects?jobId=${jobId}${filterParam}`);
      const prospectsData = await prospectsRes.json();

      if (!prospectsData.success) {
        throw new Error(prospectsData.error || 'Failed to fetch prospects');
      }

      setProspects(prospectsData.prospects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + auto-refresh
  useEffect(() => {
    if (!jobId) return;
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [jobId, statusFilter]); // Refetch when filter changes

  const getStatusBadge = (status: ProspectStatus) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    const styles = {
      found: 'bg-gray-100 text-gray-700',
      no_website: 'bg-gray-200 text-gray-500',
      no_email: 'bg-yellow-100 text-yellow-700',
      email_found: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      bounced: 'bg-red-100 text-red-700',
      unsubscribed: 'bg-purple-100 text-purple-700',
    } as const;

    return <span className={`${baseClasses} ${styles[status]}`}>{status.replace('_', ' ')}</span>;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading campaign details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Not Found</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{job.niche}</h1>
            <p className="text-gray-600 mt-1">
              {job.targetZip}, {job.targetCountry} • {job.radiusKm}km radius • Max: {job.maxBusinesses}
            </p>
          </div>
          <Link
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Dashboard
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Found" value={job.stats.found} color="blue" />
          <StatCard label="With Email" value={job.stats.withEmail} color="green" />
          <StatCard label="Sent" value={job.stats.sent} color="yellow" />
          <StatCard label="Bounced" value={job.stats.bounced} color="red" />
          <StatCard label="Unsubscribed" value={job.stats.unsubscribed} color="purple" />
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProspectStatus | 'all')}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Prospects ({prospects.length})</option>
                <option value="found">Found</option>
                <option value="email_found">Email Found</option>
                <option value="sent">Sent</option>
                <option value="bounced">Bounced</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>
            <div className="text-sm text-gray-500">
              Auto-refreshes every 10 seconds
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Prospects Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {prospects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <p className="mb-2">No prospects found</p>
                    {statusFilter !== 'all' && (
                      <button
                        onClick={() => setStatusFilter('all')}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Clear filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                prospects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{prospect.name}</div>
                      {prospect.rating && (
                        <div className="text-sm text-gray-500">
                          ⭐ {prospect.rating} ({prospect.reviewCount} reviews)
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{prospect.address}</td>
                    <td className="px-6 py-4 text-sm">
                      {prospect.website ? (
                        <a
                          href={prospect.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {prospect.website.replace('https://', '').replace('http://', '')}
                        </a>
                      ) : (
                        <span className="text-gray-400">No website</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {prospect.discoveredEmail ? (
                        <span className="font-mono text-gray-900">{prospect.discoveredEmail}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(prospect.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatRelativeTime(prospect.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
    </div>
  );
}
