"use client";

import { useEffect, useState } from 'react';
import { User, Shield } from 'lucide-react';
import { userApi } from '@/lib/api';

interface UserInfo {
    user_id: string;
    email?: string | null;
    groups?: string[];
    preferredUsername?: string | null;
}

export function UserMenu() {
    const [user, setUser] = useState<UserInfo | null>(null);

    useEffect(() => {
        userApi.me()
            .then(setUser)
            .catch(console.error);
    }, []);

    if (!user) {
        return (
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 animate-pulse">
                <User size={20} />
            </div>
        );
    }

    const isAdmin = user.groups?.some(g => g.includes('admin'));
    const displayName = user.preferredUsername || user.email || user.user_id;

    return (
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all hover:border-hpe/30 group">
            <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center text-hpe shadow-sm border border-slate-200 dark:border-slate-800 group-hover:scale-105 transition-transform">
                <User size={16} />
            </div>
            <div className="flex flex-col min-w-0 pr-1">
                <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[120px]" title={displayName}>
                    {displayName}
                </span>
                {isAdmin && (
                    <span className="text-[9px] font-bold text-hpe uppercase tracking-wider flex items-center gap-0.5">
                        <Shield size={8} />
                        Admin
                    </span>
                )}
            </div>
        </div>
    );
}