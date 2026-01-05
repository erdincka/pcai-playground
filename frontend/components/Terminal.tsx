"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css"; // Import CSS here to ensure it travels with component

interface TerminalProps {
    sessionId: string | null;
}

export default function Terminal({ sessionId: propSessionId }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(propSessionId);

    useEffect(() => {
        console.log("Terminal: propSessionId changed:", propSessionId);
        if (propSessionId) {
            setSessionId(propSessionId);
        } else {
            // Fallback with a small delay to ensure URL is updated
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
        let term: XTerm | null = null;
        let ws: WebSocket | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const initTerminal = () => {
            if (!terminalRef.current || xtermRef.current) return;

            term = new XTerm({
                theme: {
                    background: "#0f172a",
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
            console.log("Terminal: Current sessionId state before connection:", sessionId);

            if (sessionId) {
                term.writeln("Connecting to sandbox...");
                const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
                let wsUrl = `${protocol}//${window.location.host}/api/shell/${sessionId}`;

                // Development workaround: Next.js rewrites don't always proxy WebSockets correctly.
                // If on localhost:3000, try connecting directly to the backend at localhost:8000
                if (window.location.hostname === 'localhost' && window.location.port === '3000') {
                    wsUrl = `ws://localhost:8000/shell/${sessionId}`;
                }

                try {
                    ws = new WebSocket(wsUrl);

                    ws.onopen = () => {
                        term?.writeln("\x1b[1;32mConnected!\x1b[0m");
                        fitAddon.fit();
                        // Focus terminal so typing works immediately
                        term?.focus();
                    };

                    term.onData((data) => {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(data);
                        }
                    });

                    ws.onmessage = (ev) => {
                        term?.write(ev.data);
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
        };

        // Delay slightly to ensure DOM is ready
        requestAnimationFrame(initTerminal);

        return () => {
            mounted = false;
            if (resizeObserver) resizeObserver.disconnect();
            if (ws) ws.close();
            if (term) {
                term.dispose();
                xtermRef.current = null;
            }
        };
    }, [sessionId]);

    return (
        <div
            ref={terminalRef}
            className="terminal-container h-full w-full"
            style={{ padding: '8px', minHeight: '100%', backgroundColor: '#0f172a' }}
        />
    );
}