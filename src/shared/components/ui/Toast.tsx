"use client";

/**
 * TOAST NOTIFICATION SYSTEM
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on existing UI patterns
 * - MODULAR: Reusable toast components
 * - CLEAN: Simple API for notifications
 * - PERFORMANT: Minimal DOM manipulation
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// Toast component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    useEffect(() => {
        // Animate in
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (toast.duration && toast.duration > 0) {
            const timer = setTimeout(() => {
                handleRemove();
            }, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast.duration]);

    const handleRemove = useCallback(() => {
        setIsRemoving(true);
        setTimeout(() => {
            onRemove(toast.id);
        }, 300);
    }, [toast.id, onRemove]);

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-400" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getBorderColor = () => {
        switch (toast.type) {
            case 'success':
                return 'border-green-500/30';
            case 'error':
                return 'border-red-500/30';
            case 'warning':
                return 'border-yellow-500/30';
            case 'info':
            default:
                return 'border-blue-500/30';
        }
    };

    return (
        <div
            className={`
        glass-premium rounded-xl p-4 border ${getBorderColor()} shadow-2xl
        transform transition-all duration-300 ease-out
        ${isVisible && !isRemoving
                    ? 'translate-x-0 opacity-100 scale-100'
                    : 'translate-x-full opacity-0 scale-95'
                }
      `}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    {getIcon()}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm">
                        {toast.title}
                    </h4>
                    {toast.message && (
                        <p className="text-gray-300 text-sm mt-1 leading-relaxed">
                            {toast.message}
                        </p>
                    )}

                    {toast.action && (
                        <div className="mt-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toast.action.onClick}
                                className="text-xs h-7 px-3"
                            >
                                {toast.action.label}
                            </Button>
                        </div>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    className="w-6 h-6 p-0 rounded-full flex-shrink-0 text-gray-400 hover:text-white"
                >
                    <X size={14} />
                </Button>
            </div>
        </div>
    );
}

// Toast container
export function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full">
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onRemove={removeToast}
                />
            ))}
        </div>
    );
}

// Toast provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toastData: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast: Toast = {
            id,
            duration: 5000, // Default 5 seconds
            ...toastData,
        };

        setToasts(prev => [...prev, toast]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    );
}

// Convenience hooks for different toast types
export function useSuccessToast() {
    const { addToast } = useToast();
    return useCallback((title: string, message?: string, action?: Toast['action']) => {
        addToast({ type: 'success', title, message, action });
    }, [addToast]);
}

export function useErrorToast() {
    const { addToast } = useToast();
    return useCallback((title: string, message?: string, action?: Toast['action']) => {
        addToast({ type: 'error', title, message, action });
    }, [addToast]);
}

export function useInfoToast() {
    const { addToast } = useToast();
    return useCallback((title: string, message?: string, action?: Toast['action']) => {
        addToast({ type: 'info', title, message, action });
    }, [addToast]);
}

export function useWarningToast() {
    const { addToast } = useToast();
    return useCallback((title: string, message?: string, action?: Toast['action']) => {
        addToast({ type: 'warning', title, message, action });
    }, [addToast]);
}