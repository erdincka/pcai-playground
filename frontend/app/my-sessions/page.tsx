"use client";

import { useEffect, useState } from "react";
import { sessionsApi, apiRequest } from "@/lib/api";
import { Clock, ExternalLink, Square, PlayCircle, AlertCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function MySessionsPage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const loadSessions = async () => {
        try {
            const data = await sessionsApi.listMy();
            setSessions(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const handleTerminate = async (id: string) => {
        if (!confirm("Are you sure you want to end this session?")) return;
        try {
            await sessionsApi.terminate(id);
            toast.success("Session ended");
            loadSessions();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleExtend = async (id: string) => {
        try {
            await sessionsApi.extend(id);
            toast.success("Session extended");
            loadSessions();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleRestart = async (labId: string) => {
        try {
            const loadingToast = toast.loading("Starting new session...");
            const session = await sessionsApi.create(labId);
            toast.dismiss(loadingToast);
            router.push(`/lab/${labId}?sessionId=${session.session_uuid}`);
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to start session");
        }
    };

    const activeSessions = sessions.filter(s => s.status === 'active');
    const historySessions = sessions.filter(s => s.status !== 'active');

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-12">
                <h1 className="heading-1">My Sessions</h1>
                <p className="text-xl text-muted">Manage and access your active playground environments.</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hpe"></div>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* Active Sessions */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold uppercase tracking-wider text-muted">Active Environments</h2>
                        {activeSessions.length === 0 ? (
                            <div className="card border-dashed p-12 text-center bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <PlayCircle size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No active sessions</h3>
                                <p className="text-muted mb-6 text-sm">Browse the catalog to start a new lab.</p>
                                <a href="/labs" className="btn-primary text-sm inline-flex">Explore Labs</a>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {activeSessions.map((session) => (
                                    <div key={session.session_uuid} className="card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                                        <div className="flex items-start gap-6">
                                            <div className="h-16 w-16 bg-hpe/10 rounded-2xl flex items-center justify-center text-hpe shrink-0 group-hover:scale-110 transition-transform">
                                                <ExternalLink size={32} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-hpe transition-colors">{session.lab_id}</h3>
                                                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        Active
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
                                                    <div className="flex items-center gap-2 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                        <AlertCircle size={14} />
                                                        {session.sandbox_namespace}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-hpe" />
                                                        Expires: {new Date(session.expires_at).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 border-t md:border-t-0 pt-6 md:pt-0">
                                            <a
                                                href={`/lab/${session.lab_id}?sessionId=${session.session_uuid}`}
                                                className="btn-primary px-8"
                                            >
                                                Open Lab
                                            </a>
                                            <button
                                                onClick={() => handleExtend(session.session_uuid)}
                                                className="btn-secondary p-2.5"
                                                title="Extend 1h"
                                            >
                                                <Clock size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleTerminate(session.session_uuid)}
                                                className="btn-secondary p-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                title="End Session"
                                            >
                                                <Square size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* History Sessions */}
                    {historySessions.length > 0 && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold uppercase tracking-wider text-muted">History</h2>
                            <div className="grid grid-cols-1 gap-4 opacity-75 hover:opacity-100 transition-opacity">
                                {historySessions.map((session) => (
                                    <div key={session.session_uuid} className="card p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 border-dashed">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                <Clock size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-slate-700 dark:text-slate-300">{session.lab_id}</h3>
                                                    <span className={`badge text-xs px-2 py-0.5 ${session.status === 'terminated' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-red-100 text-red-800'}`}>
                                                        {session.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted">
                                                    Started: {new Date(session.start_time).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}