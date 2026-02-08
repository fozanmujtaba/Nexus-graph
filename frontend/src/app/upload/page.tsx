'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    FileText,
    CheckCircle,
    AlertCircle,
    Loader2,
    X,
    ArrowLeft,
    File,
    Image,
    Table,
    FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useIngestion } from '@/hooks/use-ingestion';
import { Logo } from '@/components/logo';

const fileTypeIcons: Record<string, React.ComponentType<any>> = {
    pdf: FileText,
    doc: FileText,
    docx: FileText,
    txt: FileText,
    md: FileText,
    xlsx: FileSpreadsheet,
    xls: FileSpreadsheet,
    csv: Table,
    png: Image,
    jpg: Image,
    jpeg: Image,
};

const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return fileTypeIcons[ext] || File;
};

export default function UploadPage() {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const { jobs, isUploading, uploadFiles } = useIngestion({
        onUploadComplete: (jobId) => {
            toast.success('Upload started', {
                description: `Processing document (Job: ${jobId.slice(0, 8)}...)`,
            });
        },
        onProcessingComplete: (status) => {
            toast.success('Processing complete', {
                description: `${status.filename}: ${status.chunks_processed} chunks created`,
            });
        },
        onError: (error) => {
            toast.error('Error', { description: error.message });
        },
    });

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = Array.from(e.dataTransfer.files);
        setSelectedFiles((prev) => [...prev, ...files]);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        setSelectedFiles((prev) => [...prev, ...files]);
    }, []);

    const removeFile = useCallback((index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleUpload = useCallback(async () => {
        if (selectedFiles.length === 0) return;

        try {
            await uploadFiles(selectedFiles);
            setSelectedFiles([]);
        } catch (error) {
            // Error handled by hook
        }
    }, [selectedFiles, uploadFiles]);

    return (
        <div className="min-h-screen bg-gradient-mesh">
            {/* Header */}
            <header className="border-b border-surface-800 bg-surface-950/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <Logo />
                            <h1 className="text-lg font-bold gradient-text">Nexus-Graph</h1>
                        </Link>
                    </div>
                    <Link href="/" className="glass-button gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Chat
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Title */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 mb-6"
                    >
                        <Upload className="w-8 h-8 text-primary-400" />
                    </motion.div>
                    <h1 className="text-3xl font-bold text-white mb-3">Upload Documents</h1>
                    <p className="text-surface-400 max-w-md mx-auto">
                        Upload PDFs, Word documents, spreadsheets, and more. Our AI will process
                        and index them for intelligent retrieval.
                    </p>
                </div>

                {/* Drop Zone */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={`relative glass-card p-8 mb-8 transition-all duration-300 ${dragActive
                            ? 'border-primary-500 bg-primary-500/10 shadow-glow'
                            : 'border-surface-700'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        id="file-upload"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    <div className="text-center">
                        <motion.div
                            animate={{ y: dragActive ? -5 : 0 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-800 mb-4"
                        >
                            <Upload
                                className={`w-8 h-8 transition-colors ${dragActive ? 'text-primary-400' : 'text-surface-400'
                                    }`}
                            />
                        </motion.div>
                        <p className="text-white font-medium mb-2">
                            Drop files here or click to browse
                        </p>
                        <p className="text-sm text-surface-400">
                            Supports PDF, DOCX, XLSX, TXT, MD, and more (max 100MB each)
                        </p>
                    </div>
                </motion.div>

                {/* Selected Files */}
                <AnimatePresence>
                    {selectedFiles.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-8"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-white">
                                    Selected Files ({selectedFiles.length})
                                </h3>
                                <button
                                    onClick={() => setSelectedFiles([])}
                                    className="text-sm text-surface-400 hover:text-white transition-colors"
                                >
                                    Clear all
                                </button>
                            </div>
                            <div className="space-y-2">
                                {selectedFiles.map((file, index) => {
                                    const Icon = getFileIcon(file.name);
                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700"
                                        >
                                            <div className="p-2 rounded-lg bg-surface-700">
                                                <Icon className="w-4 h-4 text-accent-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white truncate">{file.name}</p>
                                                <p className="text-xs text-surface-400">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="p-1.5 rounded-lg hover:bg-surface-600 transition-colors"
                                            >
                                                <X className="w-4 h-4 text-surface-400" />
                                            </button>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="glass-button-primary w-full mt-4"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Processing Jobs */}
                {jobs.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <h3 className="text-sm font-medium text-white mb-4">Processing Jobs</h3>
                        <div className="space-y-3">
                            {jobs.map((job) => {
                                const Icon = getFileIcon(job.filename);
                                const isComplete = job.status === 'completed';
                                const isFailed = job.status === 'failed';
                                const isProcessing = job.status === 'processing';

                                return (
                                    <div
                                        key={job.job_id}
                                        className={`glass-card p-4 ${isComplete
                                                ? 'border-success/30'
                                                : isFailed
                                                    ? 'border-error/30'
                                                    : 'border-surface-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`p-2 rounded-lg ${isComplete
                                                        ? 'bg-success/20 text-success'
                                                        : isFailed
                                                            ? 'bg-error/20 text-error'
                                                            : 'bg-surface-700 text-accent-400'
                                                    }`}
                                            >
                                                {isComplete ? (
                                                    <CheckCircle className="w-5 h-5" />
                                                ) : isFailed ? (
                                                    <AlertCircle className="w-5 h-5" />
                                                ) : isProcessing ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <Icon className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {job.filename}
                                                </p>
                                                <p className="text-xs text-surface-400">
                                                    {isComplete
                                                        ? `${job.chunks_processed} chunks created`
                                                        : isFailed
                                                            ? job.error || 'Processing failed'
                                                            : isProcessing
                                                                ? 'Processing...'
                                                                : 'Pending...'}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${isComplete
                                                        ? 'bg-success/20 text-success'
                                                        : isFailed
                                                            ? 'bg-error/20 text-error'
                                                            : 'bg-surface-700 text-surface-300'
                                                    }`}
                                            >
                                                {job.status}
                                            </span>
                                        </div>

                                        {isProcessing && (
                                            <div className="mt-3">
                                                <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${job.progress * 100}%` }}
                                                        transition={{ duration: 0.3 }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Supported Formats */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-12 text-center"
                >
                    <h3 className="text-sm font-medium text-surface-400 mb-4">
                        Supported Formats
                    </h3>
                    <div className="flex flex-wrap justify-center gap-2">
                        {['PDF', 'DOCX', 'PPTX', 'XLSX', 'TXT', 'MD', 'CSV'].map((format) => (
                            <span
                                key={format}
                                className="px-3 py-1.5 rounded-lg bg-surface-800/50 text-xs text-surface-300 border border-surface-700"
                            >
                                {format}
                            </span>
                        ))}
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
