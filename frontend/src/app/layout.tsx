import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
    title: 'Nexus-Graph | Hybrid RAG Intelligence',
    description:
        'A next-generation Hybrid-Graph RAG System combining the power of graph databases, vector search, and intelligent agent orchestration.',
    keywords: [
        'RAG',
        'LLM',
        'Graph Database',
        'Vector Search',
        'AI',
        'Knowledge Base',
    ],
    authors: [{ name: 'Nexus Team' }],
    openGraph: {
        title: 'Nexus-Graph',
        description: 'Hybrid-Graph RAG Intelligence',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-gradient-mesh">
                {children}
                <Toaster
                    position="bottom-right"
                    toastOptions={{
                        className: 'glass-card !bg-surface-900/90 !border-surface-700',
                        descriptionClassName: 'text-surface-400',
                    }}
                />
            </body>
        </html>
    );
}
