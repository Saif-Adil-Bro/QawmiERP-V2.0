import './globals.css'; 
import TopProgressBar from '@/components/TopProgressBar';
import ChunkErrorReloader from '@/components/ChunkErrorReloader';
import DynamicFavicon from '@/components/DynamicFavicon';
import { ThemeProvider } from '@/components/common/ThemeContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QawmiERP - কওমি মাদ্রাসা ম্যানেজমেন্ট সিস্টেম',
  description: 'SaaS-based Qawmi Madrasa Management System',
  icons: {
    icon: [
      { url: '/api/favicon', sizes: '32x32', type: 'image/png' },
      { url: '/api/favicon', sizes: '192x192', type: 'image/png' },
      { url: '/api/favicon', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/api/favicon',
    apple: [
      { url: '/api/favicon', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="bn" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Scheherazade+New:wght@400;500;600;700&family=Hind+Siliguri:wght@300;400;500;600;700&family=Noto+Naskh+Arabic:wght@400..700&family=Noto+Sans+Arabic:wght@100..900&display=swap"
                    rel="stylesheet"
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var t = localStorage.getItem('qawmi_theme');
                                    if (!t) {
                                        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                    }
                                    var r = document.documentElement;
                                    if (t === 'dark') {
                                        r.classList.add('theme-dark', 'dark');
                                        r.setAttribute('data-theme', 'dark');
                                    } else if (t === 'sepia') {
                                        r.classList.add('theme-sepia', 'sepia-mode');
                                        r.setAttribute('data-theme', 'sepia');
                                    } else {
                                        r.classList.add('theme-light');
                                        r.setAttribute('data-theme', 'light');
                                    }
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body suppressHydrationWarning>
                <ThemeProvider>
                    <ChunkErrorReloader />
                    <TopProgressBar />
                    <DynamicFavicon />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}


