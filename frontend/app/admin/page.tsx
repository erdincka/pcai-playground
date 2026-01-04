"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Users, Layout, Zap, Activity, Download, Globe } from "lucide-react";

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleTerminate = async (id: string) => {
        if (!confirm("Force terminate this session?")) return;
        try {
            await adminApi.terminateSession(id);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading && !stats) return (
        <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hpe"></div>
        </div>
    );

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
                            {sessions.map((session) => (
                                <tr key={session.session_uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-hpe border border-slate-200 dark:border-slate-700 group-hover:bg-hpe group-hover:text-white group-hover:border-hpe transition-all">
                                                {session.user_id.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-semibold text-slate-900 dark:text-white">{session.user_id}</span>
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
                                            onClick={() => handleTerminate(session.session_uuid)}
                                            className="text-rose-600 hover:text-white hover:bg-rose-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border border-rose-200 dark:border-rose-900/50 transition-all"
                                        >
                                            Terminate
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {sessions.length === 0 && (
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
        </div>
    );
}
