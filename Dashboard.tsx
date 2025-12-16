import React, { useEffect, useState, useMemo, useCallback, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, CartesianGrid, PieChart, Pie } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { User, CTE, PendencyStatus, PaymentType } from '../types';
import { fetchAllData, normalizeText } from '../services/api';
import { calculateStatus, formatCurrency } from '../utils/calculations';
import { AppContext } from '../App';
import { Sparkles, RefreshCw, Filter, X, Clock, AlertTriangle, AlertCircle, TrendingUp, CheckCircle, DollarSign, Package, BarChart3, PieChart as PieIcon, Building2 } from 'lucide-react';
import { analyzeData } from '../services/geminiService';

interface DashboardProps {
    user: User;
}

const PAYMENT_COLORS = {
    [PaymentType.CIF]: '#3B82F6',
    [PaymentType.FOB]: '#8B5CF6',
    [PaymentType.SENDER]: '#10B981', 
    [PaymentType.DEST]: '#F59E0B',
    'OUTROS': '#9CA3AF'
};

const STATUS_COLORS: Record<string, string> = {
    [PendencyStatus.CRITICAL]: '#DC2626',
    [PendencyStatus.LATE]: '#F87171',
    [PendencyStatus.PRIORITY]: '#FB923C',
    [PendencyStatus.TOMORROW]: '#FACC15',
    [PendencyStatus.ON_TIME]: '#34D399',
    'DEFAULT': '#E5E7EB'
};

