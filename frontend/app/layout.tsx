import "./globals.css";
import "@xterm/xterm/css/xterm.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { BookOpen, Monitor, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";

export const metadata = {
    title: "HPE PCAI Playground",
    description: "Learn Kubernetes with HPE PCAI",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="antialiased font-sans">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
                        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 flex-shrink-0">
                            <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                                <div className="flex items-center gap-8">
                                    <Link href="/" className="flex items-center gap-2 group">
                                        <div className="bg-hpe p-1.5 rounded-lg shadow-lg shadow-hpe/20 group-hover:scale-110 transition-transform">
                                            <span className="text-white font-bold text-lg">HPE</span>
                                        </div>
                                        <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">PCAI <span className="text-hpe">Playground</span></span>
                                    </Link>
                                    <nav className="hidden md:flex items-center gap-8">
                                        <Link href="/labs" className="nav-link flex items-center gap-2">
                                            <BookOpen size={18} />
                                            Catalog
                                        </Link>
                                        <Link href="/my-sessions" className="nav-link flex items-center gap-2">
                                            <Monitor size={18} />
                                            My Sessions
                                        </Link>
                                        <Link href="/admin" className="nav-link flex items-center gap-2">
                                            <ShieldCheck size={18} />
                                            Admin
                                        </Link>
                                    </nav>
                                </div>
                                <div className="flex items-center gap-4">
                                    <ThemeToggle />
                                    <UserMenu />
                                </div>
                            </div>
                        </header>
                        <main className="flex-1 flex flex-col">{children}</main>
                    </div>
                    <Toaster richColors position="top-right" />
                </ThemeProvider>
            </body>
        </html>
    );
}