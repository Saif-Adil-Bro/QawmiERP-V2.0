import './globals.css'; 
import TopProgressBar from '@/components/TopProgressBar';
import ChunkErrorReloader from '@/components/ChunkErrorReloader';
import DynamicFavicon from '@/components/DynamicFavicon';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QawmiERP - কওমি মাদ্রাসা ম্যানেজমেন্ট সিস্টেম',
  description: 'SaaS-based Qawmi Madrasa Management System',
  icons: {
    icon: [
      { url: '/api/favicon', type: 'image/png' },
      { url: '/api/favicon', type: 'image/svg+xml' },
    ],
    shortcut: '/api/favicon',
    apple: '/api/favicon',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="bn">
            <body suppressHydrationWarning>
                <ChunkErrorReloader />
                <TopProgressBar />
                <DynamicFavicon />
                {children}
            </body>
        </html>
    );
}