const STATUS_STYLES: Record<string, { icon: any, colorName: string, activeClass: string }> = {
    [PendencyStatus.CRITICAL]: { 
        icon: AlertTriangle, 
        colorName: 'red',
        activeClass: 'border-red-500 bg-red-50 ring-1 ring-red-500'
    },
    [PendencyStatus.LATE]: { 
        icon: Clock, 
        colorName: 'red',
        activeClass: 'border-red-500 bg-red-50 ring-1 ring-red-500'
    },
    [PendencyStatus.PRIORITY]: { 
        icon: AlertCircle, 
        colorName: 'orange',
        activeClass: 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
    },
    [PendencyStatus.TOMORROW]: { 
        icon: TrendingUp, 
        colorName: 'yellow',
        activeClass: 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500'
    },
    [PendencyStatus.ON_TIME]: { 
        icon: CheckCircle, 
        colorName: 'green',
        activeClass: 'border-green-500 bg-green-50 ring-1 ring-green-500'
    }
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
    const navigate = useNavigate();
    const { config } = useContext(AppContext);
    
    const [allCtes, setAllCtes] = useState<CTE[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    
    // Effective User State to handle fresh data updates
    const [effectiveUser, setEffectiveUser] = useState<User>(user);
    
    // Filters
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('');

    // Define view permission strictly based on EFFECTIVE user
    const isGeneralView = !effectiveUser.linkedDestUnit;

    const load = useCallback(async (force = false) => {
        setLoading(true);
        try {
            const data = await fetchAllData(force);
            
            // SECURITY CHECK
            const freshUser = data.users.find(u => normalizeText(u.username) === normalizeText(user.username));
            const permissionUser = freshUser || user;
            setEffectiveUser(permissionUser);

            let filtered = data.ctes || [];

            // Apply user permission filter
            if (permissionUser.linkedDestUnit) {
                const normalizedUserDest = normalizeText(permissionUser.linkedDestUnit);
                filtered = filtered.filter(c => normalizeText(c.deliveryUnit) === normalizedUserDest);
            } else if (permissionUser.linkedOriginUnit) {
                 const normalizedUserOrigin = normalizeText(permissionUser.linkedOriginUnit);
                filtered = filtered.filter(c => normalizeText(c.collectionUnit) === normalizedUserOrigin);
            }
            
            if (data.config) {
                 const withStatus = filtered.map(c => ({
                    ...c,
                    status: calculateStatus(c, data.config!) || PendencyStatus.ON_TIME
                 }));
                 setAllCtes(withStatus);
            } else {
                setAllCtes(filtered);
            }
        } catch (err) {
            console.error("Failed to load dashboard data", err);
            setAllCtes([]); // Fail safe
        } finally {
            setLoading(false);
        }
    }, [user.username]);

    useEffect(() => {
        load(false);
    }, [load]);

    // Derived unique units for the dropdown
    const uniqueUnits = useMemo(() => {
        const units = new Set(allCtes.map(c => c.deliveryUnit));
        return Array.from(units).filter(Boolean).sort();
    }, [allCtes]);

    const toggleStatusFilter = (status: string) => {
        setSelectedStatuses(prev => {
            const newStatuses = prev.includes(status) 
                ? prev.filter(s => s !== status) 
                : [...prev, status];
            return newStatuses;
        });
    };

    const togglePaymentFilter = (type: string) => {
        setSelectedPayments(prev => {
            const newPayments = prev.includes(type) 
                ? prev.filter(t => t !== type) 
                : [...prev, type];
            return newPayments;
        });
    };

    const clearFilters = () => {
        setSelectedStatuses([]);
        setSelectedPayments([]);
        setSelectedUnitFilter('');
    };

    // Filtros visuais do usuário (INTERSEÇÃO para os Gráficos e KPIs Principais)
    const filteredCtes = useMemo(() => {
        if (!allCtes) return [];
        return allCtes.filter(cte => {
            const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(cte.status);
            const paymentMatch = selectedPayments.length === 0 || selectedPayments.includes(cte.type);
            const unitMatch = selectedUnitFilter === '' || cte.deliveryUnit === selectedUnitFilter;
            return statusMatch && paymentMatch && unitMatch;
        });
    }, [allCtes, selectedStatuses, selectedPayments, selectedUnitFilter]);

    // Generate a stable key that changes ONLY when filters or data length changes
    const filterKey = useMemo(() => {
        return `${selectedStatuses.join('_')}-${selectedPayments.join('_')}-${selectedUnitFilter}-${filteredCtes.length}`;
    }, [selectedStatuses, selectedPayments, selectedUnitFilter, filteredCtes.length]);

    // STATS CALCULATION
    const stats = useMemo(() => {
        const s = {
            totalCount: filteredCtes.length,
            totalValue: 0,
            avgTicket: 0,
            countsByStatus: {} as Record<string, number>,
            countsByPayment: {} as Record<string, number>
        };

        // 1. KPIs Principais (Baseado na INTERSEÇÃO - O que está na tela)
        filteredCtes.forEach(c => {
            const val = typeof c.value === 'number' && !isNaN(c.value) ? c.value : 0;
            s.totalValue += val;
        });
        
        s.avgTicket = s.totalCount > 0 ? s.totalValue / s.totalCount : 0;

        // 2. Contadores dos Botões (Baseado no UNIVERSO DA UNIDADE/FILTRO DE UNIDADE)
        // Correção: Os botões mostram o total da categoria, independente dos outros filtros ativos.
        // Isso evita a confusão matemática "Selecionou 17 mas tem 25".
        
        const universeCtes = selectedUnitFilter 
            ? allCtes.filter(c => c.deliveryUnit === selectedUnitFilter)
            : allCtes;

        universeCtes.forEach(c => {
            const st = c.status || 'DESCONHECIDO';
            const pt = c.type || 'OUTROS';
            s.countsByStatus[st] = (s.countsByStatus[st] || 0) + 1;
            s.countsByPayment[pt] = (s.countsByPayment[pt] || 0) + 1;
        });

        return s;
    }, [filteredCtes, allCtes, selectedUnitFilter]);

    // CHART DATA PREPARATION - Safe aggregation
    const topUnitsByVolume = useMemo(() => {
        const grouped: Record<string, any> = {};
        
        filteredCtes.forEach(c => {
            let key = isGeneralView ? (c.deliveryUnit || 'N/A') : (c.recipient || 'N/A');
            // Sanitize key
            if (typeof key !== 'string' || !key) key = 'N/A';
            
            if (!grouped[key]) {
                grouped[key] = { 
                    name: key, 
                    total: 0, 
                    [PaymentType.CIF]: 0, 
                    [PaymentType.FOB]: 0, 
                    [PaymentType.SENDER]: 0, 
                    [PaymentType.DEST]: 0,
                    'OUTROS': 0
                };
            }
            
            const pType = c.type || 'OUTROS';
            grouped[key].total += 1;
            
            // Safe increment using direct property access if exists, else OTHER
            if (Object.prototype.hasOwnProperty.call(grouped[key], pType)) {
                 grouped[key][pType] += 1;
            } else {
                 grouped[key]['OUTROS'] += 1;
            }
        });

        return Object.values(grouped).sort((a: any, b: any) => b.total - a.total).slice(0, 10);
    }, [filteredCtes, isGeneralView]);

    const topUnitsByValue = useMemo(() => {
        const grouped: Record<string, any> = {};
        filteredCtes.forEach(c => {
            let key = isGeneralView ? (c.deliveryUnit || 'N/A') : (c.recipient || 'N/A');
            if (typeof key !== 'string' || !key) key = 'N/A';

            if (!grouped[key]) {
                grouped[key] = { name: key, value: 0 };
            }
            const val = typeof c.value === 'number' && !isNaN(c.value) ? c.value : 0;
            grouped[key].value += val;
        });
        return Object.values(grouped).sort((a: any, b: any) => b.value - a.value).slice(0, 10);
    }, [filteredCtes, isGeneralView]);

    const pieData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredCtes.forEach(c => {
            const st = c.status || 'DESCONHECIDO';
            counts[st] = (counts[st] || 0) + 1;
        });
        return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
    }, [filteredCtes]);

    const handleGenerateAI = async () => {
        setAnalyzing(true);
        const context = `Análise ${isGeneralView ? 'Rede' : 'Unidade'}. Filtros: ${selectedStatuses.join(', ')} | ${selectedPayments.join(', ')}. Volume: ${stats.totalCount}, Valor: ${formatCurrency(stats.totalValue)}. Top 3 Ofensores: ${topUnitsByVolume.slice(0, 3).map((d: any) => d.name).join(', ')}`;
        const result = await analyzeData(filteredCtes, context);
        setAiAnalysis(result);
        setAnalyzing(false);
    };

    const handleNavigateToList = () => {
        navigate('/pendencias');
    };

    const formatLabel = (value: any) => {
        if (!value) return '';
        const str = String(value);
        return str.length > 10 ? `${str.substring(0, 10)}..` : str;
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50"><div className="flex flex-col items-center gap-3"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div><p className="text-gray-500 font-medium">Carregando dados gerenciais...</p></div></div>;

    return (
        <div className="space-y-6 pb-10">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="text-blue-600" />Dashboard Gerencial</h1>
                    <p className="text-gray-500 text-sm mt-1">{isGeneralView ? 'Visão consolidada da Rede' : `Visão estratégica: ${effectiveUser.linkedDestUnit || effectiveUser.linkedOriginUnit}`}</p>
                </div>
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:w-auto">
                    {isGeneralView && (
                        <div className="relative w-full md:w-64">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <select 
                                value={selectedUnitFilter}
                                onChange={(e) => setSelectedUnitFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                <option value="">Todas as Unidades</option>
                                {uniqueUnits.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(selectedStatuses.length > 0 || selectedPayments.length > 0 || selectedUnitFilter) && (
                        <button onClick={clearFilters} className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm font-bold whitespace-nowrap">
                            <X size={16} /> Limpar
                        </button>
                    )}
                    
                    <button onClick={handleGenerateAI} disabled={analyzing} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all shadow-md disabled:opacity-70 whitespace-nowrap">
                        {analyzing ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        {analyzing ? "Processando..." : "IA Insights (80/20)"}
                    </button>
                    
                    <button onClick={() => load(true)} className="p-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition" title="Forçar Atualização">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {aiAnalysis && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 relative overflow-hidden animate-in slide-in-from-top-5">
                    <div className="flex items-start gap-4 relative z-10">
                        <div className="p-3 bg-white rounded-full shadow-sm text-purple-600"><Sparkles size={24} /></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-purple-900 text-lg mb-2">Análise Inteligente (Pareto)</h3>
                            <div className="prose prose-sm text-purple-800 whitespace-pre-line">{aiAnalysis}</div>
                        </div>
                        <button onClick={() => setAiAnalysis(null)} className="text-purple-400 hover:text-purple-700"><X size={20} /></button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard label="Volume Selecionado" value={stats.totalCount} subLabel="CTEs Pendentes" icon={Package} color="text-blue-600" bgColor="bg-blue-50" />
                <KPICard label="Montante Financeiro" value={formatCurrency(stats.totalValue)} subLabel="Total em Carteira" icon={DollarSign} color="text-emerald-600" bgColor="bg-emerald-50" />
                <KPICard label="Ticket Médio" value={formatCurrency(stats.avgTicket)} subLabel="Por CTE Filtrado" icon={TrendingUp} color="text-purple-600" bgColor="bg-purple-50" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Filter size={14} /> Filtrar por Status (Total da Unidade)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            PendencyStatus.CRITICAL,
                            PendencyStatus.LATE,
                            PendencyStatus.PRIORITY,
                            PendencyStatus.TOMORROW,
                            PendencyStatus.ON_TIME
                        ].map((statusId) => {
                            const isSelected = selectedStatuses.includes(statusId);
                            const styleConfig = STATUS_STYLES[statusId] || STATUS_STYLES[PendencyStatus.ON_TIME];
                            const Icon = styleConfig.icon;
                            
                            let buttonClass = "border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200";
                            let iconClass = "text-gray-400";
                            let indicatorClass = "";
                            let countClass = "text-gray-700";
                            
                            if (isSelected) {
                                buttonClass = styleConfig.activeClass;
                                if (styleConfig.colorName === 'red') { iconClass = "text-red-600"; indicatorClass = "bg-red-500"; }
                                if (styleConfig.colorName === 'orange') { iconClass = "text-orange-600"; indicatorClass = "bg-orange-500"; }
                                if (styleConfig.colorName === 'yellow') { iconClass = "text-yellow-600"; indicatorClass = "bg-yellow-500"; }
                                if (styleConfig.colorName === 'green') { iconClass = "text-green-600"; indicatorClass = "bg-green-500"; }
                                countClass = "text-gray-900";
                            }

                            return (
                                <button 
                                    key={statusId} 
                                    onClick={() => toggleStatusFilter(statusId)} 
                                    className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-left flex flex-col justify-between h-24 ${buttonClass}`}
                                >
                                    <div className="flex justify-between items-start w-full">
                                        <Icon size={18} className={iconClass} />
                                        {isSelected && <div className={`w-2 h-2 rounded-full ${indicatorClass}`} />}
                                    </div>
                                    <div>
                                        <span className={`text-xl font-bold block ${countClass}`}>
                                            {stats.countsByStatus[statusId] || 0}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 truncate w-full block">
                                            {statusId}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="xl:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><DollarSign size={14} /> Tipo de Pagamento (Total)</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[ 
                            { id: PaymentType.CIF, label: 'CIF' }, 
                            { id: PaymentType.FOB, label: 'FOB' }, 
                            { id: PaymentType.SENDER, label: 'FATURAR_REMETENTE' }, 
                            { id: PaymentType.DEST, label: 'FATURAR_DEST' } 
                        ].map(p => {
                            const isSelected = selectedPayments.includes(p.id);
                            return (
                                <button key={p.id} onClick={() => togglePaymentFilter(p.id)} className={`p-3 rounded-xl border transition-all text-center ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                                    <span className="block text-lg font-bold">{stats.countsByPayment[p.id] || 0}</span>
                                    <span className={`text-[9px] uppercase font-bold ${isSelected ? 'text-blue-200' : 'text-gray-400'} block truncate`}>{p.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* CHART: VOLUME */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={20} className="text-blue-500" /> Volume de Pendências</h3>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">Top 10</span>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                key={`vol-${filterKey}`}
                                data={topUnitsByVolume} 
                                margin={{ top: 20, right: 10, left: 0, bottom: 70 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#6B7280'}} 
                                    interval={0} 
                                    angle={-45} 
                                    textAnchor="end"
                                    tickFormatter={formatLabel}
                                    height={70}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#6B7280'}} width={30} />
                                <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', bottom: 0}} />
                                <Bar dataKey={PaymentType.CIF} stackId="a" fill={PAYMENT_COLORS[PaymentType.CIF]} name="CIF" />
                                <Bar dataKey={PaymentType.FOB} stackId="a" fill={PAYMENT_COLORS[PaymentType.FOB]} name="FOB" />
                                <Bar dataKey={PaymentType.SENDER} stackId="a" fill={PAYMENT_COLORS[PaymentType.SENDER]} name="FATURAR_REMETENTE" />
                                <Bar dataKey={PaymentType.DEST} stackId="a" fill={PAYMENT_COLORS[PaymentType.DEST]} name="FATURAR_DEST" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* CHART: VALUE */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign size={20} className="text-emerald-500" /> Valor Financeiro</h3>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">Top 10</span>
                    </div>
                    <div className="h-80 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                key={`val-${filterKey}`}
                                data={topUnitsByValue} 
                                margin={{ top: 20, right: 10, left: 0, bottom: 70 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#6B7280'}} 
                                    interval={0} 
                                    angle={-45} 
                                    textAnchor="end"
                                    tickFormatter={formatLabel}
                                    height={70}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#6B7280'}} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} width={40} />
                                <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} formatter={(val: number) => formatCurrency(val)} />
                                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} name="Valor Total" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* CHART: SHARE */}
                <div className="xl:col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><PieIcon size={20} className="text-purple-500" /> Share por Status</h3>
                    <div className="h-64 relative w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart key={`pie-${filterKey}`}>
                                <Pie 
                                    data={pieData} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || STATUS_COLORS['DEFAULT']} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold text-gray-800">{stats.totalCount}</span>
                            <span className="text-xs text-gray-400 uppercase">Pendências</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {pieData.map(p => (
                            <div key={p.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: STATUS_COLORS[p.name] || STATUS_COLORS['DEFAULT']}}></div>
                                {p.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {filteredCtes.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800">Top Ofensores (Seleção Atual)</h3><button onClick={handleNavigateToList} className="text-sm font-bold text-blue-600 hover:text-blue-800">Ver Lista Completa &rarr;</button></div>
                    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500 font-medium"><tr><th className="px-6 py-3">CTE</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Pagamento</th><th className="px-6 py-3">Entidade</th><th className="px-6 py-3 text-right">Valor</th></tr></thead><tbody className="divide-y divide-gray-50">{filteredCtes.sort((a,b) => b.value - a.value).slice(0, 5).map(cte => (<tr key={cte.id} className="hover:bg-gray-50 transition"><td className="px-6 py-3 font-medium text-gray-900">{cte.cteNumber}</td><td className="px-6 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">{cte.status}</span></td><td className="px-6 py-3 text-gray-600">{cte.type}</td><td className="px-6 py-3 text-gray-600 truncate max-w-[200px]">{isGeneralView ? cte.deliveryUnit : cte.recipient}</td><td className="px-6 py-3 text-right font-bold text-gray-900">{formatCurrency(cte.value)}</td></tr>))}</tbody></table></div>
                </div>
            )}
        </div>
    );
};

const KPICard = ({ label, value, subLabel, icon: Icon, color, bgColor }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition"><div className={`w-14 h-14 rounded-xl flex items-center justify-center ${bgColor} ${color}`}><Icon size={28} /></div><div><p className="text-sm font-medium text-gray-500">{label}</p><h2 className="text-3xl font-bold text-gray-900">{value}</h2><p className="text-xs text-gray-400 mt-1">{subLabel}</p></div></div>
);

export default Dashboard;