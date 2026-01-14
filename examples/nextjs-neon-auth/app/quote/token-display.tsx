"use client"

import { useState } from "react"

export function TokenDisplay({ token }: { token: string }) {
  const [isVisible, setIsVisible] = useState(false)

  const maskedToken = `${token.substring(0, 7)}.......${token.substring(token.length - 7)}`

  return (
    <div className="mt-1 rounded-md bg-zinc-100 p-2 dark:bg-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all flex-1">
          {isVisible ? token : maskedToken}
        </p>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="shrink-0 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
          aria-label={isVisible ? "Hide token" : "Show token"}
        >
          {isVisible ? (
            <svg
              className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

