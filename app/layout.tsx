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
      { url: '/api/favicon', type: 'image/png' },
      { url: '/api/favicon', type: 'image/svg+xml' },
    ],
    shortcut: '/api/favicon',
    apple: '/api/favicon',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="bn" suppressHydrationWarning>
            <head>
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


