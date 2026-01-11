"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info';
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = 'danger'
}: ConfirmationModalProps) {
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
                                    <div className={`p-2 rounded-lg ${variant === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}>
                                        <AlertCircle size={20} />
                                    </div>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-slate-900 dark:text-white mb-2">
                                    {title}
                                </Dialog.Title>
                                <div className="mt-2">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {description}
                                    </p>
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        className="btn-secondary px-4 py-2 text-sm"
                                        onClick={onClose}
                                    >
                                        {cancelText}
                                    </button>
                                    <button
                                        type="button"
                                        className={`px-4 py-2 text-sm rounded-lg font-bold text-white transition-all ${
                                            variant === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' : 'bg-hpe hover:bg-hpe-dark shadow-lg shadow-hpe/20'
                                        }`}
                                        onClick={() => {
                                            onConfirm();
                                            onClose();
                                        }}
                                    >
                                        {confirmText}
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