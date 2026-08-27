export const dynamic = "force-dynamic";

import type {Metadata} from 'next';
import { Suspense } from 'react';
import './globals.css'; 
import TopProgressBar from '@/components/TopProgressBar';

export const metadata: Metadata = {
    title: 'QawmiERP - Madrasa Management',
    description: 'SaaS-based Qawmi Madrasa Management System',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="en">
            <body suppressHydrationWarning>
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
            </body>
        </html>
    );
}
