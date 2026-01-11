"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { LogOut, X, CheckCircle } from 'lucide-react';

interface LabEndModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEndOnly: () => void;
    onEndAndComplete: () => void;
}

export default function LabEndModal({
    isOpen,
    onClose,
    onEndOnly,
    onEndAndComplete
}: LabEndModalProps) {
    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20">
                                        <LogOut size={20} />
                                    </div>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-slate-900 dark:text-white mb-2">
                                    End Lab Session
                                </Dialog.Title>
                                <div className="mt-2">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        You are about to end your session. All resources in your sandbox will be deleted.
                                    </p>
                                </div>

                                <div className="mt-8 space-y-3">
                                    <button
                                        onClick={() => {
                                            onEndAndComplete();
                                            onClose();
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-hpe text-white hover:bg-hpe-dark transition-all shadow-lg shadow-hpe/20"
                                    >
                                        <CheckCircle size={18} />
                                        Mark as Completed & End
                                    </button>
                                    <button
                                        onClick={() => {
                                            onEndOnly();
                                            onClose();
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                                    >
                                        End without completing
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-full px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}