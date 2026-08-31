import './globals.css'; 
import TopProgressBar from '@/components/TopProgressBar';
import ChunkErrorReloader from '@/components/ChunkErrorReloader';

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="bn">
            <body suppressHydrationWarning>
                <ChunkErrorReloader />
                <TopProgressBar />
                {children}
            </body>
        </html>
    );
}
