'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { api, ChatRequest, ChatResponse } from '@/lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    data?: any;
    executionTrace?: any[];
    processingTime?: number;
}

interface AgentStep {
    agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    thinking: string;
    output_summary: string;
}

interface UseChatOptions {
    onStepUpdate?: (step: AgentStep) => void;
    onError?: (error: Error) => void;
}

export function useChat(options: UseChatOptions = {}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const sendMessage = useCallback(
        async (content: string) => {
            if (!content.trim() || isLoading) return;

            // Add user message
            const userMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: content.trim(),
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);
            setCurrentSteps([]);

            try {
                let assistantContent = '';
                let responseData = null;
                let executionTrace: AgentStep[] = [];
                let processingTime = 0;
                let newConversationId = conversationId;

                // Use streaming API
                for await (const chunk of api.chatStream({
                    message: content,
                    conversation_id: conversationId || undefined,
                    stream: true,
                })) {
                    // Handle different event types
                    if (chunk.conversation_id && !newConversationId) {
                        newConversationId = chunk.conversation_id;
                        setConversationId(newConversationId);
                    }

                    if (chunk.agent) {
                        // Step update
                        setCurrentSteps((prev) => {
                            const existing = prev.find((s) => s.agent === chunk.agent);
                            if (existing) {
                                return prev.map((s) =>
                                    s.agent === chunk.agent ? { ...s, ...chunk } : s
                                );
                            }
                            return [...prev, chunk];
                        });
                        executionTrace.push(chunk);
                        options.onStepUpdate?.(chunk);
                    }

                    if (chunk.content !== undefined) {
                        assistantContent = chunk.content;
                    }

                    if (chunk.response_type) {
                        responseData = chunk;
                    }

                    if (chunk.processing_time_ms) {
                        processingTime = chunk.processing_time_ms;
                    }
                }

                // Add assistant message
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
            } catch (error) {
                const err = error instanceof Error ? error : new Error('Unknown error');
                options.onError?.(err);
                throw err;
            } finally {
                setIsLoading(false);
                setCurrentSteps([]);
            }
        },
        [isLoading, conversationId, options]
    );

    const clearMessages = useCallback(() => {
        setMessages([]);
        setConversationId(null);
        setCurrentSteps([]);
    }, []);

    const abort = useCallback(() => {
        abortControllerRef.current?.abort();
        setIsLoading(false);
        setCurrentSteps([]);
    }, []);

    return {
        messages,
        isLoading,
        currentSteps,
        conversationId,
        sendMessage,
        clearMessages,
        abort,
    };
}

export function useWebSocketChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const clientIdRef = useRef<string>('');

    useEffect(() => {
        // Generate client ID
        clientIdRef.current = Math.random().toString(36).substring(2, 11);

        // Create WebSocket connection
        const ws = api.createWebSocket(clientIdRef.current);

        ws.onopen = () => {
            setIsConnected(true);
        };

        ws.onclose = () => {
            setIsConnected(false);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'ack':
                        // Acknowledgment received
                        break;

                    case 'step':
                        setCurrentSteps((prev) => {
                            const existing = prev.find((s) => s.agent === data.data.agent);
                            if (existing) {
                                return prev.map((s) =>
                                    s.agent === data.data.agent ? { ...s, ...data.data } : s
                                );
                            }
                            return [...prev, data.data];
                        });
                        break;

                    case 'response':
                        const assistantMessage: Message = {
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: data.data.message,
                            timestamp: new Date(),
                            data: data.data.data,
                            processingTime: data.data.processing_time_ms,
                        };
                        setMessages((prev) => [...prev, assistantMessage]);
                        setIsLoading(false);
                        setCurrentSteps([]);
                        break;

                    case 'error':
                        console.error('WebSocket error:', data.data.message);
                        setIsLoading(false);
                        setCurrentSteps([]);
                        break;
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        wsRef.current = ws;

        return () => {
            ws.close();
        };
    }, []);

    const sendMessage = useCallback(
        (content: string, conversationId?: string) => {
            if (!content.trim() || isLoading || !wsRef.current) return;

            // Add user message
            const userMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: content.trim(),
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);
            setCurrentSteps([]);

            // Send via WebSocket
            wsRef.current.send(
                JSON.stringify({
                    message: content,
                    conversation_id: conversationId,
                })
            );
        },
        [isLoading]
    );

    const clearMessages = useCallback(() => {
        setMessages([]);
        setCurrentSteps([]);
    }, []);

    return {
        messages,
        isConnected,
        isLoading,
        currentSteps,
        sendMessage,
        clearMessages,
    };
}
