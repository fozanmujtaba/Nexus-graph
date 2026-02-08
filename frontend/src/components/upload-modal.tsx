'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    X,
    FileText,
    File,
    Image,
    Table,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    Loader2,
    Trash2,
    CloudUpload,
} from 'lucide-react';

interface UploadedFile {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    jobId?: string;
}

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete?: (files: UploadedFile[]) => void;
}

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

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const fileArray = Array.from(newFiles);
        const uploadFiles: UploadedFile[] = fileArray.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            status: 'pending',
            progress: 0,
        }));
        setFiles((prev) => [...prev, ...uploadFiles]);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                addFiles(e.dataTransfer.files);
            }
        },
        [addFiles]
    );

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                addFiles(e.target.files);
            }
        },
        [addFiles]
    );

    const removeFile = useCallback((id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const uploadFiles = useCallback(async () => {
        if (files.length === 0) return;

        setIsUploading(true);

        for (const uploadFile of files) {
            if (uploadFile.status !== 'pending') continue;

            // Update status to uploading
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
                )
            );

            try {
                const formData = new FormData();
                formData.append('file', uploadFile.file);

                const response = await fetch('/api/ingest/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const result = await response.json();

                // Update to processing
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadFile.id
                            ? { ...f, status: 'processing', progress: 50, jobId: result.job_id }
                            : f
                    )
                );

                // Simulate processing completion (in real app, poll for status)
                setTimeout(() => {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
                        )
                    );
                }, 2000);
            } catch (error) {
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadFile.id
                            ? { ...f, status: 'failed', error: 'Upload failed. Please try again.' }
                            : f
                    )
                );
            }
        }

        setIsUploading(false);

        // Notify parent of completion
        setTimeout(() => {
            onUploadComplete?.(files);
        }, 2500);
    }, [files, onUploadComplete]);

    const clearCompleted = useCallback(() => {
        setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
    }, []);

    const pendingCount = files.filter((f) => f.status === 'pending').length;
    const completedCount = files.filter((f) => f.status === 'completed').length;

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="glass-card w-full max-w-2xl max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent-500/20">
                            <CloudUpload className="w-5 h-5 text-accent-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Upload Documents</h2>
                            <p className="text-sm text-surface-400">
                                Upload PDFs, docs, or spreadsheets to query with AI
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-surface-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-surface-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
                    {/* Drop Zone */}
                    <div
                        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${dragActive
                                ? 'border-accent-500 bg-accent-500/10'
                                : 'border-surface-600 hover:border-surface-500'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.pptx"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <div className="text-center">
                            <motion.div
                                animate={{ y: dragActive ? -5 : 0 }}
                                className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-800 mb-4"
                            >
                                <Upload
                                    className={`w-7 h-7 transition-colors ${dragActive ? 'text-accent-400' : 'text-surface-400'
                                        }`}
                                />
                            </motion.div>
                            <p className="text-white font-medium mb-1">
                                Drop files here or{' '}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-accent-400 hover:text-accent-300 underline"
                                >
                                    browse
                                </button>
                            </p>
                            <p className="text-sm text-surface-400">
                                PDF, DOCX, XLSX, TXT, CSV (max 50MB each)
                            </p>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-white">
                                    Files ({files.length})
                                </h3>
                                {completedCount > 0 && (
                                    <button
                                        onClick={clearCompleted}
                                        className="text-xs text-surface-400 hover:text-white transition-colors"
                                    >
                                        Clear completed
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                <AnimatePresence>
                                    {files.map((uploadFile) => {
                                        const Icon = getFileIcon(uploadFile.file.name);
                                        return (
                                            <motion.div
                                                key={uploadFile.id}
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700"
                                            >
                                                <div
                                                    className={`p-2 rounded-lg ${uploadFile.status === 'completed'
                                                            ? 'bg-success/20 text-success'
                                                            : uploadFile.status === 'failed'
                                                                ? 'bg-error/20 text-error'
                                                                : 'bg-surface-700 text-accent-400'
                                                        }`}
                                                >
                                                    {uploadFile.status === 'completed' ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : uploadFile.status === 'failed' ? (
                                                        <AlertCircle className="w-4 h-4" />
                                                    ) : uploadFile.status === 'uploading' ||
                                                        uploadFile.status === 'processing' ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Icon className="w-4 h-4" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white truncate">
                                                        {uploadFile.file.name}
                                                    </p>
                                                    <p className="text-xs text-surface-400">
                                                        {formatFileSize(uploadFile.file.size)}
                                                        {uploadFile.status === 'uploading' && ' • Uploading...'}
                                                        {uploadFile.status === 'processing' && ' • Processing...'}
                                                        {uploadFile.status === 'completed' && ' • Ready to query'}
                                                        {uploadFile.status === 'failed' && ` • ${uploadFile.error}`}
                                                    </p>
                                                </div>

                                                {/* Progress bar */}
                                                {(uploadFile.status === 'uploading' ||
                                                    uploadFile.status === 'processing') && (
                                                        <div className="w-20 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${uploadFile.progress}%` }}
                                                            />
                                                        </div>
                                                    )}

                                                {uploadFile.status === 'pending' && (
                                                    <button
                                                        onClick={() => removeFile(uploadFile.id)}
                                                        className="p-1.5 rounded-lg hover:bg-surface-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-surface-400" />
                                                    </button>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-surface-700 bg-surface-900/50">
                    <p className="text-sm text-surface-400">
                        {pendingCount > 0
                            ? `${pendingCount} file${pendingCount > 1 ? 's' : ''} ready to upload`
                            : completedCount > 0
                                ? `${completedCount} file${completedCount > 1 ? 's' : ''} processed`
                                : 'No files selected'}
                    </p>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="glass-button">
                            Cancel
                        </button>
                        <button
                            onClick={uploadFiles}
                            disabled={pendingCount === 0 || isUploading}
                            className="glass-button-accent disabled:opacity-50"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
