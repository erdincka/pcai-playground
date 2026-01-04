"use client";

import { useEffect, useRef } from "react";
import Loader from "@monaco-editor/loader";
import type { editor } from "monaco-editor";

interface EditorProps {
    value: string;
    onChange?: (value: string | undefined) => void;
    language?: string;
}

export default function Editor({ value, onChange, language = "yaml" }: EditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);

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
                    theme: "vs-dark",
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

    return <div ref={editorRef} style={{ height: "100%", width: "100%" }} />;
}
