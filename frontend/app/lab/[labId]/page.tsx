"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { labsApi, apiRequest } from "@/lib/api";
import { CheckCircle, Square, Copy, Trash2, Play } from "lucide-react";
import Editor from "@/components/Editor";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import yaml from 'js-yaml';

const Terminal = dynamic(() => import("@/components/Terminal"), {
    ssr: false,
    loading: () => <div className="text-slate-500 p-4 font-mono text-sm">Initializing Terminal...</div>
});

export default function LabPage() {
    const params = useParams() as { labId: string };
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("sessionId");
    const [lab, setLab] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [manifest, setManifest] = useState("");

    useEffect(() => {
        async function loadLab() {
            try {
                const data = await labsApi.get(params.labId);
                setLab(data);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load lab");
            }
        }
        loadLab();
    }, [params.labId]);

    const isManifestValid = (content: string) => {
        if (!content || !content.trim()) return false;
        try {
            const parsed = yaml.load(content);
            return typeof parsed === 'object' && parsed !== null;
        } catch (e) {
            return false;
        }
    };

    const renderContent = (content: string) => {
        if (!content) return null;
        
        // Simple heuristic to identify commands: lines containing common CLI tools
        // This regex looks for the command and captures it
        return content.split('\n').map((line, i) => {
            // Check if line contains a command
            const cmdMatch = line.match(/(?:kubectl|helm|docker|git)\s+[^\n]*/);
            
            if (cmdMatch) {
                const cmd = cmdMatch[0];
                const parts = line.split(cmd);
                
                return (
                    <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
                        <span>{parts[0]}</span>
                        <code className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded font-mono text-sm text-slate-900 dark:text-slate-200">
                            {cmd}
                        </code>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('terminal:type', { detail: cmd }));
                                toast.success("Command copied to terminal");
                            }}
                            className="inline-flex items-center justify-center p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-hpe transition-colors"
                            title="Copy to terminal"
                        >
                            <Copy size={14} />
                        </button>
                        <span>{parts.slice(1).join(cmd)}</span>
                    </div>
                );
            }
            return <div key={i} className="mb-2 whitespace-pre-wrap">{line}</div>;
        });
    };

    if (!lab) return (
        <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hpe"></div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-1">{lab.title}</h2>
                        <div className="text-xs text-muted uppercase tracking-wider font-semibold">
                            Step {currentStep + 1} of {lab.steps.length}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {lab.steps.map((step: any, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentStep(idx)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${idx === currentStep ? "bg-hpe/10 text-hpe" : "text-muted hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                            >
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${idx === currentStep ? "border-hpe bg-hpe text-white" : "border-slate-300 dark:border-slate-700"
                                    }`}>
                                    {idx + 1}
                                </div>
                                <span className="text-sm font-medium line-clamp-1">{step.title || `Step ${step.step}`}</span>
                                {idx < currentStep && <CheckCircle size={16} className="ml-auto text-hpe" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
                    <div className="p-8 max-w-3xl mx-auto w-full flex-1 overflow-y-auto">
                        <h1 className="heading-1">{lab.steps[currentStep].title || `Step ${lab.steps[currentStep].step}`}</h1>
                        <div className="prose dark:prose-invert max-w-none mb-8 text-slate-700 dark:text-slate-300">
                            {renderContent(lab.steps[currentStep].content || lab.steps[currentStep].instruction)}
                        </div>

                        {/* Monaco Editor */}
                        <div className="card border-none bg-slate-900 dark:bg-slate-900 rounded-xl overflow-hidden mb-8 flex flex-col h-[400px]">
                            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-mono">manifest.yaml</span>
                                <div className="flex items-center gap-2">
                                    {isManifestValid(manifest) && (
                                        <button
                                            onClick={async () => {
                                                if (!sessionId) return;
                                                
                                                // Confirmation dialog
                                                if (!confirm("Are you sure you want to delete these resources? This action cannot be undone.")) return;

                                                try {
                                                    const loadingToast = toast.loading("Deleting resources...");
                                                    await apiRequest(`/sessions/${sessionId}/delete-manifest`, {
                                                        method: "POST",
                                                        body: JSON.stringify({ manifest }),
                                                    });
                                                    toast.dismiss(loadingToast);
                                                    toast.success("Resources deleted successfully");
                                                } catch (err: any) {
                                                    toast.dismiss();
                                                    toast.error(err.message || "Failed to delete resources");
                                                }
                                            }}
                                            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/50 px-3 py-1 rounded font-semibold transition-colors flex items-center gap-1"
                                            title="Delete resources defined in the editor"
                                        >
                                            <Trash2 size={12} />
                                            Delete
                                        </button>
                                    )}
                                    <button
                                        onClick={async () => {
                                            if (sessionId) {
                                                try {
                                                    const loadingToast = toast.loading("Applying manifest...");
                                                    await apiRequest(`/sessions/${sessionId}/apply-manifest`, {
                                                        method: "POST",
                                                        body: JSON.stringify({ manifest }),
                                                    });
                                                    toast.dismiss(loadingToast);
                                                    toast.success("Manifest applied successfully");
                                                } catch (err: any) {
                                                    toast.dismiss();
                                                    toast.error(err.message || "Failed to apply manifest");
                                                }
                                            }
                                        }}
                                        disabled={!isManifestValid(manifest)}
                                        className={`text-xs px-3 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${!isManifestValid(manifest) ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-hpe hover:bg-hpe-dark text-white"}`}
                                    >
                                        <Play size={12} />
                                        Apply
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1">
                                <Editor
                                    value={lab.steps[currentStep].template || ""}
                                    onChange={(val) => setManifest(val || "")}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Terminal Area */}
                    <div className="h-80 bg-[#0f172a] border-t border-slate-700 dark:border-slate-800 relative">
                        <div className="absolute top-0 right-0 p-2 z-10 flex gap-2">
                            <button className="bg-slate-800 text-slate-300 p-1.5 rounded hover:text-white transition-colors" title="Clear Terminal">
                                <Square size={14} />
                            </button>
                        </div>
                        <Terminal sessionId={sessionId} />
                    </div>
                </div>
            </div>
        </div>
    );
}