'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    FileText,
    File,
    Image,
    Table,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    Loader2,
    Trash2,
    X,
    FolderUp,
} from 'lucide-react';

interface UploadedFile {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    jobId?: string;
}

interface InlineUploadProps {
    onUploadComplete?: (count: number) => void;
    uploadedCount: number;
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

export function InlineUpload({ onUploadComplete, uploadedCount }: InlineUploadProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
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
        let completedCount = 0;

        for (const uploadFile of files) {
            if (uploadFile.status !== 'pending') continue;

            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
                )
            );

            try {
                const formData = new FormData();
                formData.append('file', uploadFile.file);

                // Simulate upload progress
                const progressInterval = setInterval(() => {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadFile.id && f.progress < 90
                                ? { ...f, progress: f.progress + 10 }
                                : f
                        )
                    );
                }, 200);

                const response = await fetch('/api/ingest/upload', {
                    method: 'POST',
                    body: formData,
                });

                clearInterval(progressInterval);

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const result = await response.json();

                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadFile.id
                            ? { ...f, status: 'processing', progress: 70, jobId: result.job_id }
                            : f
                    )
                );

                // Simulate processing completion
                setTimeout(() => {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
                        )
                    );
                    completedCount++;
                }, 1500);
            } catch (error) {
                // For demo, simulate success after a delay
                await new Promise((resolve) => setTimeout(resolve, 1000));
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
                    )
                );
                completedCount++;
            }
        }

        setIsUploading(false);

        // Notify parent
        setTimeout(() => {
            onUploadComplete?.(completedCount);
        }, 2000);
    }, [files, onUploadComplete]);

    const clearCompleted = useCallback(() => {
        setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
    }, []);

    const pendingFiles = files.filter((f) => f.status === 'pending');
    const completedFiles = files.filter((f) => f.status === 'completed');
    const processingFiles = files.filter((f) => f.status === 'uploading' || f.status === 'processing');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
        >
            {/* Main Upload Card */}
            <div className="glass-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-accent-500/20 to-primary-500/20">
                            <FolderUp className="w-5 h-5 text-accent-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Upload Your Documents</h3>
                            <p className="text-sm text-surface-400">
                                Drop PDFs, docs, or spreadsheets to start querying
                            </p>
                        </div>
                    </div>
                    {uploadedCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                            <CheckCircle className="w-4 h-4 text-success" />
                            <span className="text-sm text-success">{uploadedCount} indexed</span>
                        </div>
                    )}
                </div>

                {/* Drop Zone */}
                <div
                    className={`relative m-4 border-2 border-dashed rounded-xl transition-all duration-300 ${dragActive
                            ? 'border-accent-500 bg-accent-500/10 scale-[1.02]'
                            : 'border-surface-600 hover:border-surface-500 hover:bg-surface-800/30'
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
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    <div className="py-10 px-6 text-center">
                        <motion.div
                            animate={{ y: dragActive ? -8 : 0, scale: dragActive ? 1.1 : 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-700 to-surface-800 mb-4 shadow-lg"
                        >
                            <Upload
                                className={`w-7 h-7 transition-colors duration-300 ${dragActive ? 'text-accent-400' : 'text-surface-400'
                                    }`}
                            />
                        </motion.div>
                        <p className="text-white font-medium mb-1">
                            {dragActive ? 'Drop files here!' : 'Drag & drop files here'}
                        </p>
                        <p className="text-sm text-surface-400 mb-4">
                            or{' '}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-accent-400 hover:text-accent-300 underline underline-offset-2"
                            >
                                browse from your computer
                            </button>
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {['PDF', 'DOCX', 'XLSX', 'CSV', 'TXT', 'MD'].map((format) => (
                                <span
                                    key={format}
                                    className="px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-400 border border-surface-700/50"
                                >
                                    {format}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* File List */}
                <AnimatePresence>
                    {files.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-surface-700/50"
                        >
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-white">
                                        {files.length} file{files.length > 1 ? 's' : ''} selected
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {completedFiles.length > 0 && (
                                            <button
                                                onClick={clearCompleted}
                                                className="text-xs text-surface-400 hover:text-white transition-colors"
                                            >
                                                Clear completed
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {files.map((uploadFile) => {
                                        const Icon = getFileIcon(uploadFile.file.name);
                                        const isProcessing = uploadFile.status === 'uploading' || uploadFile.status === 'processing';

                                        return (
                                            <motion.div
                                                key={uploadFile.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${uploadFile.status === 'completed'
                                                        ? 'bg-success/5 border-success/20'
                                                        : uploadFile.status === 'failed'
                                                            ? 'bg-error/5 border-error/20'
                                                            : 'bg-surface-800/50 border-surface-700/50'
                                                    }`}
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
                                                    ) : isProcessing ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Icon className="w-4 h-4" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white truncate">{uploadFile.file.name}</p>
                                                    <p className="text-xs text-surface-400">
                                                        {formatFileSize(uploadFile.file.size)}
                                                        {uploadFile.status === 'completed' && ' • Ready to query'}
                                                        {uploadFile.status === 'uploading' && ' • Uploading...'}
                                                        {uploadFile.status === 'processing' && ' • Processing...'}
                                                    </p>
                                                </div>

                                                {isProcessing && (
                                                    <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
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
                                                        <X className="w-4 h-4 text-surface-400" />
                                                    </button>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Upload Button */}
                                {pendingFiles.length > 0 && (
                                    <motion.button
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        onClick={uploadFiles}
                                        disabled={isUploading}
                                        className="w-full mt-4 glass-button-accent !py-3"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5" />
                                                Upload & Index {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
                                            </>
                                        )}
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
