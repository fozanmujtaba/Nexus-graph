'use client';

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Clock, ExternalLink, Table, GitBranch } from 'lucide-react';

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
    executionTrace?: any[];
    processingTime?: number;
}

interface ChatMessageProps {
    message: Message;
    onViewData?: () => void;
}

export function ChatMessage({ message, onViewData }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
        >
            {/* Avatar */}
            <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isUser
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'bg-accent-500/20 text-accent-400'
                    }`}
            >
                {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
                <div className={`message-bubble ${message.role}`}>
                    {/* Markdown Content */}
                    <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown
                            components={{
                                code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isInline = !match;

                                    if (isInline) {
                                        return (
                                            <code
                                                className="px-1.5 py-0.5 rounded bg-surface-700 text-accent-300 text-xs"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }

                                    return (
                                        <div className="code-block my-3">
                                            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700">
                                                <span className="text-xs text-surface-400">{match[1]}</span>
                                            </div>
                                            <pre className="p-4 overflow-x-auto text-sm">
                                                <code>{children}</code>
                                            </pre>
                                        </div>
                                    );
                                },
                                a({ href, children }) {
                                    return (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent-400 hover:text-accent-300 inline-flex items-center gap-1"
                                        >
                                            {children}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    );
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>

                    {/* Data Preview Button */}
                    {message.data && message.data.response_type !== 'text' && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onViewData}
                            className="mt-4 w-full flex items-center justify-between p-3 rounded-xl bg-surface-800/50 hover:bg-surface-700/50 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                {message.data.response_type === 'table' ? (
                                    <Table className="w-5 h-5 text-accent-400" />
                                ) : (
                                    <GitBranch className="w-5 h-5 text-violet-400" />
                                )}
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white">
                                        {message.data.response_type === 'table'
                                            ? 'View Data Table'
                                            : 'View Graph Visualization'}
                                    </p>
                                    <p className="text-xs text-surface-400">
                                        {message.data.response_type === 'table'
                                            ? `${message.data.content?.length || 0} rows`
                                            : 'Interactive graph view'}
                                    </p>
                                </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-surface-400 group-hover:text-white transition-colors" />
                        </motion.button>
                    )}
                </div>

                {/* Timestamp & Processing Time */}
                <div
                    className={`flex items-center gap-2 mt-2 text-xs text-surface-500 ${isUser ? 'justify-end' : 'justify-start'
                        }`}
                >
                    <Clock className="w-3 h-3" />
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {message.processingTime && (
                        <>
                            <span>•</span>
                            <span>{(message.processingTime / 1000).toFixed(2)}s</span>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
