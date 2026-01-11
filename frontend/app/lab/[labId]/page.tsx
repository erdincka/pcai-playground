"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { labsApi, apiRequest } from "@/lib/api";
import { CheckCircle, Square, Copy, Trash2, Play, BookOpen, ExternalLink, ArrowRight, Terminal as TerminalIcon, Code, Info } from "lucide-react";
import Editor from "@/components/Editor";
import ConfirmationModal from "@/components/ConfirmationModal";
import LabEndModal from "@/components/LabEndModal";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import yaml from 'js-yaml';

const Terminal = dynamic(() => import("@/components/XTermTerminal"), {
    ssr: false,
    loading: () => <div className="text-slate-500 p-4 font-mono text-sm">Initializing Terminal...</div>
});

interface UIHints {
    showShell: boolean;
    showEditor: boolean;
    requiresPCAIUI: boolean;
}

interface Lab {
    id: string;
    title: string;
    steps: any[];
    ui_hints: UIHints;
    completion?: any;
}

export default function LabPage() {
    const params = useParams() as { labId: string };
    const searchParams = useSearchParams();
    const router = useRouter();
    const sessionId = searchParams.get("sessionId");
    const [lab, setLab] = useState<Lab | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [manifest, setManifest] = useState("");
    const [isEndModalOpen, setIsEndModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleEndSession = () => setIsEndModalOpen(true);

    const onConfirmEndOnly = async () => {
        if (!sessionId) return;
        try {
            const loadingToast = toast.loading("Ending session...");
            await apiRequest(`/sessions/${sessionId}`, { method: "DELETE" });
            toast.dismiss(loadingToast);
            toast.success("Session terminated");
            router.push('/labs');
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to end session");
        }
    };

    const onConfirmEndAndComplete = async () => {
        if (!sessionId) return;
        try {
            const loadingToast = toast.loading("Completing and ending...");
            await apiRequest(`/sessions/${sessionId}/complete`, { method: "POST" });
            await apiRequest(`/sessions/${sessionId}`, { method: "DELETE" });
            toast.dismiss(loadingToast);
            toast.success("Lab completed and session ended");
            router.push('/labs');
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to complete lab");
        }
    };

    const onConfirmDeleteManifest = async () => {
        if (!sessionId) return;
        try {
            const loadingToast = toast.loading("Deleting resources...");
            await apiRequest(`/sessions/${sessionId}/delete-manifest`, {
                method: "POST",
                body: JSON.stringify({ manifest }),
            });
            toast.dismiss(loadingToast);
            toast.success("Resources deleted");
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to delete");
        }
    };

    useEffect(() => {
        async function loadLab() {
            try {
                const data = await labsApi.get(params.labId);
                
                // Append completion step if it exists and not already present
                if (data.completion && !data.steps.some((s: any) => s.type === 'completion')) {
                    data.steps.push({
                        title: "Completion",
                        type: "completion",
                        content: "", 
                        completionData: data.completion
                    });
                }
                
                setLab(data);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load lab");
            }
        }
        loadLab();
    }, [params.labId]);

    // Update manifest state when step changes
    useEffect(() => {
        setManifest(""); // Clear manifest on step change to wait for user input/copy
    }, [currentStep]);

    const isManifestValid = (content: string) => {
        if (!content || !content.trim()) return false;
        try {
            const parsed = yaml.load(content);
            return typeof parsed === 'object' && parsed !== null;
        } catch (e) {
            return false;
        }
    };

    const handleFinish = async () => {
        if (!sessionId) return;
        try {
            const loadingToast = toast.loading("Completing lab...");
            await apiRequest(`/sessions/${sessionId}/complete`, {
                method: "POST",
            });
            toast.dismiss(loadingToast);
            toast.success("Lab Completed!");
            router.push('/my-sessions');
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to complete lab");
        }
    };

    const renderContent = (step: any) => {
        const content = step.content || step.instruction;
        if (!content) return null;

        const commands = step.commands || (step.command ? [step.command] : []);
        
        if (commands.length > 0 && content.includes('[[COMMAND')) {
            let parts: (string | JSX.Element)[] = [content];
            
            commands.forEach((cmd: string, index: number) => {
                const placeholder = content.includes(`[[COMMAND:${index}]]`) 
                    ? `[[COMMAND:${index}]]` 
                    : '[[COMMAND]]';
                
                const newParts: (string | JSX.Element)[] = [];
                parts.forEach(part => {
                    if (typeof part === 'string' && part.includes(placeholder)) {
                        const subParts = part.split(placeholder);
                        subParts.forEach((subPart, i) => {
                            newParts.push(subPart);
                            if (i < subParts.length - 1) {
                                newParts.push(
                                    <span key={`${index}-${i}`} className="inline-flex items-center gap-2 group mx-1">
                                        <code className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-sm text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                                            {cmd}
                                        </code>
                                        <button
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('terminal:type', { detail: cmd + '\n' }));
                                                toast.success("Command sent to terminal");
                                            }}
                                            className="inline-flex items-center justify-center p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-hpe text-slate-500 hover:text-hpe transition-all shadow-sm"
                                            title="Send to terminal"
                                        >
                                            <TerminalIcon size={14} />
                                        </button>
                                    </span>
                                );
                            }
                        });
                    } else {
                        newParts.push(part);
                    }
                });
                parts = newParts;
            });

            return (
                <div className="whitespace-pre-wrap leading-relaxed">
                    {parts.map((part, i) => <span key={i}>{part}</span>)}
                </div>
            );
        }

        // Fallback for verification or older format
        return content.split('\n').map((line: string, i: number) => {
            // Match quoted commands (single or double quotes) or unquoted commands ending at ., ;, or end of line
            const cmdMatch = line.match(/['`](kubectl|helm|docker|git|SHOW|DESCRIBE)[^'`]*['`]/) || 
                             line.match(/(?:kubectl|helm|docker|git|SHOW|DESCRIBE)\s+[^.;\n]*/);
            
            if (cmdMatch) {
                const fullMatch = cmdMatch[0];
                // Remove surrounding quotes if present
                const cmd = fullMatch.replace(/^['`]|['`]$/g, '');
                const parts = line.split(fullMatch);
                
                return (
                    <div key={i} className="mb-2 flex flex-wrap items-center gap-2 group">
                        <span>{parts[0]}</span>
                        <code className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded font-mono text-sm text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                            {cmd}
                        </code>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('terminal:type', { detail: cmd + '\n' }));
                                toast.success("Command sent to terminal");
                            }}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-hpe transition-all"
                            title="Send to terminal"
                        >
                            <TerminalIcon size={14} />
                        </button>
                        <span>{parts.slice(1).join(fullMatch)}</span>
                    </div>
                );
            }
            return <div key={i} className="mb-2 whitespace-pre-wrap">{line}</div>;
        });
    };

    const renderCompletion = (completion: any) => {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-xl border border-green-100 dark:border-green-900/20">
                    <h2 className="text-2xl font-bold text-green-800 dark:text-green-400 mb-2">Lab Completed!</h2>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{completion.summary}</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <ArrowRight size={20} className="text-hpe" />
                        What to try next
                    </h3>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        {completion.next_steps.map((step: string, i: number) => (
                            <div key={i} className="p-4 border-b border-slate-200 dark:border-slate-800 last:border-0 flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-hpe/10 text-hpe flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">{step}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <BookOpen size={20} className="text-hpe" />
                        Resources
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {completion.resources.map((res: any, i: number) => (
                            <a 
                                key={i} 
                                href={res.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-hpe dark:hover:border-hpe hover:shadow-sm bg-white dark:bg-slate-900 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-hpe/10 transition-colors">
                                        <ExternalLink size={18} className="text-slate-500 group-hover:text-hpe" />
                                    </div>
                                    <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-hpe">{res.title}</span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    if (!lab) return (
        <div className="flex justify-center items-center h-full min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hpe"></div>
        </div>
    );

    const activeStep = lab.steps[currentStep];
    const isCompletion = activeStep.type === 'completion';

    return (
        <div className="fixed inset-0 top-[65px] flex overflow-hidden bg-white dark:bg-slate-950 z-0">
            {/* Sidebar - Steps */}
            <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <button 
                            onClick={handleEndSession}
                            className="text-[10px] uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-600 px-2 py-1 rounded border border-red-500/20 transition-colors font-bold"
                        >
                            End Lab
                        </button>
                    </div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1" title={lab.title}>{lab.title}</h2>
                    <div className="text-xs text-muted uppercase tracking-wider font-semibold">
                        Step {currentStep + 1} of {lab.steps.length}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {lab.steps.map((step: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentStep(idx)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                                idx === currentStep 
                                ? "bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                        >
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                idx === currentStep 
                                ? "bg-hpe text-white" 
                                : idx < currentStep 
                                    ? "bg-green-500 text-white"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            }`}>
                                {idx < currentStep ? <CheckCircle size={14} /> : idx + 1}
                            </div>
                            <span className={`text-sm font-medium line-clamp-1 ${idx === currentStep ? "text-slate-900 dark:text-white" : ""}`}>
                                {step.title || `Step ${step.step}`}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                
                {/* Top Section: Instructions & Editor */}
                <div className="flex-1 flex min-h-0">
                    {/* Instructions (Left) */}
                    <div className={`${lab.ui_hints?.showEditor ? 'w-1/2' : 'flex-1'} flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950`}>
                        <div className="flex-1 overflow-y-auto">
                            <div className={`p-8 ${lab.ui_hints?.showEditor ? 'max-w-2xl' : 'max-w-4xl'} mx-auto`}>
                                <h1 className="heading-1 mb-6">
                                    {activeStep.title || `Step ${activeStep.step}`}
                                </h1>

                                {lab.ui_hints?.requiresPCAIUI && (
                                    <div className="mb-6 p-4 bg-hpe/10 border border-hpe/20 rounded-xl flex items-start gap-3">
                                        <Info className="text-hpe shrink-0 mt-0.5" size={18} />
                                        <div className="text-sm">
                                            <p className="font-bold text-hpe mb-1">PCAI Platform UI Required</p>
                                            <p className="text-slate-600 dark:text-slate-400">
                                                This lab involves tasks that are best performed in the main PCAI Platform UI.
                                                <a href="#" className="inline-flex items-center gap-1 ml-1 text-hpe hover:underline font-medium">
                                                    Open PCAI UI <ExternalLink size={12} />
                                                </a>
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 pb-20">
                                    {isCompletion 
                                        ? renderCompletion(activeStep.completionData) 
                                        : (
                                            <>
                                                {renderContent(activeStep)}
                                                
                                                {activeStep.template && (
                                                    <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">YAML Template</h3>
                                                            <button
                                                                onClick={() => {
                                                                    setManifest(activeStep.template);
                                                                    toast.success("YAML copied to editor");
                                                                }}
                                                                className="flex items-center gap-2 text-xs bg-hpe/10 hover:bg-hpe/20 text-hpe px-3 py-1.5 rounded-lg transition-colors font-semibold"
                                                            >
                                                                <Copy size={14} />
                                                                Copy to Editor
                                                            </button>
                                                        </div>
                                                        <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs overflow-x-auto font-mono text-slate-800 dark:text-slate-300">
                                                            {activeStep.template}
                                                        </pre>
                                                    </div>
                                                )}

                                                {activeStep.verification && (
                                                    <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                            <CheckCircle size={16} className="text-green-600" />
                                                            Verification
                                                        </h3>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400">
                                                            {renderContent({ content: activeStep.verification })}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )
                                    }
                                </div>
                            </div>
                        </div>
                        {/* Navigation Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-900 z-10">
                            <button
                                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                                disabled={currentStep === 0}
                                className="btn btn-secondary text-sm px-4 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => {
                                    if (currentStep === lab.steps.length - 1) {
                                        handleFinish();
                                    } else {
                                        setCurrentStep(prev => Math.min(lab.steps.length - 1, prev + 1));
                                    }
                                }}
                                className="btn btn-primary text-sm px-4"
                            >
                                {currentStep === lab.steps.length - 1 ? "Finish" : "Next Step"}
                            </button>
                        </div>
                    </div>

                    {/* Editor (Right) */}
                    {lab.ui_hints?.showEditor && (
                        <div className="w-1/2 flex flex-col bg-slate-900 border-l border-slate-800">
                            <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Code size={14} />
                                    <span className="text-xs font-mono font-medium">manifest.yaml</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isManifestValid(manifest) && (
                                        <button
                                            onClick={() => setIsDeleteModalOpen(true)}
                                            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
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
                                                    toast.success("Manifest applied");
                                                } catch (err: any) {
                                                    toast.dismiss();
                                                    toast.error(err.message || "Failed to apply");
                                                }
                                            }
                                        }}
                                        disabled={!isManifestValid(manifest)}
                                        className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5 ${
                                            !isManifestValid(manifest) 
                                            ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                                            : "bg-hpe hover:bg-hpe-dark text-white shadow-lg shadow-hpe/20"
                                        }`}
                                    >
                                        <Play size={12} />
                                        Apply
                                    </button>
                                </div>
                            </div>
                            {/* Info Box */}
                            <div className="bg-slate-800/50 border-b border-slate-800 p-3 flex gap-3 text-xs text-slate-400">
                                <Info size={16} className="text-hpe flex-shrink-0 mt-0.5" />
                                <p>
                                    Use this editor to view and modify Kubernetes manifests. 
                                    Click "Apply" to create resources in your sandbox. 
                                    The content updates automatically with each step, but your changes persist until you switch steps.
                                </p>
                            </div>
                            <div className="flex-1 relative">
                                <Editor
                                    value={manifest}
                                    onChange={(val) => setManifest(val || "")}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <LabEndModal 
                    isOpen={isEndModalOpen}
                    onClose={() => setIsEndModalOpen(false)}
                    onEndOnly={onConfirmEndOnly}
                    onEndAndComplete={onConfirmEndAndComplete}
                />

                <ConfirmationModal 
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={onConfirmDeleteManifest}
                    title="Delete Resources"
                    description="Are you sure you want to delete the resources defined in this manifest? This action cannot be undone."
                    confirmText="Delete"
                    variant="danger"
                />

                {/* Bottom Section: Terminal */}
                {lab.ui_hints?.showShell && (
                    <div className="h-80 min-h-[250px] border-t border-slate-800 flex flex-col bg-[#0f172a]">
                        <div className="bg-slate-950 px-4 py-1.5 flex items-center justify-between border-b border-slate-900">
                            <div className="flex items-center gap-2 text-slate-400">
                                <TerminalIcon size={14} />
                                <span className="text-xs font-mono font-medium">Terminal</span>
                            </div>
                            <button className="text-slate-500 hover:text-slate-300 transition-colors" title="Clear Terminal">
                                <Square size={12} />
                            </button>
                        </div>
                        <div className="flex-1 relative overflow-hidden">
                            <Terminal sessionId={sessionId} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}