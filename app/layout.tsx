import './globals.css'; 

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="bn">
            <body suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}



