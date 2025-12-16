import React, { useEffect, useState, createContext, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PendingList from './pages/PendingList';
import SettingsPage from './pages/Settings';
import ChangePassword from './pages/ChangePassword';
import Login from './pages/Login';
import NoteModal from './components/NoteModal';
import { getCurrentUser, logout } from './services/authService';
import { User, AppConfig, PendencyStatus, CTE } from './types';
import { fetchAllData, normalizeText } from './services/api';
import { calculateStatus } from './utils/calculations';
import { Bell, X, Check, AlertTriangle, Search as SearchIcon } from 'lucide-react';

// --- Global Context ---
interface AppContextType {
    config: AppConfig | null;
    triggerGlobalAlert: () => void;
}
export const AppContext = createContext<AppContextType>({ config: null, triggerGlobalAlert: () => {} });

// --- Protected Route ---
const ProtectedRoute = ({ children, user }: { children: React.ReactNode; user: User | null }) => {
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

// --- Helper Components ---
const TopHeader = ({ title, counts, onNotificationClick, isPanelOpen }: any) => {
    const totalUnread = (counts?.search || 0) + (counts?.critical || 0);
    return (
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            <div className="flex items-center gap-4">
                <button onClick={onNotificationClick} className={`relative p-2 rounded-full transition-colors ${isPanelOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}>
                    <Bell size={24} />
                    {totalUnread > 0 && <span className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">{totalUnread > 99 ? '99+' : totalUnread}</span>}
                </button>
            </div>
        </div>
    );
};

// Componente de Notificação Atualizado
const NotificationPanel = ({ isOpen, onClose, notifications = [], onMarkRead, onMarkAllRead, onItemClick, readIds = [] }: any) => {
    if (!isOpen) return null;
    
    const list = Array.isArray(notifications) ? notifications : [];

    return (
        <>
            {/* Backdrop para fechar ao clicar fora */}
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            
            <div className="absolute top-16 right-4 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in slide-in-from-top-5 max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold text-gray-800">Notificações</h3>
                    <div className="flex gap-2">
                        {list.some((n: any) => !readIds.includes(n.id)) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onMarkAllRead(); }} 
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                <Check size={14} /> Marcar todas
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {list.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Nenhuma notificação nova.</div>
                    ) : (
                        list.map((n: any) => {
                            const isRead = readIds.includes(n.id);
                            return (
                                <div 
                                    key={n.id} 
                                    className={`p-3 rounded-lg flex gap-3 cursor-pointer transition-all ${
                                        isRead 
                                            ? 'bg-gray-50 border border-transparent opacity-75 hover:bg-gray-100 hover:opacity-100' 
                                            : 'bg-white border-l-4 border-l-blue-500 shadow-sm border-t border-r border-b border-gray-100 hover:shadow-md'
                                    }`}
                                    onClick={() => onItemClick(n)}
                                >
                                    <div className={`mt-1 min-w-[24px] h-6 rounded-full flex items-center justify-center ${
                                        isRead 
                                            ? 'bg-gray-200 text-gray-400' 
                                            : n.isSearch ? 'bg-red-200 text-red-700' : 'bg-red-100 text-red-600'
                                    }`}>
                                        {n.isSearch ? <SearchIcon size={14} /> : <AlertTriangle size={14} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className={`text-sm ${isRead ? 'font-medium text-gray-500' : 'font-bold text-gray-800'}`}>
                                                {n.isSearch ? 'Mercadoria em Busca' : 'Pendência Crítica'}
                                            </p>
                                            {!isRead && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
                                                    className="text-[10px] text-gray-400 hover:text-blue-600 p-1"
                                                    title="Marcar como lida"
                                                >
                                                    <Check size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <p className={`text-xs ${isRead ? 'text-gray-400' : 'text-gray-600'}`}>CTE {n.cteNumber}</p>
                                        <p className="text-[10px] text-gray-400 mt-1 truncate">{n.recipient}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
};

const Layout = ({ children, user, onLogout, counts, notificationState }: any) => {
    const location = useLocation();
    let title = "Dashboard";
    if (location.pathname.includes('pendencias')) title = "Pendências";
    if (location.pathname.includes('criticos')) title = "Pendências Críticas";
    if (location.pathname.includes('em-busca')) title = "Mercadorias em Busca";
    if (location.pathname.includes('configuracoes')) title = "Configurações";
    if (location.pathname.includes('alterar-senha')) title = "Alterar Senha";

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar user={user} onLogout={onLogout} counts={counts} />
            <main className="flex-1 lg:ml-64 p-4 lg:p-8 overflow-x-hidden relative">
                <TopHeader title={title} counts={notificationState.counts} onNotificationClick={notificationState.togglePanel} isPanelOpen={notificationState.isOpen} />
                <NotificationPanel {...notificationState} />
                {children}
            </main>
        </div>
    );
};

const getSafeUser = (): User | null => {
    try {
        const u = getCurrentUser();
        if (!u || !u.username) return null;
        return u;
    } catch {
        return null;
    }
};

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(getSafeUser);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [alertActive, setAlertActive] = useState(false);
    
    const [sidebarCounts, setSidebarCounts] = useState({ pending: 0, critical: 0, search: 0 });
    const [rawNotificationItems, setRawNotificationItems] = useState<CTE[]>([]);
    const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

    // Estado para o Modal Global de Notificações
    const [selectedNotificationCte, setSelectedNotificationCte] = useState<CTE | null>(null);
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

    const audioRef = useRef(new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'));

    const triggerGlobalAlert = () => setAlertActive(true);

    useEffect(() => {
        if (user?.username) {
            const stored = localStorage.getItem(`sle_read_notifications_${user.username}`);
            if (stored) setReadNotificationIds(JSON.parse(stored));
        }
    }, [user?.username]);

    useEffect(() => {
        if (!user) return;

        const fetchData = async (force = false) => {
            try {
                const data = await fetchAllData(force);
                setConfig(data.config);

                const freshUser = data.users.find(u => normalizeText(u.username) === normalizeText(user.username));
                
                if (freshUser) {
                    const hasRoleChanged = freshUser.role !== user.role;
                    const hasOriginChanged = freshUser.linkedOriginUnit !== user.linkedOriginUnit;
                    const hasDestChanged = freshUser.linkedDestUnit !== user.linkedDestUnit;
                    
                    if (hasRoleChanged || hasOriginChanged || hasDestChanged) {
                        // SEGURANÇA CRÍTICA: Proteção contra apagamento acidental de unidades
                        const isProtectedRole = user.role === 'UNIDADE' || user.role === 'unidade';
                        const isBecomingOrphan = !freshUser.linkedOriginUnit && !freshUser.linkedDestUnit;
                        
                        if (isProtectedRole && isBecomingOrphan && !hasRoleChanged) {
                            setUser(prev => ({ 
                                ...prev!, 
                                ...freshUser,
                                linkedOriginUnit: user.linkedOriginUnit, 
                                linkedDestUnit: user.linkedDestUnit 
                            }));
                        } else {
                            setUser(prev => ({ ...prev!, ...freshUser }));
                        }
                    }
                }

                if (data.config) {
                    const processedCtes = data.ctes.map(c => {
                        const relatedNotes = data.notes.filter(n => n.cteId === c.id);
                        const isSearch = c.isSearch || relatedNotes.some(n => n.isSearchProcess) || c.status === 'EM BUSCA';
                        return { ...c, status: calculateStatus(c, data.config!), isSearch };
                    });

                    let filtered = processedCtes;
                    const currentUser = freshUser || user;
                    
                    if (currentUser?.linkedDestUnit) {
                         filtered = filtered.filter(c => normalizeText(c.deliveryUnit) === normalizeText(currentUser.linkedDestUnit!));
                    } else if (currentUser?.linkedOriginUnit) {
                         filtered = filtered.filter(c => normalizeText(c.collectionUnit) === normalizeText(currentUser.linkedOriginUnit!));
                    }

                    const crit = filtered.filter(c => c.status === PendencyStatus.CRITICAL && !c.isSearch).length;
                    const pend = filtered.filter(c => c.status !== PendencyStatus.CRITICAL && !c.isSearch).length;
                    const srch = processedCtes.filter(c => c.isSearch).length;

                    setSidebarCounts({ pending: pend, critical: crit, search: srch });
                    
                    const notifs = [
                        ...processedCtes.filter(c => c.isSearch),
                        ...filtered.filter(c => c.status === PendencyStatus.CRITICAL && !c.isSearch)
                    ];
                    setRawNotificationItems(notifs);
                }
            } catch (e) {
                console.error("Data sync error:", e);
            }
        };

        fetchData();
        const interval = setInterval(() => fetchData(true), 60000);
        return () => clearInterval(interval);
    }, [user?.username]);

    useEffect(() => {
        if (alertActive) {
            const playSound = () => audioRef.current.play().catch(() => {});
            playSound();
            const interval = setInterval(playSound, 3000);
            return () => clearInterval(interval);
        }
    }, [alertActive]);

    const handleLogout = () => {
        logout();
        setUser(null);
    };

    const notificationState = {
        isOpen: isNotificationPanelOpen,
        togglePanel: () => setIsNotificationPanelOpen(!isNotificationPanelOpen),
        onClose: () => setIsNotificationPanelOpen(false),
        // CORREÇÃO: Passa TODOS os itens para manter histórico, mas ordena os não lidos primeiro
        notifications: rawNotificationItems.sort((a, b) => {
            const isReadA = readNotificationIds.includes(a.id);
            const isReadB = readNotificationIds.includes(b.id);
            if (isReadA === isReadB) return 0;
            return isReadA ? 1 : -1;
        }),
        readIds: readNotificationIds,
        // Mantém a contagem de badge apenas para não lidos
        counts: { 
            search: (rawNotificationItems || []).filter(n => n.isSearch && !(readNotificationIds || []).includes(n.id)).length, 
            critical: (rawNotificationItems || []).filter(n => !n.isSearch && !(readNotificationIds || []).includes(n.id)).length 
        },
        markRead: (id: string) => {
            const newIds = [...readNotificationIds, id];
            setReadNotificationIds(newIds);
            localStorage.setItem(`sle_read_notifications_${user?.username}`, JSON.stringify(newIds));
        },
        // CORREÇÃO: Garante que todos os IDs atuais sejam marcados
        onMarkAllRead: () => {
            const currentIds = rawNotificationItems.map(n => n.id);
            const allReadIds = Array.from(new Set([...readNotificationIds, ...currentIds]));
            setReadNotificationIds(allReadIds);
            localStorage.setItem(`sle_read_notifications_${user?.username}`, JSON.stringify(allReadIds));
        },
        // CORREÇÃO: Ação ao clicar no item da notificação
        onItemClick: (cte: CTE) => {
            // Marca como lida
            const newIds = [...readNotificationIds, cte.id];
            setReadNotificationIds(newIds);
            localStorage.setItem(`sle_read_notifications_${user?.username}`, JSON.stringify(newIds));
            
            // Fecha painel
            setIsNotificationPanelOpen(false);
            
            // Abre Modal Global
            setSelectedNotificationCte(cte);
            setIsGlobalModalOpen(true);
        }
    };

    return (
        <AppContext.Provider value={{ config, triggerGlobalAlert }}>
            <Router>
                {/* Modal Global para Notificações */}
                <NoteModal 
                    isOpen={isGlobalModalOpen} 
                    onClose={() => setIsGlobalModalOpen(false)} 
                    cte={selectedNotificationCte} 
                    currentUser={user?.username || ''}
                    onNoteAdded={async () => {
                        // Refresh silencioso se necessário
                    }}
                />

                {alertActive && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/90 backdrop-blur-sm animate-pulse">
                        <div className="bg-white p-8 rounded-2xl text-center">
                            <h2 className="text-2xl font-bold text-red-600 mb-4">ALERTA DE MERCADORIA EM BUSCA</h2>
                            <button onClick={() => setAlertActive(false)} className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold">CIENTE</button>
                        </div>
                    </div>
                )}
                <Routes>
                    <Route path="/login" element={<Login onLogin={setUser} />} />
                    <Route path="/*" element={
                        <ProtectedRoute user={user}>
                            <Layout user={user} onLogout={handleLogout} counts={sidebarCounts} notificationState={notificationState}>
                                <Routes>
                                    <Route path="/" element={<Navigate to="/dashboard" />} />
                                    <Route path="/dashboard" element={<Dashboard user={user!} />} />
                                    <Route path="/pendencias" element={<PendingList user={user!} filterType="ALL" />} />
                                    <Route path="/criticos" element={<PendingList user={user!} filterType="CRITICAL" />} />
                                    <Route path="/em-busca" element={<PendingList user={user!} filterType="SEARCH" />} />
                                    <Route path="/configuracoes" element={<SettingsPage user={user!} />} />
                                    <Route path="/alterar-senha" element={<ChangePassword />} />
                                </Routes>
                            </Layout>
                        </ProtectedRoute>
                    } />
                </Routes>
            </Router>
        </AppContext.Provider>
    );
};

export default App;