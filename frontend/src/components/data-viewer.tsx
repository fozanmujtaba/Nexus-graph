'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    X,
    Download,
    Maximize2,
    Minimize2,
    Filter,
    Search,
    ChevronDown,
    ChevronUp,
    Table,
    Share2,
} from 'lucide-react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
    ColumnFiltersState,
} from '@tanstack/react-table';

interface DataViewerProps {
    data: {
        response_type: 'text' | 'table' | 'graph';
        content: any;
        metadata: Record<string, any>;
    };
    onClose: () => void;
}

export function DataViewer({ data, onClose }: DataViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

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
                className={`glass-card overflow-hidden ${isFullscreen ? 'w-full h-full' : 'w-full max-w-6xl max-h-[85vh]'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
                    <div className="flex items-center gap-3">
                        {data.response_type === 'table' ? (
                            <Table className="w-5 h-5 text-accent-400" />
                        ) : (
                            <Share2 className="w-5 h-5 text-violet-400" />
                        )}
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {data.response_type === 'table' ? 'Data Table' : 'Graph Visualization'}
                            </h2>
                            <p className="text-sm text-surface-400">
                                {data.response_type === 'table'
                                    ? `${data.content?.length || 0} rows`
                                    : 'Interactive relationship view'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="glass-button !p-2">
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="glass-button !p-2"
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                            ) : (
                                <Maximize2 className="w-4 h-4" />
                            )}
                        </button>
                        <button onClick={onClose} className="glass-button !p-2">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-auto max-h-[calc(85vh-80px)]">
                    {data.response_type === 'table' ? (
                        <DataTable data={data.content} />
                    ) : (
                        <GraphView data={data.content} />
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// Data Table Component
function DataTable({ data }: { data: any[] }) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 text-surface-400">
                <Table className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No data to display</p>
            </div>
        );
    }

    const columns = Object.keys(data[0]).map((key) => ({
        accessorKey: key,
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    }));

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        placeholder="Search in table..."
                        className="glass-input pl-10"
                    />
                </div>
                <button className="glass-button gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                </button>
            </div>

            {/* Table */}
            <div className="data-table overflow-x-auto">
                <table className="w-full">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        className="cursor-pointer hover:bg-surface-700/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {header.column.getIsSorted() === 'asc' && (
                                                <ChevronUp className="w-4 h-4" />
                                            )}
                                            {header.column.getIsSorted() === 'desc' && (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-surface-400">
                <span>
                    Showing {table.getRowModel().rows.length} of {data.length} rows
                </span>
            </div>
        </div>
    );
}

// Graph Visualization Component
function GraphView({ data }: { data: any }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!containerRef.current || !data) return;

        const initGraph = async () => {
            // Dynamic import for Cytoscape
            const cytoscape = (await import('cytoscape')).default;
            const coseBilkent = (await import('cytoscape-cose-bilkent')).default;

            cytoscape.use(coseBilkent);

            // Transform data to Cytoscape format
            const elements: any[] = [];

            // Add nodes
            if (data.nodes) {
                data.nodes.forEach((node: any) => {
                    elements.push({
                        group: 'nodes',
                        data: {
                            id: node.id,
                            label: node.properties?.name || node.labels?.[0] || 'Node',
                            type: node.labels?.[0] || 'default',
                        },
                    });
                });
            }

            // Add edges/relationships
            if (data.relationships) {
                data.relationships.forEach((rel: any) => {
                    elements.push({
                        group: 'edges',
                        data: {
                            id: rel.id,
                            source: rel.start_node,
                            target: rel.end_node,
                            label: rel.type,
                        },
                    });
                });
            }

            // Create Cytoscape instance
            const cy = cytoscape({
                container: containerRef.current,
                elements,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': '#5b7cf3',
                            label: 'data(label)',
                            color: '#ffffff',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'font-size': '12px',
                            'text-outline-width': 2,
                            'text-outline-color': '#1e2252',
                            width: 60,
                            height: 60,
                        },
                    },
                    {
                        selector: 'edge',
                        style: {
                            width: 2,
                            'line-color': '#3f3f46',
                            'target-arrow-color': '#3f3f46',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            label: 'data(label)',
                            'font-size': '10px',
                            color: '#71717a',
                            'text-rotation': 'autorotate',
                        },
                    },
                    {
                        selector: 'node:selected',
                        style: {
                            'background-color': '#06b6d4',
                            'border-width': 3,
                            'border-color': '#22d3ee',
                        },
                    },
                ],
                layout: {
                    name: 'cose-bilkent',
                    animate: true,
                    animationDuration: 1000,
                    nodeDimensionsIncludeLabels: true,
                    idealEdgeLength: 100,
                    nodeRepulsion: 8000,
                } as any,
            });

            setIsLoading(false);

            return () => {
                cy.destroy();
            };
        };

        initGraph();
    }, [data]);

    if (!data || (!data.nodes && !data.records)) {
        return (
            <div className="text-center py-12 text-surface-400">
                <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No graph data to display</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-900/50 backdrop-blur-sm z-10">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm text-surface-400">Rendering graph...</p>
                    </div>
                </div>
            )}
            <div ref={containerRef} className="graph-container" />
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-surface-400">
                <span>Drag to pan • Scroll to zoom • Click node to select</span>
            </div>
        </div>
    );
}
