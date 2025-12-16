import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { User, CTE, PendencyStatus, PaymentType } from '../types';
import { fetchAllData, normalizeText } from '../services/api';
import { calculateStatus, getStatusColor, formatCurrency, parseDate } from '../utils/calculations';
import { AppContext } from '../App';
import { Search, MessageSquare, Filter, X, ArrowDownToLine, ArrowUpFromLine, CheckCircle, Download, Building2, Globe, AlertCircle, Layers } from 'lucide-react';
import NoteModal from '../components/NoteModal';
import * as XLSX from 'xlsx';

interface PendingListProps {
    user: User;
    filterType: 'ALL' | 'CRITICAL' | 'SEARCH';
    data?: { ctes: CTE[], config: any };
}

type ViewMode = 'ALL' | 'INCOMING' | 'OUTGOING';

const PendingList: React.FC<PendingListProps> = ({ user, filterType, data: parentData }) => {
    const location = useLocation();
    
    // Estado local
    const [localCtes, setLocalCtes] = useState<CTE[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(!parentData);
    
    // --- LÓGICA DE PERFIL DO USUÁRIO ---
    const isUnitUser = !!(user.linkedDestUnit || user.linkedOriginUnit);
    
    // Filtros de Visualização (Default: Chegando)
    const [viewMode, setViewMode] = useState<ViewMode>('INCOMING');
    const [selectedUnitFilter, setSelectedUnitFilter] = useState('');
    const [activeFilter, setActiveFilter] = useState<{ status?: string, paymentType?: string } | null>(null);

    const [selectedCte, setSelectedCte] = useState<CTE | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Configuração inicial do ViewMode
    useEffect(() => {
        if (filterType === 'SEARCH') {
            setViewMode('ALL'); 
        } else {
            setViewMode('INCOMING');
        }
    }, [filterType]);

    // Filtros vindos da navegação
    useEffect(() => {
        if (location.state) {
            const { status, paymentType } = location.state as any;
            if (status || paymentType) {
                setActiveFilter({ status, paymentType });
            } else {
                setActiveFilter(null);
            }
        }
    }, [location.state]);

    // Carregamento de dados
    const loadData = useCallback(async (forceRefresh = false) => {
        try {
            if (parentData && !forceRefresh) {
                setLocalCtes(parentData.ctes);
                setLoading(false);
                return;
            }
            const data = await fetchAllData(forceRefresh);
            let filtered = data.ctes;
            if (data.config) {
                filtered = filtered.map(c => ({
                    ...c,
                    status: calculateStatus(c, data.config!),
                }));
            }
            setLocalCtes(filtered);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }, [parentData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const sourceCtes = parentData ? parentData.ctes : localCtes;

    // Lista de Unidades para Admin
    const uniqueDestUnits = useMemo(() => {
        const units = new Set(sourceCtes.map(c => c.deliveryUnit));
        return Array.from(units).filter(Boolean).sort();
    }, [sourceCtes]);

    // --- LÓGICA DE FILTRAGEM ---
    const processedList = useMemo(() => {
        let list = sourceCtes;

        // 1. FILTRO DE TIPO GLOBAL
        if (filterType === 'CRITICAL') {
            list = list.filter(c => c.status === PendencyStatus.CRITICAL && !c.isSearch);
        } else if (filterType === 'ALL') {
            list = list.filter(c => c.status !== PendencyStatus.CRITICAL && !c.isSearch);
        } else if (filterType === 'SEARCH') {
            list = list.filter(c => c.isSearch);
        }

        // 2. FILTRO DE UNIDADE E PERMISSÃO
        if (filterType === 'SEARCH') {
            // Nenhuma restrição aplicada. Mostra tudo.
        } else {
            if (isUnitUser) {
                list = list.filter(c => {
                    const matchesDest = normalizeText(c.deliveryUnit) === normalizeText(user.linkedDestUnit!);
                    const matchesOrigin = normalizeText(c.collectionUnit) === normalizeText(user.linkedOriginUnit!);

                    if (viewMode === 'INCOMING') return matchesDest;
                    if (viewMode === 'OUTGOING') return matchesOrigin;
                    return matchesDest || matchesOrigin; 
                });
            } else {
                if (selectedUnitFilter) {
                    list = list.filter(c => normalizeText(c.deliveryUnit) === normalizeText(selectedUnitFilter));
                }
            }
        }

        // 3. SUB-FILTROS
        if (activeFilter) {
            if (activeFilter.status) list = list.filter(c => c.status === activeFilter.status);
            if (activeFilter.paymentType) list = list.filter(c => c.type === activeFilter.paymentType);
        }

        // 4. BUSCA TEXTUAL
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(c => 
                (c.cteNumber || '').includes(lower) || 
                (c.recipient || '').toLowerCase().includes(lower) ||
                (c.collectionUnit || '').toLowerCase().includes(lower) ||
                (c.deliveryUnit || '').toLowerCase().includes(lower)
            );
        }

        // Ordenação
        list.sort((a, b) => {
            const dateA = parseDate(a.limitDate)?.getTime() || 0;
            const dateB = parseDate(b.limitDate)?.getTime() || 0;
            return dateA - dateB; 
        });

        return list;

    }, [sourceCtes, isUnitUser, user, viewMode, activeFilter, filterType, searchTerm, selectedUnitFilter]);


    const handleOpenModal = (cte: CTE) => {
        setSelectedCte(cte);
        setIsModalOpen(true);
    };

    const toggleFilterStatus = (status: string) => {
        setActiveFilter(prev => ({ ...prev, status: prev?.status === status ? undefined : status }));
    };

    const toggleFilterPayment = (type: string) => {
        setActiveFilter(prev => ({ ...prev, paymentType: prev?.paymentType === type ? undefined : type }));
    };

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const handleExport = () => {
        const dataToExport = processedList.map(c => ({
            "CTE": c.cteNumber,
            "Série": c.serie,
            "Status": c.status,
            "Destinatário": c.recipient,
            "Origem": c.collectionUnit,
            "Destino": c.deliveryUnit,
            "Data Limite": formatDisplayDate(c.limitDate),
            "Valor": c.value,
            "Tipo Pagamento": c.type,
            "Última Justificativa": c.justification || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pendências");
        XLSX.writeFile(wb, `pendencias_${filterType.toLowerCase()}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const getTitle = () => {
        if (filterType === 'CRITICAL') return 'Pendências Críticas';
        if (filterType === 'SEARCH') return 'Mercadorias em Busca';
        return 'Minhas Pendências';
    };

    const handleNoteAdded = async () => {
        await loadData(true);
    };

    if (loading) return <div className="p-12 text-center text-gray-500 flex flex-col items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>Carregando dados...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col gap-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-800">{getTitle()}</h1>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{processedList.length}</span> registros encontrados
                        </p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-stretch md:items-center">
                        
                        {!isUnitUser && filterType !== 'SEARCH' && (
                            <div className="relative md:w-56">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <select
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 shadow-sm appearance-none cursor-pointer"
                                    value={selectedUnitFilter}
                                    onChange={(e) => setSelectedUnitFilter(e.target.value)}
                                >
                                    <option value="">Todas as Unidades</option>
                                    {uniqueDestUnits.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder={filterType === 'SEARCH' ? "Buscar globalmente..." : "Buscar na lista..."}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 placeholder-gray-400 shadow-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <button onClick={handleExport} className="p-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm border border-gray-200 flex items-center justify-center gap-2 px-4" title="Exportar Excel">
                            <Download size={20} />
                            <span className="md:hidden">Exportar Excel</span>
                        </button>
                    </div>
                </div>

                {filterType !== 'SEARCH' && (
                    <div className="flex flex-wrap gap-2">
                        {filterType === 'ALL' && (
                            <>
                                <FilterChip label="Fora do Prazo" isActive={activeFilter?.status === PendencyStatus.LATE} onClick={() => toggleFilterStatus(PendencyStatus.LATE)} color="red" />
                                <FilterChip label="Prioridade" isActive={activeFilter?.status === PendencyStatus.PRIORITY} onClick={() => toggleFilterStatus(PendencyStatus.PRIORITY)} color="orange" />
                                <FilterChip label="Vence Amanhã" isActive={activeFilter?.status === PendencyStatus.TOMORROW} onClick={() => toggleFilterStatus(PendencyStatus.TOMORROW)} color="yellow" />
                                <FilterChip label="No Prazo" isActive={activeFilter?.status === PendencyStatus.ON_TIME} onClick={() => toggleFilterStatus(PendencyStatus.ON_TIME)} color="green" />
                            </>
                        )}
                        <div className="w-px bg-gray-300 mx-2 hidden md:block"></div>
                        <FilterChip label="CIF" isActive={activeFilter?.paymentType === PaymentType.CIF} onClick={() => toggleFilterPayment(PaymentType.CIF)} color="gray" />
                        <FilterChip label="FOB" isActive={activeFilter?.paymentType === PaymentType.FOB} onClick={() => toggleFilterPayment(PaymentType.FOB)} color="gray" />
                        <FilterChip label="Remetente" isActive={activeFilter?.paymentType === PaymentType.SENDER} onClick={() => toggleFilterPayment(PaymentType.SENDER)} color="gray" />
                        <FilterChip label="Destinatário" isActive={activeFilter?.paymentType === PaymentType.DEST} onClick={() => toggleFilterPayment(PaymentType.DEST)} color="gray" />
                        
                        {activeFilter && (activeFilter.status || activeFilter.paymentType) && (
                            <button onClick={() => setActiveFilter(null)} className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-xs font-bold hover:bg-gray-200 flex items-center gap-1 transition-colors">
                                <X size={12} /> Limpar
                            </button>
                        )}
                    </div>
                )}
            </header>

            {isUnitUser && filterType !== 'SEARCH' && (
                <div className="flex p-1 bg-gray-200 rounded-lg w-fit">
                    <button onClick={() => setViewMode('ALL')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                        <Layers size={16} /> Ambos
                    </button>
                    <button onClick={() => setViewMode('INCOMING')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'INCOMING' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                        <ArrowDownToLine size={16} /> Chegando
                    </button>
                    <button onClick={() => setViewMode('OUTGOING')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'OUTGOING' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                        <ArrowUpFromLine size={16} /> Saindo
                    </button>
                </div>
            )}

            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left table-auto">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 w-32 whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 whitespace-nowrap">CTE / Série</th>
                                <th className="px-6 py-4 whitespace-nowrap">Destinatário</th>
                                <th className="px-6 py-4 whitespace-nowrap">Origem / Destino</th>
                                <th className="px-6 py-4 whitespace-nowrap">Prazo</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Valor</th>
                                <th className="px-6 py-4 text-center w-24 sticky right-0 bg-gray-50 z-10">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {processedList.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <AlertCircle size={48} className="mb-2 opacity-20" />
                                            <p>Nenhum registro encontrado para os filtros selecionados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                processedList.map(cte => (
                                    <tr key={cte.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${getStatusColor(cte.status as PendencyStatus)}`}>{cte.status}</span>
                                            <div className="mt-1"><span className="text-[10px] text-gray-400 uppercase font-bold">{cte.type?.replace('FATURAR_', '')}</span></div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                            {cte.cteNumber} 
                                            <span className="text-gray-400 font-normal ml-1">/ {cte.serie}</span>
                                            {cte.isSearch && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold border border-purple-200">BUSCA</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={cte.recipient}>{cte.recipient}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="flex flex-col text-xs">
                                                <span className="whitespace-nowrap text-gray-400">DE: <span className="text-gray-600">{cte.collectionUnit}</span></span>
                                                <span className="whitespace-nowrap text-gray-400">PARA: <span className="font-bold text-gray-800">{cte.deliveryUnit}</span></span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap font-medium">{formatDisplayDate(cte.limitDate)}</td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(cte.value)}</td>
                                        <td className="px-6 py-4 text-center sticky right-0 bg-white group-hover:bg-gray-50 transition-colors z-10">
                                            <button 
                                                onClick={() => handleOpenModal(cte)} 
                                                className="relative p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition shadow-sm border border-blue-100 flex items-center justify-center mx-auto" 
                                                title="Inserir Justificativa"
                                            >
                                                <MessageSquare size={20} className={cte.notesCount > 0 ? "fill-blue-200" : ""} />
                                                {cte.notesCount > 0 && (
                                                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                                                        {cte.notesCount > 9 ? '9+' : cte.notesCount}
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="md:hidden space-y-4">
                {processedList.map(cte => (
                    <div key={cte.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${getStatusColor(cte.status as PendencyStatus)} mb-2`}>{cte.status}</span>
                                <h3 className="font-bold text-gray-900">CTE {cte.cteNumber}</h3>
                                <p className="text-xs text-gray-500">Série {cte.serie}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-900">{formatCurrency(cte.value)}</p>
                                <p className="text-xs text-gray-500 whitespace-nowrap">{formatDisplayDate(cte.limitDate)}</p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-gray-50">
                            <p className="text-sm text-gray-700 font-medium truncate">{cte.recipient}</p>
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-xs text-gray-500">{cte.deliveryUnit}</p>
                                <button onClick={() => handleOpenModal(cte)} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 font-bold px-3 py-2 rounded-lg hover:bg-blue-100 transition shadow-sm relative">
                                    <MessageSquare size={18} /> Justificativa
                                    {cte.notesCount > 0 && (
                                        <span className="ml-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                            {cte.notesCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <NoteModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                cte={selectedCte} 
                currentUser={user.username} 
                onNoteAdded={handleNoteAdded} 
            />
        </div>
    );
};

const FilterChip = ({ label, isActive, onClick, color }: any) => {
    const baseStyle = "px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer select-none flex items-center gap-1.5";
    let activeStyle = "";
    let inactiveStyle = "bg-white border-gray-200 text-gray-500 hover:border-gray-300";
    if (color === 'red') activeStyle = "bg-red-100 border-red-200 text-red-700";
    if (color === 'orange') activeStyle = "bg-orange-100 border-orange-200 text-orange-700";
    if (color === 'yellow') activeStyle = "bg-yellow-100 border-yellow-200 text-yellow-800";
    if (color === 'green') activeStyle = "bg-green-100 border-green-200 text-green-700";
    if (color === 'gray') activeStyle = "bg-gray-800 border-gray-800 text-white";
    return <div onClick={onClick} className={`${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}>{label}{isActive && <CheckCircle size={12} />}</div>;
};

export default PendingList;