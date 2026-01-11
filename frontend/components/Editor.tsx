"use client";

import { useEffect, useRef } from "react";
import Loader from "@monaco-editor/loader";
import type { editor } from "monaco-editor";
import { useTheme } from "next-themes";

interface EditorProps {
    value: string;
    onChange?: (value: string | undefined) => void;
    language?: string;
}

export default function Editor({ value, onChange, language = "yaml" }: EditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        let editorInstance: editor.IStandaloneCodeEditor | null = null;
        let mounted = true;

        if (editorRef.current) {
            Loader.init().then((monaco) => {
                if (!mounted || !editorRef.current) return;

                // Defensive check: if editor already exists in this ref (rare but possible in some edge cases)
                if (monacoRef.current) {
                    monacoRef.current.dispose();
                }

                editorInstance = monaco.editor.create(editorRef.current, {
                    value,
                    language,
                    theme: resolvedTheme === "dark" ? "vs-dark" : "vs",
                    automaticLayout: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                });
                monacoRef.current = editorInstance;

                editorInstance.onDidChangeModelContent(() => {
                    onChange?.(editorInstance?.getValue());
                });
            });
        }

        return () => {
            mounted = false;
            if (editorInstance) {
                editorInstance.dispose();
            }
            // Ensure ref is cleared
            monacoRef.current = null;
        };
    }, []);

    // Handle theme updates
    useEffect(() => {
        if (monacoRef.current) {
            monacoRef.current.updateOptions({
                theme: resolvedTheme === "dark" ? "vs-dark" : "vs",
            });
        }
    }, [resolvedTheme]);

    // Handle value updates from parent
    useEffect(() => {
        if (monacoRef.current) {
            const currentValue = monacoRef.current.getValue();
            if (currentValue !== value) {
                monacoRef.current.setValue(value);
            }
        }
    }, [value]);

    return <div ref={editorRef} style={{ height: "100%", width: "100%" }} />;
}