import React, { useState } from 'react';
import { changeSystemPassword } from '../services/api';
import { getCurrentUser } from '../services/authService';
import { Lock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export default function ChangePassword() {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const user = getCurrentUser();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!newPass.trim()) {
            setError('A senha não pode estar vazia.');
            return;
        }

        if (newPass !== confirmPass) {
            setError('As senhas não coincidem.');
            return;
        }

        if (!user) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }

        setLoading(true);

        try {
            // Chama a API que conecta ao Google Sheets (Ação updateUser)
            const result = await changeSystemPassword(user, newPass);

            if (result.success) {
                setSuccess(true);
                setNewPass('');
                setConfirmPass('');
            } else {
                setError(result.message || 'Erro ao atualizar a senha no banco de dados.');
            }
        } catch (err: any) {
            console.error(err);
            setError('Erro de conexão. Verifique sua internet.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-md mx-auto mt-10 animate-in fade-in zoom-in">
                <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-green-800 mb-2">Senha Atualizada!</h2>
                    <p className="text-green-700 mb-6">A nova senha foi gravada com sucesso no sistema.</p>
                    <button 
                        onClick={() => setSuccess(false)}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition shadow-sm"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-10 animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Alterar Senha</h2>
                <p className="text-slate-500 text-sm mb-6">Defina uma nova senha de acesso para o usuário <strong>{user?.username}</strong>.</p>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="••••••••" 
                                value={newPass}
                                onChange={(e) => setNewPass(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="••••••••" 
                                value={confirmPass}
                                onChange={(e) => setConfirmPass(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || !newPass}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" /> Atualizando...
                            </>
                        ) : (
                            'Atualizar Senha'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}