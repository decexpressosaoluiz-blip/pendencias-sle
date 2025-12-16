import { CTE, PendencyStatus, AppConfig } from '../types';

export const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;

    // 1. Try ISO Format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime()) && dateStr.includes('-')) {
        // Fix timezone offset issues by treating it as UTC 00:00 -> Local
        const userTimezoneOffset = isoDate.getTimezoneOffset() * 60000;
        return new Date(isoDate.getTime() + userTimezoneOffset);
    }

    // 2. Try BR Format (DD/MM/YYYY)
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Month is 0-indexed in JS
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }

    return null;
};

export const calculateStatus = (cte: CTE, config: AppConfig): PendencyStatus => {
    // Normalize "Today" to start of day for fair comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fallback seguro para string vazia se limitDate for undefined
    const limitDate = parseDate(cte.limitDate || "");
    
    // If no date, assume ON_TIME to avoid scaring users, or create a 'NO DATE' status if preferred
    if (!limitDate) return PendencyStatus.ON_TIME;

    // Normalize limit date
    limitDate.setHours(0, 0, 0, 0);

    const diffTime = limitDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Critical Logic: If Today > (Limit + Tolerance Days)
    const criticalThresholdDate = new Date(limitDate);
    criticalThresholdDate.setDate(criticalThresholdDate.getDate() + (config.criticalDaysLimit || 5));

    if (today > criticalThresholdDate) return PendencyStatus.CRITICAL;
    
    // Late Logic: Limit has passed
    if (diffDays < 0) return PendencyStatus.LATE;
    
    // Warning Logic
    if (diffDays === 0) return PendencyStatus.PRIORITY; // Due Today
    if (diffDays === 1) return PendencyStatus.TOMORROW; // Due Tomorrow

    return PendencyStatus.ON_TIME;
};

export const getStatusColor = (status: string | undefined): string => {
    // Fallback para evitar erro se status for undefined
    const safeStatus = status || "";
    switch (safeStatus) {
        case PendencyStatus.CRITICAL:
            return 'bg-red-600 text-white border-red-700';
        case PendencyStatus.LATE:
            return 'bg-red-100 text-red-700 border-red-200'; // Softer red for late but not critical
        case PendencyStatus.PRIORITY:
            return 'bg-orange-500 text-white border-orange-600';
        case PendencyStatus.TOMORROW:
            return 'bg-yellow-400 text-yellow-900 border-yellow-500';
        case PendencyStatus.ON_TIME:
            return 'bg-emerald-500 text-white border-emerald-600';
        default:
            return 'bg-gray-200 text-gray-700 border-gray-300';
    }
};

export const formatCurrency = (value: number | undefined | null): string => {
    // Garante que value seja um número, fallback para 0
    const val = value || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};