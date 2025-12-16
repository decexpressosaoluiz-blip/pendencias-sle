import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, ClipboardList, AlertTriangle, Search, Settings, 
  LogOut, Key, Menu, X 
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
    user: User;
    onLogout: () => void;
    counts?: {
        pending: number;
        critical: number;
        search: number;
    };
}

const Sidebar = ({ user, onLogout, counts }: SidebarProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggle = () => setIsOpen(!isOpen);

    const baseClass = "flex items-center gap-3 px-4 py-3 transition-colors rounded-lg mb-1 relative";
    const activeClass = "bg-blue-600 text-white shadow-md";
    const inactiveClass = "text-gray-400 hover:bg-gray-800 hover:text-white";

    const Badge = ({ count, color }: { count: number, color: string }) => {
        // Se count for undefined ou 0, não mostra o badge
        if (!count || count <= 0) return null;
        return (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold rounded-full text-white ${color}`}>
                {count > 99 ? '99+' : count}
            </span>
        );
    };

    const NavItem = ({ to, icon: Icon, label, count, badgeColor }: { to: string, icon: any, label: string, count?: number, badgeColor?: string }) => (
        <NavLink 
            to={to} 
            className={({ isActive }) => `${baseClass} ${isActive ? activeClass : inactiveClass}`}
            onClick={() => setIsOpen(false)} // Close on mobile click
        >
            <Icon size={20} />
            <span className="font-medium">{label}</span>
            {count !== undefined && <Badge count={count} color={badgeColor || 'bg-gray-500'} />}
        </NavLink>
    );

    return (
        <>
            {/* Mobile Header Bar - Fixed at top to prevent overlap */}
            <div className="lg:hidden fixed top-0 left-0 w-full bg-gray-900 z-50 px-4 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                     <button onClick={toggle} className="text-white">
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <span className="text-white font-bold text-lg">São Luiz Express</span>
                </div>
            </div>

            {/* Spacer for Mobile Header */}
            <div className="lg:hidden h-14"></div>

            {/* Sidebar Container */}
            <aside className={`
                fixed top-0 left-0 h-full bg-gray-900 text-gray-100 z-40 transition-transform duration-300 w-64 pt-16 lg:pt-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex flex-col h-full">
                    <div className="hidden lg:block p-6 border-b border-gray-800">
                        <h1 className="text-xl font-bold tracking-tight text-white">
                            São Luiz <span className="text-blue-500">Express</span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">Sistema de Pendências</p>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-6 px-3">
                        <NavItem to="/dashboard" icon={Home} label="Visão Geral" />
                        
                        <NavItem 
                            to="/pendencias" 
                            icon={ClipboardList} 
                            label="Pendências" 
                            count={counts?.pending}
                            badgeColor="bg-blue-500"
                        />
                        
                        <NavItem 
                            to="/criticos" 
                            icon={AlertTriangle} 
                            label="Críticos" 
                            count={counts?.critical}
                            badgeColor="bg-red-600"
                        />
                        
                        <NavItem 
                            to="/em-busca" 
                            icon={Search} 
                            label="Em Busca" 
                            count={counts?.search}
                            badgeColor="bg-yellow-500 text-black"
                        />
                        
                        {user.role === 'ADMIN' && (
                            <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
                        )}
                        
                        <div className="my-4 border-t border-gray-800"></div>
                        
                        <NavItem to="/alterar-senha" icon={Key} label="Alterar Senha" />
                        <button 
                            onClick={onLogout} 
                            className={`${baseClass} ${inactiveClass} w-full text-left`}
                        >
                            <LogOut size={20} />
                            <span>Sair</span>
                        </button>
                    </nav>

                    <div className="p-4 border-t border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium truncate text-white">{user.username}</p>
                                <p className="text-xs text-gray-500 truncate">{user.role}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
            
            {/* Overlay for mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
};

export default Sidebar;