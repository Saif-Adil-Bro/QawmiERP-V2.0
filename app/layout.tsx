import './globals.css'; 
import TopProgressBar from '@/components/TopProgressBar';

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="bn">
            <body suppressHydrationWarning>
                <TopProgressBar />
                {children}
            </body>
        </html>
    );
}



