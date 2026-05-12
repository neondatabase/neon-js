import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Neon Auth - Phone Login Example',
  description: 'Phone number authentication with Neon Auth',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <Providers>
          <nav className="border-b border-border px-6 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <a href="/" className="text-lg font-semibold text-foreground">
                Phone Login Demo
              </a>
              <div className="flex gap-4 text-sm">
                <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
                <a href="/webhooks" className="text-muted-foreground hover:text-foreground transition-colors">Webhooks</a>
              </div>
            </div>
          </nav>
          <main className="max-w-4xl mx-auto px-6 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
