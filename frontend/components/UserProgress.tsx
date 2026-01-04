"use client";

import { useEffect, useState } from "react";
import { Trophy, Target, BookOpen, Clock, CheckCircle, Lock, Star } from "lucide-react";
import { labsApi } from "@/lib/api";

interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    condition: (completedLabs: string[]) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
    {
        id: "first-lab",
        title: "Getting Started",
        description: "Complete your first lab",
        icon: "🎯",
        condition: (completed) => completed.length >= 1
    },
    {
        id: "novice",
        title: "Novice Engineer",
        description: "Complete 3 labs",
        icon: "🥉",
        condition: (completed) => completed.length >= 3
    },
    {
        id: "intermediate",
        title: "Intermediate Engineer",
        description: "Complete 5 labs",
        icon: "🥈",
        condition: (completed) => completed.length >= 5
    },
    {
        id: "expert",
        title: "Expert Engineer",
        description: "Complete 10 labs",
        icon: "🥇",
        condition: (completed) => completed.length >= 10
    },
    {
        id: "master",
        title: "K8s Master",
        description: "Complete all Foundation labs",
        icon: "👑",
        condition: (completed) => {
            // This is a rough check, ideally we check against actual lab categories
            // simplified for now to just check count or specific ids if we knew them
            return completed.some(id => id.startsWith("foundations-")) && completed.length >= 3;
        }
    }
];

export default function UserProgress() {
    const [completedLabs, setCompletedLabs] = useState<string[]>([]);
    const [allLabs, setAllLabs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load completed labs from local storage
                const saved = localStorage.getItem("pcai_completed_labs");
                const completed = saved ? JSON.parse(saved) : [];
                setCompletedLabs(completed);

                // Load all labs to calculate stats and recommendations
                const labs = await labsApi.list();
                setAllLabs(labs);
            } catch (err) {
                console.error("Failed to load progress data", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="card p-6 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
            </div>
        );
    }

    const totalLabs = allLabs.length;
    const completionPercentage = totalLabs > 0 ? (completedLabs.length / totalLabs) * 100 : 0;

    // Determine skill level
    let skillLevel = "Beginner";
    let skillColor = "text-green-600";
    let skillBg = "bg-green-100 dark:bg-green-900/30";

    if (completedLabs.length >= 10) {
        skillLevel = "Advanced";
        skillColor = "text-purple-600";
        skillBg = "bg-purple-100 dark:bg-purple-900/30";
    } else if (completedLabs.length >= 5) {
        skillLevel = "Intermediate";
        skillColor = "text-blue-600";
        skillBg = "bg-blue-100 dark:bg-blue-900/30";
    }

    // Find recommended labs (not completed, prerequisites met)
    const recommendedLabs = allLabs.filter(lab => {
        if (completedLabs.includes(lab.id)) return false;

        // Check prerequisites
        const prereqsMet = (lab.prerequisites || []).every((p: string) => completedLabs.includes(p));
        return prereqsMet;
    }).slice(0, 3);

    return (
        <div className="space-y-6">
            {/* Overall Progress Card */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your Learning Journey</h3>
                    <div className={`px-3 py-1 rounded-full ${skillBg} ${skillColor} text-xs font-bold`}>
                        {skillLevel}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm text-muted mb-2">
                            <span>Labs Completed</span>
                            <span>{completedLabs.length} / {totalLabs}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                            <div
                                className="bg-gradient-to-r from-hpe to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${completionPercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-hpe">{ACHIEVEMENTS.filter(a => a.condition(completedLabs)).length}</div>
                            <div className="text-xs text-muted">Achievements</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-hpe">{completedLabs.length}</div>
                            <div className="text-xs text-muted">Labs Done</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Achievements Section */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="text-yellow-500" size={20} />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Achievements</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ACHIEVEMENTS.map((achievement) => {
                        const unlocked = achievement.condition(completedLabs);
                        return (
                            <div
                                key={achievement.id}
                                className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${unlocked
                                    ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800"
                                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                                    }`}
                            >
                                <div className={`text-2xl shrink-0 ${!unlocked && "grayscale opacity-50"}`}>
                                    {unlocked ? achievement.icon : <Lock size={20} className="text-slate-400" />}
                                </div>
                                <div>
                                    <h4 className={`font-bold text-sm ${unlocked ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                                        {achievement.title}
                                    </h4>
                                    <p className={`text-xs ${unlocked ? "text-muted" : "text-slate-400 dark:text-slate-500"}`}>
                                        {achievement.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recommended Next Steps */}
            {recommendedLabs.length > 0 && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="text-hpe" size={20} />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recommended Next Steps</h3>
                    </div>

                    <div className="space-y-3">
                        {recommendedLabs.map((lab) => (
                            <div key={lab.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg group hover:border-hpe/50 transition-colors">
                                <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-700">
                                    <BookOpen size={18} className="text-hpe" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-hpe transition-colors">{lab.title}</h4>
                                    <p className="text-xs text-muted truncate">{lab.category} • {lab.duration}</p>
                                </div>
                                <a href={`/lab/${lab.id}?mode=preview`} className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap">
                                    View
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
