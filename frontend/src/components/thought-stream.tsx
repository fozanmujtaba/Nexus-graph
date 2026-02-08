'use client';

import { motion } from 'framer-motion';
import {
    Brain,
    Search,
    Database,
    GitBranch,
    CheckCircle,
    AlertCircle,
    Loader2,
    Sparkles,
    Shield,
} from 'lucide-react';

interface AgentStep {
    agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    thinking: string;
    output_summary: string;
    started_at?: string;
    completed_at?: string;
}

interface ThoughtStreamProps {
    steps: AgentStep[];
}

const agentConfig: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
    switchboard: { icon: Brain, color: 'text-primary-400', label: 'Switchboard' },
    librarian: { icon: Search, color: 'text-accent-400', label: 'Librarian' },
    analyst: { icon: Database, color: 'text-emerald-400', label: 'Analyst' },
    graph_explorer: { icon: GitBranch, color: 'text-violet-400', label: 'Graph Explorer' },
    critic: { icon: Shield, color: 'text-amber-400', label: 'Critic' },
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'completed':
            return <CheckCircle className="w-4 h-4 text-success" />;
        case 'failed':
            return <AlertCircle className="w-4 h-4 text-error" />;
        case 'running':
            return <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />;
        default:
            return <div className="w-4 h-4 rounded-full bg-surface-600" />;
    }
};

export function ThoughtStream({ steps }: ThoughtStreamProps) {
    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-surface-800">
                <div className="relative">
                    <Sparkles className="w-5 h-5 text-primary-400" />
                    <motion.div
                        className="absolute inset-0 bg-primary-400/30 blur-lg rounded-full"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-white">Agent Reasoning</h3>
                    <p className="text-xs text-surface-400">Watch the thought process</p>
                </div>
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    {steps.map((step, index) => {
                        const config = agentConfig[step.agent] || {
                            icon: Brain,
                            color: 'text-surface-400',
                            label: step.agent,
                        };
                        const Icon = config.icon;

                        return (
                            <motion.div
                                key={step.agent + index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`agent-status ${step.status}`}
                            >
                                {/* Status Line */}
                                {index < steps.length - 1 && (
                                    <div className="absolute left-7 top-14 w-0.5 h-[calc(100%-2rem)] bg-gradient-to-b from-surface-600 to-transparent" />
                                )}

                                {/* Icon */}
                                <div className={`relative p-2 rounded-lg bg-surface-800 ${config.color}`}>
                                    <Icon className="w-5 h-5" />
                                    {step.status === 'running' && (
                                        <motion.div
                                            className="absolute inset-0 rounded-lg bg-current opacity-30"
                                            animate={{ opacity: [0.1, 0.3, 0.1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-white">
                                            {config.label}
                                        </span>
                                        {getStatusIcon(step.status)}
                                    </div>

                                    {/* Thinking */}
                                    {step.thinking && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-xs text-surface-400 italic mb-2"
                                        >
                                            "{step.thinking}"
                                        </motion.p>
                                    )}

                                    {/* Output */}
                                    {step.output_summary && step.status === 'completed' && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="text-xs text-surface-300 bg-surface-800/50 rounded-lg px-3 py-2"
                                        >
                                            {step.output_summary}
                                        </motion.div>
                                    )}

                                    {/* Running Animation */}
                                    {step.status === 'running' && (
                                        <div className="flex items-center gap-1">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-1.5 h-1.5 rounded-full bg-primary-400"
                                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                                    transition={{
                                                        duration: 1,
                                                        repeat: Infinity,
                                                        delay: i * 0.2,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-surface-800">
                <div className="flex items-center justify-between text-xs text-surface-400">
                    <span>Agents active: {steps.filter((s) => s.status === 'running').length}</span>
                    <span>
                        Completed: {steps.filter((s) => s.status === 'completed').length}/{steps.length}
                    </span>
                </div>
            </div>
        </div>
    );
}
