import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NeonAuthUIProvider, UserButton } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Org Todos",
  description: "Multi-tenant todo app with Neon Auth organizations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
        <NeonAuthUIProvider
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          authClient={authClient as any}
          redirectTo="/dashboard"
          emailOTP
        >
          <header className="flex items-center justify-between border-b px-6 h-14">
            <Link href="/dashboard" className="font-semibold text-lg">
              Todos
            </Link>
            <div className="flex items-center gap-3">
              <UserButton size="icon" />
            </div>
          </header>
          <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <Toaster />
        </NeonAuthUIProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
