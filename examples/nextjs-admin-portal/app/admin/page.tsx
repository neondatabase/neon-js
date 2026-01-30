import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { Users, Activity, Shield, LogOut, AlertCircle, ArrowRight } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { signOut } from '@/app/actions';
import Link from 'next/link';

// Server components using `auth` methods must be rendered dynamically
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect('/auth/sign-in');
  }

  const user = session.user;

  // Check if user is admin - show access denied page if not
  if (user.role !== 'admin') {
    const mainAppUrl = process.env.MAIN_APP_URL || 'http://localhost:3000';

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
              <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access the admin portal
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Current User
                </h2>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-white">
                    {user.name || user.email}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    {user.role || 'user'}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Required Permission
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  admin
                </span>
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Only users with the <strong>admin</strong> role can access this portal.
              If you believe you should have access, please contact your administrator.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href={mainAppUrl}
              className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Go to Main App
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>

            <form action={signOut} className="w-full">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Admin Portal
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Cross-subdomain authentication
                </p>
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Current User
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user.name || user.email}
                    </dd>
                    <dd className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {user.role || 'user'}
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Session Status
                    </dt>
                    <dd className="text-lg font-semibold text-green-600">
                      Active
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      User ID
                    </dt>
                    <dd className="text-sm font-mono text-gray-900 dark:text-white truncate">
                      {user.id}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Details */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Session Details
            </h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.email}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Name
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.name || 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Email Verified
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.emailVerified ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Not verified
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Created
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.createdAt
                    ? formatRelativeTime(user.createdAt)
                    : 'Unknown'}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Admin Actions
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/admin/users"
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    User Management
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Manage users and roles
                  </p>
                </div>
              </Link>

              <div className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-50 cursor-not-allowed">
                <div className="flex-shrink-0">
                  <Activity className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Activity Logs
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Coming soon
                  </p>
                </div>
              </div>

              <div className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-50 cursor-not-allowed">
                <div className="flex-shrink-0">
                  <Shield className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    System Settings
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Coming soon
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cookie Information */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Cross-Subdomain Authentication
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  This admin portal shares authentication cookies with the main
                  app when configured with the same cookie domain (e.g.,{' '}
                  <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                    .myapp.local
                  </code>
                  ).
                </p>
                <p className="mt-2">
                  If you signed in on the main app, you should see the same
                  session here without signing in again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
