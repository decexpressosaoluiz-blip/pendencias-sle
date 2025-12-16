// Utility for shared color definitions
export const getStatusColor = (status: string): string => {
    switch (status) {
        case 'CRÍTICO': return 'bg-red-600 text-white border-red-700';
        case 'FORA DO PRAZO': return 'bg-red-100 text-red-700 border-red-200';
        case 'PRIORIDADE': return 'bg-orange-500 text-white border-orange-600';
        case 'VENCE AMANHÃ': return 'bg-yellow-400 text-yellow-900 border-yellow-500';
        case 'NO PRAZO': return 'bg-emerald-500 text-white border-emerald-600';
        default: return 'bg-gray-200 text-gray-700 border-gray-300';
    }
};

export const tailwindColors = {
    primary: '#2563eb',
    secondary: '#475569',
    success: '#16a34a',
    warning: '#ca8a04',
    danger: '#dc2626',
};