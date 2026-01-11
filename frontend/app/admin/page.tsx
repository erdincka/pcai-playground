"use client";

import { useEffect, useState, Fragment } from "react";
import { adminApi, apiRequest } from "@/lib/api";
import { Users, Layout, Zap, Activity, Download, Globe, ChevronDown, ChevronUp, Trash2, Box, Layers, Database, Lock, Server } from "lucide-react";
import { toast } from "sonner";
import ConfirmationModal from "@/components/ConfirmationModal";

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [sessionResources, setSessionResources] = useState<Record<string, any>>({});
    const [terminatingId, setTerminatingId] = useState<string | null>(null);
    const [deletingResource, setDeletingResource] = useState<{ sessionId: string, kind: string, name: string } | null>(null);

    const loadData = async () => {
        try {
            const [s, sess] = await Promise.all([
                adminApi.getStats(),
                adminApi.listSessions()
            ]);
            setStats(s);
            setSessions(sess);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const handleTerminate = (id: string) => {
        setTerminatingId(id);
    };

    const onConfirmTerminate = async () => {
        if (!terminatingId) return;
        try {
            await adminApi.terminateSession(terminatingId);
            toast.success("Session terminated");
            loadData();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setTerminatingId(null);
        }
    };

    const toggleExpand = async (sessionId: string) => {
        if (expandedSession === sessionId) {
            setExpandedSession(null);
            return;
        }
        setExpandedSession(sessionId);
        if (!sessionResources[sessionId]) {
            loadResources(sessionId);
        }
    };

    const loadResources = async (sessionId: string) => {
        try {
            const res = await apiRequest(`/admin/sessions/${sessionId}/resources`);
            setSessionResources(prev => ({ ...prev, [sessionId]: res }));
        } catch (err) {
            toast.error("Failed to load resources");
        }
    };

    const deleteResource = (sessionId: string, kind: string, name: string) => {
        setDeletingResource({ sessionId, kind, name });
    };

    const onConfirmDeleteResource = async () => {
        if (!deletingResource) return;
        const { sessionId, kind, name } = deletingResource;
        try {
            await apiRequest(`/admin/sessions/${sessionId}/resources/${kind}/${name}`, { method: "DELETE" });
            toast.success(`Deleted ${kind} ${name}`);
            loadResources(sessionId);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete resource");
        } finally {
            setDeletingResource(null);
        }
    };

    const renderResourceList = (sessionId: string, kind: string, items: string[], icon: any) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                    {icon} {kind}s
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map(item => (
                        <div key={item} className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
                            <span className="truncate mr-2 font-mono">{item}</span>
                            <button 
                                onClick={() => deleteResource(sessionId, kind.toLowerCase().slice(0, -1), item)} // Remove 's' for kind
                                className="text-slate-400 hover:text-red-500 transition-colors"
                                title="Delete Resource"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading && !stats) return (
        <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hpe"></div>
        </div>
    );

    const activeSessions = sessions.filter(s => s.status === 'active');
    const inactiveSessions = sessions.filter(s => s.status !== 'active');

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="heading-1">Admin Dashboard</h1>
                    <p className="text-xl text-muted">Real-time monitoring and resource management.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold border border-emerald-100 dark:border-emerald-800">
                        <Globe size={16} />
                        System Online
                    </div>
                    <button onClick={() => { }} className="btn-secondary">
                        <Download size={18} />
                        Export Data
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="card p-8 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users size={120} />
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <Users size={28} />
                        </div>
                        <span className="text-sm font-bold text-muted uppercase tracking-widest">Active Users</span>
                    </div>
                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mb-2">{stats?.active_sessions}</div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <div className="h-1.5 w-1.5 rounded-full bg-hpe animate-pulse" />
                        Live concurrency
                    </div>
                </div>

                <div className="card p-8 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity size={120} />
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-hpe/10 text-hpe rounded-2xl">
                            <Layout size={28} />
                        </div>
                        <span className="text-sm font-bold text-muted uppercase tracking-widest">Total Labs</span>
                    </div>
                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mb-2">{stats?.total_sessions_all_time}</div>
                    <div className="text-sm text-muted">Completed sessions</div>
                </div>

                <div className="card p-8 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap size={120} />
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl">
                            <Zap size={28} />
                        </div>
                        <span className="text-sm font-bold text-muted uppercase tracking-widest">Utilization</span>
                    </div>
                    <div className="text-5xl font-extrabold text-slate-900 dark:text-white mb-4">{stats?.cluster_utilization_pct?.toFixed(1)}%</div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="bg-gradient-to-r from-amber-400 to-amber-600 h-full transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${stats?.cluster_utilization_pct}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* Active Sessions */}
                <div className="card overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="heading-3 mb-0">Active Lab Environments</h2>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-hpe/10 text-hpe uppercase tracking-widest">Live</span>
                        </div>
                        <div className="text-sm text-muted font-medium">
                            Refreshing every 10s
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">User Identity</th>
                                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Laboratory</th>
                                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Sandbox Namespace</th>
                                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Running Time</th>
                                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted text-right">Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {activeSessions.map((session) => (
                                <Fragment key={session.session_uuid}>
                                    <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer ${expandedSession === session.session_uuid ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`} onClick={() => toggleExpand(session.session_uuid)}>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-hpe border border-slate-200 dark:border-slate-700 group-hover:bg-hpe group-hover:text-white group-hover:border-hpe transition-all">
                                                        {session.user_id.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900 dark:text-white">{session.user_id}</span>
                                                        <div className="flex items-center gap-1 text-xs text-muted">
                                                            {expandedSession === session.session_uuid ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            {expandedSession === session.session_uuid ? "Hide Resources" : "View Resources"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm font-medium text-slate-700 dark:text-slate-300">{session.lab_id}</td>
                                            <td className="px-8 py-5">
                                                <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-muted">
                                                    {session.sandbox_namespace}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted font-medium">
                                                {Math.floor((new Date().getTime() - new Date(session.created_at).getTime()) / 60000)}m active
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTerminate(session.session_uuid);
                                                    }}
                                                    className="text-rose-600 hover:text-white hover:bg-rose-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border border-rose-200 dark:border-rose-900/50 transition-all"
                                                >
                                                    Terminate
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedSession === session.session_uuid && (
                                            <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                                <td colSpan={5} className="px-8 pb-8 pt-2">
                                                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h3 className="font-bold text-sm uppercase tracking-wide">Namespace Resources</h3>
                                                            <button 
                                                                onClick={() => loadResources(session.session_uuid)}
                                                                className="text-xs text-hpe hover:underline"
                                                            >
                                                                Refresh List
                                                            </button>
                                                        </div>
                                                        
                                                        {!sessionResources[session.session_uuid] ? (
                                                            <div className="flex justify-center py-4">
                                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-hpe"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {renderResourceList(session.session_uuid, "Pods", sessionResources[session.session_uuid].pods, <Box size={14} />)}
                                                                {renderResourceList(session.session_uuid, "Services", sessionResources[session.session_uuid].services, <Globe size={14} />)}
                                                                {renderResourceList(session.session_uuid, "Deployments", sessionResources[session.session_uuid].deployments, <Layers size={14} />)}
                                                                {renderResourceList(session.session_uuid, "PVCs", sessionResources[session.session_uuid].pvcs, <Database size={14} />)}
                                                                {renderResourceList(session.session_uuid, "Secrets", sessionResources[session.session_uuid].secrets, <Lock size={14} />)}
                                                                
                                                                {Object.values(sessionResources[session.session_uuid]).every((l: any) => l.length === 0) && (
                                                                    <p className="text-sm text-muted italic">No resources found in this namespace.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                                {activeSessions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Activity size={48} className="text-slate-200 dark:text-slate-800" />
                                                <p className="text-muted font-medium italic">No active laboratory sessions currently detected.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Terminated Sessions History */}
                {inactiveSessions.length > 0 && (
                    <div className="card overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
                        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <h2 className="heading-3 mb-0">Session History</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">User Identity</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Laboratory</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Namespace</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Status</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-muted">Started</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-muted">
                                    {inactiveSessions.map((session) => (
                                        <tr key={session.session_uuid}>
                                            <td className="px-8 py-4">{session.user_id}</td>
                                            <td className="px-8 py-4">{session.lab_id}</td>
                                            <td className="px-8 py-4 font-mono text-xs">{session.sandbox_namespace}</td>
                                            <td className="px-8 py-4">
                                                <span className="badge text-xs px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                    {session.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4">{new Date(session.created_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmationModal 
                isOpen={!!terminatingId}
                onClose={() => setTerminatingId(null)}
                onConfirm={onConfirmTerminate}
                title="Force Terminate Session"
                description="Are you sure you want to force terminate this session? This will delete the namespace and all associated resources immediately. This action cannot be undone."
                confirmText="Force Terminate"
                variant="danger"
            />

            <ConfirmationModal 
                isOpen={!!deletingResource}
                onClose={() => setDeletingResource(null)}
                onConfirm={onConfirmDeleteResource}
                title="Delete Resource"
                description={`Are you sure you want to delete the ${deletingResource?.kind} "${deletingResource?.name}"?`}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}