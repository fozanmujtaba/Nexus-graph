'use client';

import { useState, useCallback } from 'react';
import { api, IngestionJobStatus } from '@/lib/api';

interface UseIngestionOptions {
    onUploadComplete?: (jobId: string) => void;
    onProcessingComplete?: (status: IngestionJobStatus) => void;
    onError?: (error: Error) => void;
    pollInterval?: number;
}

export function useIngestion(options: UseIngestionOptions = {}) {
    const [jobs, setJobs] = useState<Map<string, IngestionJobStatus>>(new Map());
    const [isUploading, setIsUploading] = useState(false);

    const uploadFile = useCallback(
        async (file: File) => {
            setIsUploading(true);

            try {
                const response = await api.uploadDocument(file);

                // Add job to tracking
                setJobs((prev) => {
                    const next = new Map(prev);
                    next.set(response.job_id, {
                        job_id: response.job_id,
                        status: 'pending',
                        filename: file.name,
                        progress: 0,
                        chunks_processed: 0,
                        total_chunks: 0,
                    });
                    return next;
                });

                options.onUploadComplete?.(response.job_id);

                // Start polling for status
                pollJobStatus(response.job_id);

                return response;
            } catch (error) {
                const err = error instanceof Error ? error : new Error('Upload failed');
                options.onError?.(err);
                throw err;
            } finally {
                setIsUploading(false);
            }
        },
        [options]
    );

    const uploadFiles = useCallback(
        async (files: File[]) => {
            setIsUploading(true);

            try {
                const response = await api.uploadDocuments(files);

                // Add jobs to tracking
                for (const job of response.jobs) {
                    if (job.job_id) {
                        const file = files.find((f) => job.message.includes(f.name));
                        setJobs((prev) => {
                            const next = new Map(prev);
                            next.set(job.job_id, {
                                job_id: job.job_id,
                                status: 'pending',
                                filename: file?.name || 'Unknown',
                                progress: 0,
                                chunks_processed: 0,
                                total_chunks: 0,
                            });
                            return next;
                        });

                        // Start polling for each job
                        pollJobStatus(job.job_id);
                    }
                }

                return response;
            } catch (error) {
                const err = error instanceof Error ? error : new Error('Upload failed');
                options.onError?.(err);
                throw err;
            } finally {
                setIsUploading(false);
            }
        },
        [options]
    );

    const pollJobStatus = useCallback(
        async (jobId: string) => {
            const interval = options.pollInterval || 2000;

            const poll = async () => {
                try {
                    const status = await api.getIngestionStatus(jobId);

                    setJobs((prev) => {
                        const next = new Map(prev);
                        next.set(jobId, status);
                        return next;
                    });

                    if (status.status === 'completed') {
                        options.onProcessingComplete?.(status);
                        return;
                    }

                    if (status.status === 'failed') {
                        options.onError?.(new Error(status.error || 'Processing failed'));
                        return;
                    }

                    // Continue polling
                    setTimeout(poll, interval);
                } catch (error) {
                    const err = error instanceof Error ? error : new Error('Status check failed');
                    options.onError?.(err);
                }
            };

            poll();
        },
        [options]
    );

    const getJobStatus = useCallback(
        (jobId: string) => {
            return jobs.get(jobId);
        },
        [jobs]
    );

    const clearJobs = useCallback(() => {
        setJobs(new Map());
    }, []);

    return {
        jobs: Array.from(jobs.values()),
        isUploading,
        uploadFile,
        uploadFiles,
        getJobStatus,
        clearJobs,
    };
}
