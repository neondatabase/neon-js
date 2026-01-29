import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

// Server components using `auth` methods must be rendered dynamically
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { data: session } = await auth.getSession();

  if (session?.user) {
    // Check if user is admin
    if (session.user.role === 'admin') {
      redirect('/admin');
    } else {
      // Non-admin users should go to main app
      const mainAppUrl = process.env.MAIN_APP_URL || 'http://localhost:3000';
      redirect(mainAppUrl);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Admin Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Cross-subdomain authentication demo
          </p>
        </div>
        <div className="mt-8 space-y-4">
          <a
            href="/admin"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Go to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
