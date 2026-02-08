'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    Sparkles,
    Upload,
    Settings,
    Search,
    Zap,
    Database,
    GitBranch,
    Brain,
    CheckCircle,
    AlertCircle,
    Loader2,
    Command,
    Plus,
    MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { ThoughtStream } from '@/components/thought-stream';
import { ChatMessage } from '@/components/chat-message';
import { CommandPalette } from '@/components/command-palette';
import { DataViewer } from '@/components/data-viewer';
import { Logo } from '@/components/logo';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    data?: {
        response_type: 'text' | 'table' | 'graph';
        content: any;
        metadata: Record<string, any>;
    };
    executionTrace?: AgentStep[];
    processingTime?: number;
}

interface AgentStep {
    agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    thinking: string;
    output_summary: string;
    started_at?: string;
    completed_at?: string;
}

export default function HomePage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [showDataViewer, setShowDataViewer] = useState(false);
    const [currentData, setCurrentData] = useState<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentSteps]);

    // Command palette shortcut
    useEffect(() => {
        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSubmit = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setCurrentSteps([]);

        try {
            // Use SSE for streaming updates
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    stream: true,
                }),
            });

            if (!response.ok) throw new Error('Failed to process request');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            let assistantContent = '';
            let responseData = null;
            let executionTrace: AgentStep[] = [];
            let processingTime = 0;

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            const eventType = line.replace('event:', '').trim();
                            continue;
                        }

                        if (line.startsWith('data:')) {
                            try {
                                const data = JSON.parse(line.replace('data:', '').trim());

                                if (data.agent) {
                                    // Step update
                                    setCurrentSteps((prev) => {
                                        const existing = prev.find((s) => s.agent === data.agent);
                                        if (existing) {
                                            return prev.map((s) =>
                                                s.agent === data.agent ? { ...s, ...data } : s
                                            );
                                        }
                                        return [...prev, data];
                                    });
                                    executionTrace.push(data);
                                }

                                if (data.content !== undefined) {
                                    // Message content
                                    assistantContent = data.content;
                                }

                                if (data.response_type) {
                                    // Data response
                                    responseData = data;
                                }

                                if (data.processing_time_ms) {
                                    processingTime = data.processing_time_ms;
                                }
                            } catch (e) {
                                // Ignore parse errors for SSE formatting
                            }
                        }
                    }
                }
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: assistantContent || 'I processed your request.',
                timestamp: new Date(),
                data: responseData,
                executionTrace,
                processingTime,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Show data viewer if we have structured data
            if (responseData && responseData.response_type !== 'text') {
                setCurrentData(responseData);
                setShowDataViewer(true);
            }

            toast.success('Response generated', {
                description: `Processed in ${(processingTime / 1000).toFixed(2)}s`,
            });
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to process request', {
                description: 'Please try again.',
            });
        } finally {
            setIsLoading(false);
            setCurrentSteps([]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 flex-shrink-0 border-r border-surface-800 bg-surface-950/50 backdrop-blur-xl">
                <div className="flex h-full flex-col">
                    {/* Logo */}
                    <div className="flex items-center gap-3 p-6 border-b border-surface-800">
                        <Logo />
                        <div>
                            <h1 className="text-lg font-bold gradient-text">Nexus-Graph</h1>
                            <p className="text-xs text-surface-400">Hybrid RAG Intelligence</p>
                        </div>
                    </div>

                    {/* New Chat Button */}
                    <div className="p-4">
                        <button
                            onClick={() => setMessages([])}
                            className="glass-button-primary w-full gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            New Conversation
                        </button>
                    </div>

                    {/* Recent Chats */}
                    <div className="flex-1 overflow-y-auto px-4">
                        <h3 className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-3">
                            Recent
                        </h3>
                        <div className="space-y-1">
                            {[1, 2, 3].map((i) => (
                                <motion.button
                                    key={i}
                                    whileHover={{ x: 4 }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-surface-300 hover:bg-white/5 transition-colors"
                                >
                                    <MessageSquare className="w-4 h-4 text-surface-500" />
                                    <span className="truncate">Conversation {i}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="p-4 border-t border-surface-800 space-y-2">
                        <button
                            onClick={() => setShowCommandPalette(true)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-surface-300 hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Search className="w-4 h-4" />
                                <span>Search</span>
                            </div>
                            <kbd className="px-2 py-0.5 rounded bg-surface-800 text-xs text-surface-400">
                                ⌘K
                            </kbd>
                        </button>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-surface-300 hover:bg-white/5 transition-colors">
                            <Upload className="w-4 h-4" />
                            <span>Upload Documents</span>
                        </button>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-surface-300 hover:bg-white/5 transition-colors">
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-950/30 backdrop-blur">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            <span className="text-sm text-surface-300">All systems operational</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800/50 text-xs text-surface-400">
                            <Database className="w-3 h-3" />
                            <span>PostgreSQL</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800/50 text-xs text-surface-400">
                            <GitBranch className="w-3 h-3" />
                            <span>Neo4j</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800/50 text-xs text-surface-400">
                            <Zap className="w-3 h-3" />
                            <span>Pinecone</span>
                        </div>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                            {messages.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center py-20"
                                >
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 mb-6">
                                        <Brain className="w-10 h-10 text-primary-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-3">
                                        Welcome to Nexus-Graph
                                    </h2>
                                    <p className="text-surface-400 max-w-md mx-auto mb-8">
                                        Ask questions about your documents, explore relationships, or query your data.
                                        I'll use the best approach to find your answer.
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {[
                                            'What are the key findings in my documents?',
                                            'Show me relationships between entities',
                                            'How many records match my criteria?',
                                        ].map((prompt, i) => (
                                            <motion.button
                                                key={i}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setInput(prompt)}
                                                className="glass-card px-4 py-2 text-sm text-surface-300 hover:text-white"
                                            >
                                                {prompt}
                                            </motion.button>
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <>
                                    <AnimatePresence>
                                        {messages.map((message) => (
                                            <ChatMessage
                                                key={message.id}
                                                message={message}
                                                onViewData={() => {
                                                    if (message.data) {
                                                        setCurrentData(message.data);
                                                        setShowDataViewer(true);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Thought Stream Sidebar (when loading) */}
                    <AnimatePresence>
                        {isLoading && currentSteps.length > 0 && (
                            <motion.aside
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 320, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="border-l border-surface-800 bg-surface-950/50 backdrop-blur-xl overflow-hidden"
                            >
                                <ThoughtStream steps={currentSteps} />
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="border-t border-surface-800 bg-surface-950/50 backdrop-blur-xl p-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative glass-card p-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask anything about your data..."
                                className="w-full px-4 py-3 bg-transparent text-white placeholder:text-surface-500 resize-none focus:outline-none"
                                rows={1}
                                disabled={isLoading}
                            />
                            <div className="absolute right-2 bottom-2 flex items-center gap-2">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!input.trim() || isLoading}
                                    className="glass-button-accent !p-2.5 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <p className="text-center text-xs text-surface-500 mt-2">
                            Nexus-Graph intelligently routes your query to the best data source
                        </p>
                    </div>
                </div>
            </main>

            {/* Command Palette */}
            <AnimatePresence>
                {showCommandPalette && (
                    <CommandPalette onClose={() => setShowCommandPalette(false)} />
                )}
            </AnimatePresence>

            {/* Data Viewer Modal */}
            <AnimatePresence>
                {showDataViewer && currentData && (
                    <DataViewer
                        data={currentData}
                        onClose={() => {
                            setShowDataViewer(false);
                            setCurrentData(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
