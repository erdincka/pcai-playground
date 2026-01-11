"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css"; 
import { useTheme } from "next-themes";

interface TerminalProps {
    sessionId: string | null;
}

export default function XTermTerminal({ sessionId: propSessionId }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const { resolvedTheme } = useTheme();
    const [sessionId, setSessionId] = useState<string | null>(propSessionId);

    // Handle incoming commands from other components
    useEffect(() => {
        const handleCommand = (e: CustomEvent) => {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && e.detail) {
                ws.send(e.detail);
                xtermRef.current?.focus();
                xtermRef.current?.scrollToBottom();
            } else {
                console.warn("Terminal: WebSocket not ready for command", e.detail);
            }
        };

        window.addEventListener('terminal:type' as any, handleCommand);
        return () => window.removeEventListener('terminal:type' as any, handleCommand);
    }, []);

    useEffect(() => {
        console.log("Terminal: propSessionId changed:", propSessionId);
        if (propSessionId) {
            setSessionId(propSessionId);
        } else {
            const checkUrl = () => {
                const params = new URLSearchParams(window.location.search);
                const sId = params.get("sessionId");
                console.log("Terminal: Checked URL for sessionId:", sId);
                if (sId) {
                    setSessionId(sId);
                }
            };

            checkUrl();
            const timer = setTimeout(checkUrl, 500);
            return () => clearTimeout(timer);
        }
    }, [propSessionId]);

    useEffect(() => {
        let mounted = true;
        let term: any = null;
        let resizeObserver: ResizeObserver | null = null;

        const initTerminal = async () => {
            if (!terminalRef.current || xtermRef.current) return;

            // Dynamically import xterm and addon-fit to avoid SSR issues
            try {
                const { Terminal: XTerm } = await import("@xterm/xterm");
                const { FitAddon } = await import("@xterm/addon-fit");

                if (!mounted) return;

                term = new XTerm({
                    theme: resolvedTheme === "dark" ? {
                        background: "#0f172a",
                        foreground: "#f8fafc",
                    } : {
                        background: "#ffffff",
                        foreground: "#0f172a",
                        cursor: "#0f172a",
                    },
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 14,
                    allowProposedApi: true,
                    cursorBlink: true,
                    rows: 20,
                    cols: 80,
                });

                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);

                if (!terminalRef.current) {
                    term.dispose();
                    return;
                }

                term.open(terminalRef.current);
                xtermRef.current = term;

                // Fit logic
                setTimeout(() => {
                    if (mounted && terminalRef.current) {
                        try {
                            fitAddon.fit();
                        } catch (e) {
                            console.warn("Fit error", e);
                        }
                    }
                }, 100);

                resizeObserver = new ResizeObserver(() => {
                    if (mounted && terminalRef.current) {
                        requestAnimationFrame(() => {
                            try {
                                fitAddon.fit();
                            } catch (e) {
                                // ignore
                            }
                        });
                    }
                });
                resizeObserver.observe(terminalRef.current);

                term.writeln("\x1b[1;32mHPE PCAI Playground Terminal (v2)\x1b[0m");
                
                if (sessionId) {
                    term.writeln("Connecting to sandbox...");
                    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
                    let wsUrl = `${protocol}//${window.location.host}/api/shell/${sessionId}`;

                    if (window.location.hostname === 'localhost' && window.location.port === '3000') {
                        wsUrl = `ws://localhost:8000/shell/${sessionId}`;
                    }

                    try {
                        const ws = new WebSocket(wsUrl);
                        wsRef.current = ws;

                        ws.onopen = () => {
                            term?.writeln("\x1b[1;32mConnected!\x1b[0m");
                            fitAddon.fit();
                            term?.focus();
                        };

                        term.onData((data: string) => {
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                ws.send(data);
                            }
                        });

                        ws.onmessage = (ev) => {
                            term?.write(ev.data, () => {
                                term?.scrollToBottom();
                            });
                        };

                        ws.onclose = () => {
                            term?.writeln("\r\n\x1b[1;31mConnection closed.\x1b[0m");
                        };

                        ws.onerror = (err) => {
                            console.error("WebSocket Error:", err);
                            term?.writeln("\r\n\x1b[1;31mWebSocket connection failed.\x1b[0m");
                        };
                    } catch (err) {
                        console.error("WebSocket creation error:", err);
                        term.writeln("\r\n\x1b[1;31mFailed to create WebSocket connection.\x1b[0m");
                    }
                } else {
                    term.writeln("\x1b[1;33mNo active session. Start a lab to use the terminal.\x1b[0m");
                }

            } catch (err) {
                console.error("Failed to load terminal", err);
            }
        };

        requestAnimationFrame(initTerminal);

        return () => {
            mounted = false;
            if (resizeObserver) resizeObserver.disconnect();
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (term) {
                term.dispose();
                xtermRef.current = null;
            }
        };
    }, [sessionId]);

    // Handle theme updates
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = resolvedTheme === "dark" ? {
                background: "#0f172a",
                foreground: "#f8fafc",
            } : {
                background: "#ffffff",
                foreground: "#0f172a",
                cursor: "#0f172a",
            };
        }
    }, [resolvedTheme]);

    return (
        <div
            ref={terminalRef}
            className="terminal-container h-full w-full"
            style={{ 
                padding: '8px', 
                backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff', 
                overflow: 'hidden' 
            }}
        />
    );
}