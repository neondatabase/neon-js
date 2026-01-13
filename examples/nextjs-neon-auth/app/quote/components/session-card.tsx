import Link from "next/link"
import { Button } from "@/components/ui/button"
import { neonAuth, } from "@neondatabase/auth/next"

export async function SessionCard() {
  const { session, user } = await neonAuth()
  const isLoggedIn = !!session && !!user

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Session Info
        </h2>
        <svg
          className="h-5 w-5 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Session Status</p>
          <div className="mt-1 flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isLoggedIn ? 'bg-green-500' : 'bg-orange-500'}`} />
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {isLoggedIn ? 'Active' : 'Not logged in'}
            </p>
          </div>
        </div>
        {isLoggedIn ? (
          <>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">User</p>
              <div className="mt-1 flex items-center gap-3">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name || 'User avatar'}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {user.name || 'Anonymous'}
                  </p>
                  {user.email && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Session Expires</p>
              <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
                {new Date(session.expiresAt).toLocaleString()}
              </p>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <Link href="/auth/sign-in">
              <Button size="sm" className="w-full">
                Sign In to See Session
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
