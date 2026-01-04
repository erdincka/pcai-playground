"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    BookOpen,
    Clock,
    PlayCircle,
    TrendingUp,
    ArrowRight,
    Calendar,
    Target,
    Zap,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import UserProgress from "./UserProgress";
import { sessionsApi, labsApi } from "@/lib/api";

interface DashboardData {
    activeSessions: any[];
    recentActivity: any[]; // We'll just list recently completed labs from local storage if possible, or just skip
    recommendedLabs: any[];
    stats: {
        activeSessions: number;
        labsCompleted: number;
        hoursLearned: number; // Mocked for now
        currentStreak: number; // Mocked for now
    }
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Get Active Sessions
                const sessions = await sessionsApi.listMy();

                // 2. Get Completed Labs
                const completedIds = JSON.parse(localStorage.getItem("pcai_completed_labs") || "[]");

                // 3. Get All Labs to find details for completed & recommended
                const allLabs = await labsApi.list();

                // Process Data
                const completedLabs = allLabs.filter((l: any) => completedIds.includes(l.id));

                // Recommendations (Simple logic: Uncompleted labs where prereqs are met)
                const recommended = allLabs.filter((lab: any) => {
                    if (completedIds.includes(lab.id)) return false;
                    const prereqsMet = (lab.prerequisites || []).every((p: string) => completedIds.includes(p));
                    return prereqsMet;
                }).slice(0, 3);

                setData({
                    activeSessions: sessions,
                    recentActivity: completedLabs.slice(-3).reverse(), // Last 3 completed
                    recommendedLabs: recommended,
                    stats: {
                        activeSessions: sessions.length,
                        labsCompleted: completedIds.length,
                        hoursLearned: Math.round(completedIds.length * 0.75), // Approx 45 mins per lab
                        currentStreak: completedIds.length > 0 ? 1 : 0 // Simple streak logic
                    }
                });
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Welcome Header */}
            <div className="text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
                    Welcome back! <span className="text-hpe">Ready to learn?</span>
                </h1>
                <p className="text-xl text-muted max-w-2xl mx-auto">
                    Track your progress and continue mastering Kubernetes.
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                            <PlayCircle className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {data.stats.activeSessions}
                            </div>
                            <div className="text-sm text-muted">Active Sessions</div>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="text-green-600 dark:text-green-400" size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {data.stats.labsCompleted}
                            </div>
                            <div className="text-sm text-muted">Labs Completed</div>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                            <Clock className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {data.stats.hoursLearned}h
                            </div>
                            <div className="text-sm text-muted">Est. Time Invested</div>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                            <Zap className="text-orange-600 dark:text-orange-400" size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {data.stats.currentStreak}
                            </div>
                            <div className="text-sm text-muted">Day Streak</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Active Sessions - Priority Display */}
                    {data.activeSessions.length > 0 && (
                        <div className="card p-6 border-l-4 border-l-green-500">
                            <div className="flex items-center gap-2 mb-4">
                                <PlayCircle className="text-green-500" size={20} />
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Sessions</h2>
                            </div>
                            <div className="space-y-4">
                                {data.activeSessions.map(session => (
                                    <div key={session.session_uuid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{session.lab_id}</h3>
                                            <div className="flex items-center gap-3 text-sm text-muted mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    Expires: {new Date(session.expires_at).toLocaleTimeString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <AlertCircle size={14} />
                                                    {session.sandbox_namespace}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <a href={`/lab/${session.lab_id}?sessionId=${session.session_uuid}`} className="btn-primary px-4 py-2 text-sm">Resume Lab</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommended Labs */}
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Target className="text-hpe" size={20} />
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recommended for You</h2>
                        </div>

                        {data.recommendedLabs.length > 0 ? (
                            <div className="space-y-4">
                                {data.recommendedLabs.map((lab) => (
                                    <div key={lab.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-hpe/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-semibold text-slate-900 dark:text-white">{lab.title}</h3>
                                                    {lab.difficulty && (
                                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800">
                                                            {lab.difficulty}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted mb-3 line-clamp-2">{lab.description}</p>
                                                <div className="flex items-center gap-4 text-xs text-muted">
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {lab.duration}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <Link
                                                    href={`/labs?search=${lab.id}`} // Or direct to lab details/start
                                                    className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
                                                >
                                                    View Details
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted text-center py-8">No specific recommendations at this time. Browse the full catalog!</p>
                        )}

                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <Link
                                href="/labs"
                                className="text-hpe hover:text-hpe-dark font-semibold text-sm flex items-center gap-1"
                            >
                                Browse full catalog
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* User Progress Component */}
                    <UserProgress />

                    {/* Quick Actions */}
                    <div className="card p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <Link
                                href="/labs"
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <BookOpen size={20} className="text-hpe" />
                                <span className="font-medium text-slate-900 dark:text-white">Browse Labs</span>
                            </Link>
                            <Link
                                href="/my-sessions"
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <PlayCircle size={20} className="text-blue-500" />
                                <span className="font-medium text-slate-900 dark:text-white">My Sessions</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}