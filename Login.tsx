import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import { User } from '../types';
import { Truck, User as UserIcon, Lock, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

export interface LoginProps {
    onLogin?: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!username.trim() || !password.trim()) {
            setError('Por favor, preencha todos os campos.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await login({ username, password });
            
            if (response.success && response.user) {
                if (onLogin) onLogin(response.user);
                navigate('/dashboard', { replace: true });
            } else {
                setError(response.message || 'Usuário ou senha incorretos.');
            }
        } catch (err: any) {
            console.error("Login page error:", err);
            setError(err.message || 'Erro de conexão. Verifique sua internet.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F2F2F8] flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md transition-all duration-500 transform hover:shadow-[0_20px_50px_rgba(46,49,180,0.1)] border border-slate-100">
                
                <div className="text-center mb-10">
                    <div className="w-24 h-24 bg-[#E5E5F1] rounded-full flex items-center justify-center mx-auto mb-6 text-[#2E31B4] shadow-inner ring-4 ring-white">
                        <Truck size={40} strokeWidth={1.5} />
                    </div>
                    <h1 className="text-3xl font-bold text-[#0F103A] tracking-tight">São Luiz Express</h1>
                    <p className="text-[#6466AD] mt-2 font-medium">Controle de Pendências</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-[#FEEFEF] border border-[#FCD7D9] text-[#EC1B23] text-sm rounded-xl flex items-center justify-center gap-2 font-semibold animate-bounce">
                        <AlertCircle size={20} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#2E31B4] ml-1 uppercase tracking-wide">Usuário</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9899C8] group-focus-within:text-[#4649CF] transition-colors">
                                <UserIcon size={20} />
                            </div>
                            <input 
                                type="text" 
                                className="w-full pl-12 pr-4 py-4 bg-[#FCFCFE] rounded-xl border border-[#CBCCE4] text-[#0F103A] placeholder-[#B2B2D6] focus:ring-4 focus:ring-[#4649CF]/10 focus:border-[#4649CF] outline-none transition-all font-medium disabled:opacity-50"
                                placeholder="Digite seu usuário"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#2E31B4] ml-1 uppercase tracking-wide">Senha</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9899C8] group-focus-within:text-[#4649CF] transition-colors">
                                <Lock size={20} />
                            </div>
                            <input 
                                type="password" 
                                className="w-full pl-12 pr-4 py-4 bg-[#FCFCFE] rounded-xl border border-[#CBCCE4] text-[#0F103A] placeholder-[#B2B2D6] focus:ring-4 focus:ring-[#4649CF]/10 focus:border-[#4649CF] outline-none transition-all font-medium disabled:opacity-50"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 bg-[#2E31B4] hover:bg-[#1A1B62] text-white rounded-xl font-bold text-lg shadow-xl shadow-[#2E31B4]/20 hover:shadow-[#2E31B4]/40 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group cursor-pointer"
                    >
                        {loading ? (
                           <>
                            <RefreshCw size={20} className="animate-spin" />
                            Verificando...
                           </>
                        ) : (
                           <>
                            Acessar Sistema 
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                           </>
                        )}
                    </button>
                </form>

                <div className="mt-8 flex justify-center">
                    <p className="text-xs text-[#7173B4] font-medium">
                        &copy; São Luiz Express - Módulo de Logística
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;