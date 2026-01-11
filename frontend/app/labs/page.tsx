"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { labsApi, sessionsApi } from "@/lib/api";
import {
    BookOpen,
    Clock,
    BarChart,
    Search,
    Sparkles,
    Filter,
    Target,
    CheckCircle2,
    Check
} from "lucide-react";
import { toast } from "sonner";

interface UIHints {
    showShell: boolean;
    showEditor: boolean;
    requiresPCAIUI: boolean;
}

interface Lab {
    id: string;
    title: string;
    description: string;
    persona: string[];
    category: string;
    duration: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    skills: string[];
    prerequisites: string[];
    tags: string[];
    ui_hints: UIHints;
    // Optional/Mock fields if backend doesn't provide them yet
    rating?: number;
}

function LabsPageContent() {
    const searchParams = useSearchParams();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [loading, setLoading] = useState(true);
    const [persona, setPersona] = useState("all");
    const [category, setCategory] = useState("all");
    const [difficulty, setDifficulty] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [completedLabs, setCompletedLabs] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                // Load completed labs from local storage
                const saved = localStorage.getItem("pcai_completed_labs");
                if (saved) {
                    setCompletedLabs(JSON.parse(saved));
                }

                // Load labs from API
                const data = await labsApi.list();
                setLabs(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Sync search query from URL
    useEffect(() => {
        const search = searchParams.get("search");
        if (search) {
            setSearchQuery(search);
        }
    }, [searchParams]);

    const startLab = async (labId: string) => {
        try {
            const loadingToast = toast.loading("Starting lab...");
            await sessionsApi.create(labId);
            toast.dismiss(loadingToast);
            window.location.href = "/my-sessions";
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to start lab session");
        }
    };

    const toggleCompletion = (e: React.MouseEvent, labId: string) => {
        e.stopPropagation();
        let newCompleted;
        if (completedLabs.includes(labId)) {
            newCompleted = completedLabs.filter(id => id !== labId);
        } else {
            newCompleted = [...completedLabs, labId];
        }
        setCompletedLabs(newCompleted);
        localStorage.setItem("pcai_completed_labs", JSON.stringify(newCompleted));
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty?.toLowerCase()) {
            case "beginner":
                return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
            case "intermediate":
                return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
            case "advanced":
                return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
            default:
                return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400";
        }
    };

    const isRecommended = (lab: Lab) => {
        if (completedLabs.includes(lab.id)) return false;

        const hasPrerequisites = (lab.prerequisites || []).every(prereq =>
            completedLabs.includes(prereq)
        );

        return hasPrerequisites;
    };

    const filteredLabs = labs.filter(lab => {
        const matchesPersona = persona === "all" || lab.persona.includes(persona);
        const matchesCategory = category === "all" || lab.category === category;
        const matchesDifficulty = difficulty === "all" || lab.difficulty === difficulty;
        const matchesSearch = searchQuery === "" ||
            lab.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lab.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (lab.skills || []).some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesPersona && matchesCategory && matchesDifficulty && matchesSearch;
    });

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-8">
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-96 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1">
            {/* Enhanced Hero Section */}
            <div className="bg-gradient-to-br from-hpe/5 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/20 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-hpe/10 text-hpe text-sm font-bold uppercase tracking-wider mb-6">
                            <Sparkles size={16} />
                            Interactive Learning Platform
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
                            Master <span className="text-transparent bg-clip-text bg-gradient-to-r from-hpe to-purple-600">Kubernetes</span>
                            <br className="hidden sm:block" /> with Confidence
                        </h1>
                        <p className="text-xl text-muted max-w-3xl mx-auto mb-8">
                            Personalized learning paths designed for your role and skill level.
                            Progress through hands-on labs with real-world scenarios.
                        </p>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-hpe">{labs.length}</div>
                                <div className="text-sm text-muted">Total Labs</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-hpe">{completedLabs.length}</div>
                                <div className="text-sm text-muted">Completed</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-hpe">
                                    {labs.filter(lab => isRecommended(lab)).length}
                                </div>
                                <div className="text-sm text-muted">Recommended</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Enhanced Search and Filters */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
                    <div className="flex flex-col lg:flex-row gap-4 items-center">
                        {/* Search Bar */}
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search labs, skills, or technologies..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-hpe focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Filter Toggle (Mobile) */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="lg:hidden flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Filter size={20} />
                            Filters
                        </button>

                        {/* Desktop Filters */}
                        <div className={`flex gap-4 w-full lg:w-auto ${showFilters ? 'block' : 'hidden lg:flex'}`}>
                            <select
                                className="input-field min-w-[140px]"
                                value={persona}
                                onChange={(e) => setPersona(e.target.value)}
                            >
                                <option value="all">All Roles</option>
                                <option value="data-scientist">Data Scientist</option>
                                <option value="platform-admin">Platform Admin</option>
                                <option value="mlops-engineer">MLOps Engineer</option>
                            </select>

                            <select
                                className="input-field min-w-[140px]"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="all">All Categories</option>
                                <option value="Foundations">Foundations</option>
                                <option value="Kubernetes platform">K8s Platform</option>
                                <option value="Platform services">Platform Services</option>
                                <option value="Data & AI">Data & AI</option>
                            </select>

                            <select
                                className="input-field min-w-[140px]"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                            >
                                <option value="all">All Levels</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Summary */}
                <div className="flex items-center justify-between mb-8">
                    <div className="text-muted">
                        Showing {filteredLabs.length} of {labs.length} labs
                        <span className="ml-2 text-hpe font-medium">
                            • {filteredLabs.filter(lab => isRecommended(lab)).length} recommended
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <BarChart size={16} />
                        Sorted by relevance
                    </div>
                </div>

                {/* Labs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredLabs.map((lab) => {
                        const completed = completedLabs.includes(lab.id);
                        const recommended = isRecommended(lab);

                        return (
                            <div
                                key={lab.id}
                                className={`card group relative overflow-hidden flex flex-col ${recommended ? 'ring-2 ring-hpe/30 shadow-lg shadow-hpe/10' : ''
                                    } ${completed ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                            >
                                {/* Recommendation Badge */}
                                {recommended && (
                                    <div className="absolute top-4 right-4 z-10">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-hpe text-white text-xs font-bold rounded-full shadow-lg">
                                            <Target size={12} />
                                            Recommended
                                        </div>
                                    </div>
                                )}

                                {/* Completion Badge */}
                                {completed && (
                                    <div className="absolute top-4 left-4 z-10">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                                            <CheckCircle2 size={12} />
                                            Completed
                                        </div>
                                    </div>
                                )}

                                <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 relative flex items-center justify-center overflow-hidden shrink-0">
                                    <div className="absolute inset-0 bg-gradient-to-br from-hpe/10 to-transparent group-hover:opacity-100 transition-opacity" />
                                    <BookOpen
                                        size={64}
                                        className={`${completed
                                            ? 'text-green-500'
                                            : 'text-slate-400 dark:text-slate-600'
                                            } group-hover:scale-110 transition-all duration-500`}
                                    />

                                    {/* Quick Info Overlay */}
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/50 px-2 py-1 rounded backdrop-blur">
                                                <Clock size={12} />
                                                {lab.duration}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-hpe transition-colors leading-tight">
                                            {lab.title}
                                        </h3>
                                        {lab.difficulty && (
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getDifficultyColor(lab.difficulty)} shrink-0`}>
                                                {lab.difficulty}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-muted mb-4 line-clamp-2">
                                        {lab.description}
                                    </p>

                                    {/* Skills */}
                                    {lab.skills && lab.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {lab.skills.slice(0, 3).map((skill) => (
                                                <span
                                                    key={skill}
                                                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 rounded"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                            {lab.skills.length > 3 && (
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 rounded">
                                                    +{lab.skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Prerequisites */}
                                    {lab.prerequisites && lab.prerequisites.length > 0 && (
                                        <div className="mb-4">
                                            <div className="text-xs text-muted mb-1">Prerequisites:</div>
                                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                                {lab.prerequisites.join(", ")}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 flex gap-3">
                                        <button
                                            onClick={() => startLab(lab.id)}
                                            className="btn-primary flex-1"
                                        >
                                            <BookOpen size={18} />
                                            Start
                                        </button>
                                        <button
                                            onClick={(e) => toggleCompletion(e, lab.id)}
                                            className={`p-3 rounded-xl border transition-colors ${completed
                                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                                                : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-hpe hover:border-hpe'
                                                }`}
                                            title={completed ? "Mark as incomplete" : "Mark as complete"}
                                        >
                                            <Check size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function LabsPage() {
    return (
        <Suspense fallback={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-8">
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-96 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        }>
            <LabsPageContent />
        </Suspense>
    );
}