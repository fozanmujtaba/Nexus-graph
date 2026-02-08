const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface ChatRequest {
    message: string;
    conversation_id?: string;
    session_id?: string;
    stream?: boolean;
}

export interface ChatResponse {
    message: string;
    conversation_id: string;
    data?: {
        response_type: 'text' | 'table' | 'graph';
        content: any;
        metadata: Record<string, any>;
    };
    execution_trace: any[];
    sources: any[];
    processing_time_ms: number;
    validation?: {
        is_valid: boolean;
        faithfulness_score: number;
        relevancy_score: number;
        coherence_score: number;
        issues: string[];
        suggestions: string[];
    };
}

export interface IngestionResponse {
    job_id: string;
    status: string;
    message: string;
}

export interface IngestionJobStatus {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    filename: string;
    progress: number;
    chunks_processed: number;
    total_chunks: number;
    started_at?: string;
    completed_at?: string;
    error?: string;
}

class NexusAPI {
    private baseUrl: string;
    private wsUrl: string;

    constructor() {
        this.baseUrl = API_BASE_URL;
        this.wsUrl = WS_BASE_URL;
    }

    // Chat endpoints
    async chat(request: ChatRequest): Promise<ChatResponse> {
        const response = await fetch(`${this.baseUrl}/api/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Chat request failed: ${response.statusText}`);
        }

        return response.json();
    }

    async *chatStream(request: ChatRequest): AsyncGenerator<any> {
        const response = await fetch(`${this.baseUrl}/api/v1/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...request, stream: true }),
        });

        if (!response.ok) {
            throw new Error(`Stream request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const data = JSON.parse(line.slice(5).trim());
                        yield data;
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        }
    }

    createWebSocket(clientId: string): WebSocket {
        return new WebSocket(`${this.wsUrl}/api/v1/chat/ws/${clientId}`);
    }

    // Ingestion endpoints
    async uploadDocument(file: File): Promise<IngestionResponse> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/api/v1/ingest/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        return response.json();
    }

    async uploadDocuments(files: File[]): Promise<{ jobs: IngestionResponse[]; total_files: number }> {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));

        const response = await fetch(`${this.baseUrl}/api/v1/ingest/upload/bulk`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Bulk upload failed: ${response.statusText}`);
        }

        return response.json();
    }

    async getIngestionStatus(jobId: string): Promise<IngestionJobStatus> {
        const response = await fetch(`${this.baseUrl}/api/v1/ingest/status/${jobId}`);

        if (!response.ok) {
            throw new Error(`Status check failed: ${response.statusText}`);
        }

        return response.json();
    }

    async listIngestionJobs(status?: string, limit = 50): Promise<IngestionJobStatus[]> {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        params.append('limit', limit.toString());

        const response = await fetch(`${this.baseUrl}/api/v1/ingest/status?${params}`);

        if (!response.ok) {
            throw new Error(`List jobs failed: ${response.statusText}`);
        }

        return response.json();
    }

    // Health endpoints
    async getHealth(): Promise<{
        status: string;
        version: string;
        timestamp: string;
        services: Record<string, string>;
    }> {
        const response = await fetch(`${this.baseUrl}/api/v1/health`);

        if (!response.ok) {
            throw new Error(`Health check failed: ${response.statusText}`);
        }

        return response.json();
    }
}

// Export singleton instance
export const api = new NexusAPI();
