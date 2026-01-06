"use client";

import { Fragment, useEffect, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { User, LogOut, ChevronDown, Shield } from 'lucide-react';
import { userApi } from '@/lib/api';
import clsx from 'clsx';

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
        <Menu as="div" className="relative ml-3">
            <div>
                <Menu.Button className="flex items-center gap-2 max-w-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-hpe dark:hover:border-hpe transition-colors p-1 pr-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hpe">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-hpe">
                        <User size={18} />
                    </div>
                    <span className="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[100px]">
                        {displayName}
                    </span>
                    <ChevronDown size={14} className="text-slate-400" />
                </Menu.Button>
            </div>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white dark:bg-slate-900 ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 dark:divide-slate-800 focus:outline-none z-50">
                    <div className="px-4 py-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={user.email || user.user_id}>
                            {user.email || user.user_id}
                        </p>
                        {isAdmin && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-hpe/10 text-hpe">
                                <Shield size={10} />
                                ADMIN
                            </span>
                        )}
                    </div>
                    <div className="py-1">
                        <Menu.Item>
                            {({ active }) => (
                                <a
                                    href="/oauth2/sign_out"
                                    className={clsx(
                                        active ? 'bg-slate-50 dark:bg-slate-800' : '',
                                        'group flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-200 w-full'
                                    )}
                                >
                                    <LogOut className="mr-3 h-4 w-4 text-slate-400 group-hover:text-slate-500" aria-hidden="true" />
                                    Sign out
                                </a>
                            )}
                        </Menu.Item>
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}