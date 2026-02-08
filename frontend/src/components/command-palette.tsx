'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Search,
    FileText,
    Database,
    GitBranch,
    Upload,
    Settings,
    HelpCircle,
    Sparkles,
    ArrowRight,
    Command,
} from 'lucide-react';

interface CommandPaletteProps {
    onClose: () => void;
}

interface CommandItem {
    id: string;
    icon: React.ComponentType<any>;
    label: string;
    description: string;
    shortcut?: string;
    action: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const commands: CommandItem[] = [
        {
            id: 'search-docs',
            icon: Search,
            label: 'Search Documents',
            description: 'Find content across all uploaded documents',
            shortcut: '⌘F',
            action: () => console.log('Search docs'),
        },
        {
            id: 'upload',
            icon: Upload,
            label: 'Upload Document',
            description: 'Upload PDF, DOCX, or other files',
            shortcut: '⌘U',
            action: () => console.log('Upload'),
        },
        {
            id: 'query-sql',
            icon: Database,
            label: 'Query SQL Database',
            description: 'Run a direct SQL query',
            action: () => console.log('SQL query'),
        },
        {
            id: 'explore-graph',
            icon: GitBranch,
            label: 'Explore Graph',
            description: 'Visualize entity relationships',
            action: () => console.log('Explore graph'),
        },
        {
            id: 'view-docs',
            icon: FileText,
            label: 'View All Documents',
            description: 'Browse your document library',
            action: () => console.log('View docs'),
        },
        {
            id: 'ai-suggest',
            icon: Sparkles,
            label: 'AI Suggestions',
            description: 'Get AI-powered query suggestions',
            action: () => console.log('AI suggestions'),
        },
        {
            id: 'settings',
            icon: Settings,
            label: 'Settings',
            description: 'Configure Nexus-Graph',
            shortcut: '⌘,',
            action: () => console.log('Settings'),
        },
        {
            id: 'help',
            icon: HelpCircle,
            label: 'Help & Documentation',
            description: 'View guides and tutorials',
            shortcut: '⌘?',
            action: () => console.log('Help'),
        },
    ];

    const filteredCommands = commands.filter(
        (cmd) =>
            cmd.label.toLowerCase().includes(search.toLowerCase()) ||
            cmd.description.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < filteredCommands.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredCommands.length - 1
                );
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredCommands, selectedIndex, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="command-palette"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="command-palette-content"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-700">
                    <Search className="w-5 h-5 text-surface-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent text-white placeholder:text-surface-500 focus:outline-none"
                    />
                    <kbd className="px-2 py-1 rounded bg-surface-800 text-xs text-surface-400">
                        ESC
                    </kbd>
                </div>

                {/* Commands List */}
                <div className="max-h-[400px] overflow-y-auto py-2">
                    {filteredCommands.length === 0 ? (
                        <div className="px-4 py-8 text-center text-surface-400">
                            <p>No commands found</p>
                        </div>
                    ) : (
                        <div className="space-y-1 px-2">
                            {filteredCommands.map((command, index) => {
                                const Icon = command.icon;
                                const isSelected = index === selectedIndex;

                                return (
                                    <motion.button
                                        key={command.id}
                                        onClick={() => {
                                            command.action();
                                            onClose();
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${isSelected
                                                ? 'bg-primary-500/20 text-white'
                                                : 'text-surface-300 hover:bg-white/5'
                                            }`}
                                        whileHover={{ x: 4 }}
                                    >
                                        <div
                                            className={`p-2 rounded-lg ${isSelected ? 'bg-primary-500/20' : 'bg-surface-800'
                                                }`}
                                        >
                                            <Icon
                                                className={`w-4 h-4 ${isSelected ? 'text-primary-400' : 'text-surface-400'
                                                    }`}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{command.label}</p>
                                            <p className="text-xs text-surface-500 truncate">
                                                {command.description}
                                            </p>
                                        </div>
                                        {command.shortcut && (
                                            <kbd className="px-2 py-1 rounded bg-surface-800 text-xs text-surface-400">
                                                {command.shortcut}
                                            </kbd>
                                        )}
                                        {isSelected && (
                                            <ArrowRight className="w-4 h-4 text-primary-400" />
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700 text-xs text-surface-400">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-surface-800">↑</kbd>
                            <kbd className="px-1.5 py-0.5 rounded bg-surface-800">↓</kbd>
                            <span>Navigate</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-surface-800">↵</kbd>
                            <span>Select</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Command className="w-3 h-3" />
                        <span>Nexus-Graph</span>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
