import React, { useState, useEffect } from 'react';
import { User, Profile, PERMISSIONS_LIST } from '../types';
import { createSystemUser, updateSystemUser, deleteSystemUser, saveProfile, deleteProfile, fetchAllData } from '../services/api';
import { Plus, Save, X, Trash2, Edit, Check, Shield, Users, RefreshCw } from 'lucide-react';

const Settings = ({ user }: { user: User }) => {
    const [activeTab, setActiveTab] = useState<'USERS' | 'PROFILES'>('USERS');
    
    // User Management State
    const [usersList, setUsersList] = useState<User[]>([]);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState<Partial<User>>({ role: '' });
    const [isEditingUser, setIsEditingUser] = useState(false);
    
    // Profile Management State
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [tempProfileName, setTempProfileName] = useState('');
    const [tempProfileDesc, setTempProfileDesc] = useState('');
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);

    // Helper Data State
    const [originUnits, setOriginUnits] = useState<string[]>([]);
    const [destUnits, setDestUnits] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchAllData();
            setProfiles(data.profiles);
            setUsersList(data.users);

            // Extract Unique Units for Dropdowns
            const origins = new Set<string>();
            const dests = new Set<string>();

            // Include units from existing users to ensure continuity
            data.users.forEach(u => {
                if (u.linkedOriginUnit) origins.add(u.linkedOriginUnit);
                if (u.linkedDestUnit) dests.add(u.linkedDestUnit);
            });

            // Include units from CTEs
            data.ctes.forEach(c => {
                if (c.collectionUnit) origins.add(c.collectionUnit);
                if (c.deliveryUnit) dests.add(c.deliveryUnit);
            });

            setOriginUnits(Array.from(origins).sort());
            setDestUnits(Array.from(dests).sort());

        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setLoading(false);
        }
    };

    if (user.role !== 'ADMIN') {
        return <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores.</div>;
    }

    // --- User Handlers ---

    const openUserModal = (userToEdit?: User) => {
        if (userToEdit) {
            setIsEditingUser(true);
            setNewUser({ ...userToEdit });
        } else {
            setIsEditingUser(false);
            setNewUser({ role: '', username: '', password: '', linkedOriginUnit: '', linkedDestUnit: '' });
        }
        setIsUserModalOpen(true);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username || !newUser.role) {
            alert("Preencha os campos obrigatórios (Usuário e Perfil).");
            return;
        }
        if (!isEditingUser && !newUser.password) {
             alert("Senha é obrigatória para novos usuários.");
             return;
        }

        // VALIDAÇÃO DE SEGURANÇA: Perfil UNIDADE exige vínculo
        if (newUser.role === 'UNIDADE' || newUser.role === 'unidade') {
            if (!newUser.linkedOriginUnit && !newUser.linkedDestUnit) {
                alert("ERRO DE SEGURANÇA:\n\nUsuários com perfil 'UNIDADE' OBRIGATORIAMENTE devem ter uma Unidade de Origem ou Destino vinculada.\n\nIsso impede que eles visualizem todas as pendências do sistema.");
                return;
            }
        }

        setLoading(true);
        // Ensure we send valid strings or undefined
        const userPayload: User = {
            id: newUser.username || 'new-user',
            username: newUser.username,
            password: newUser.password,
            role: newUser.role,
            linkedOriginUnit: newUser.linkedOriginUnit || undefined,
            linkedDestUnit: newUser.linkedDestUnit || undefined
        };

        let result;
        if (isEditingUser) {
            result = await updateSystemUser(userPayload);
        } else {
            result = await createSystemUser(userPayload);
        }

        if (result.success) {
            alert(isEditingUser ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
            setIsUserModalOpen(false);
            setNewUser({ role: '' });
            loadData(); // Reload to update list
        } else {
            alert('Erro ao salvar usuário: ' + (result.error || result.message || 'Erro desconhecido'));
        }
        setLoading(false);
    };

    const handleDeleteUser = async (username: string) => {
        if (confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) {
            setLoading(true);
            const result = await deleteSystemUser(username);
            if (result.success) {
                alert('Usuário excluído.');
                loadData();
            } else {
                alert('Erro ao excluir usuário.');
            }
            setLoading(false);
        }
    };

    // --- Profile Handlers ---

    const openProfileModal = (profile?: Profile) => {
        if (profile) {
            setEditingProfile(profile);
            setTempProfileName(profile.name);
            setTempProfileDesc(profile.description);
            setTempPermissions(Array.isArray(profile.permissions) ? [...profile.permissions] : []);
        } else {
            setEditingProfile(null);
            setTempProfileName('');
            setTempProfileDesc('');
            setTempPermissions([]);
        }
        setIsProfileModalOpen(true);
    };

    const togglePermission = (key: string) => {
        setTempPermissions(prev => 
            prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
        );
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempProfileName) return;

        setLoading(true);
        const profileToSave: Profile = {
            name: tempProfileName,
            description: tempProfileDesc,
            permissions: tempPermissions
        };

        const result = await saveProfile(profileToSave);
        if (result.success) {
            alert('Perfil salvo com sucesso!');
            setIsProfileModalOpen(false);
            loadData(); // Reload profiles
        } else {
            alert('Erro ao salvar perfil.');
        }
        setLoading(false);
    };

    const handleDeleteProfile = async (name: string) => {
        if (!confirm(`Tem certeza que deseja excluir o perfil ${name}?`)) return;
        
        setLoading(true);
        const result = await deleteProfile(name);
        if (result.success) {
            alert('Perfil excluído com sucesso!');
            loadData();
        } else {
            alert('Erro ao excluir perfil.');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 flex justify-between items-center">
                Configurações do Sistema
                <button onClick={loadData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full" title="Atualizar Dados">
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </h1>
            
            {/* Navigation Tabs */}
            <div className="flex space-x-4 border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('USERS')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 transition-colors ${
                        activeTab === 'USERS' 
                        ? 'border-b-2 border-blue-600 text-blue-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Users size={18} /> Gerenciar Usuários
                </button>
                <button 
                    onClick={() => setActiveTab('PROFILES')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 transition-colors ${
                        activeTab === 'PROFILES' 
                        ? 'border-b-2 border-blue-600 text-blue-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Shield size={18} /> Gerenciar Perfis
                </button>
            </div>

            {/* TAB CONTENT: USERS */}
            {activeTab === 'USERS' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-lg text-gray-800">Usuários Cadastrados</h2>
                            <button 
                                onClick={() => openUserModal()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                            >
                                <Plus size={16} /> Novo Usuário
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {usersList.map((u) => (
                                <div key={u.username} className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition bg-white relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{u.username}</h3>
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">{u.role}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => openUserModal(u)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" 
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(u.username)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded" 
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                                        {u.linkedOriginUnit && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-xs uppercase text-gray-400">Origem:</span>
                                                <span>{u.linkedOriginUnit}</span>
                                            </div>
                                        )}
                                        {u.linkedDestUnit && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-xs uppercase text-gray-400">Destino:</span>
                                                <span>{u.linkedDestUnit}</span>
                                            </div>
                                        )}
                                        {!u.linkedOriginUnit && !u.linkedDestUnit && (
                                            <p className={`text-xs italic ${u.role === 'UNIDADE' ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                {u.role === 'UNIDADE' ? '⚠ ALERTA: Unidade não vinculada!' : 'Acesso geral'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {usersList.length === 0 && !loading && (
                            <div className="text-center py-12 text-gray-400">
                                <Users size={48} className="mx-auto mb-3 opacity-20" />
                                <p>Nenhum usuário encontrado na planilha.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: PROFILES */}
            {activeTab === 'PROFILES' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-lg text-gray-800">Perfis de Acesso</h2>
                            <button 
                                onClick={() => openProfileModal()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                            >
                                <Plus size={16} /> Novo Perfil
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {profiles.map((profile) => (
                                <div key={profile.name} className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition bg-white relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-900 text-lg">{profile.name}</h3>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => openProfileModal(profile)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" 
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteProfile(profile.name)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded" 
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{profile.description}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(profile.permissions || []).slice(0, 4).map(p => (
                                            <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">
                                                {p.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                        {(profile.permissions || []).length > 4 && (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">
                                                +{(profile.permissions || []).length - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                         {profiles.length === 0 && !loading && (
                             <div className="text-center py-12 text-gray-400">Nenhum perfil encontrado. Crie um novo.</div>
                         )}
                    </div>
                </div>
            )}

            {/* Modal Novo Usuário */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">{isEditingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 font-medium"
                                    value={newUser.username || ''}
                                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                                    disabled={isEditingUser} // Cannot change username on edit (it's the key)
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Senha {isEditingUser ? '(Deixe em branco para manter)' : 'Inicial'}</label>
                                <input 
                                    type="text" 
                                    required={!isEditingUser}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 font-medium"
                                    value={newUser.password || ''}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                                <select 
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 font-medium appearance-none"
                                    value={newUser.role}
                                    required
                                    onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                                >
                                    <option value="">Selecione um Perfil...</option>
                                    <option value="ADMIN">ADMIN (Sistema)</option>
                                    <option value="UNIDADE">UNIDADE (Restrito)</option>
                                    {profiles.filter(p => p.name !== 'UNIDADE' && p.name !== 'ADMIN').map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Unidade de Origem Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Unidade de Origem (Vinculada)
                                    {newUser.role === 'UNIDADE' && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <select 
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 font-medium appearance-none ${newUser.role === 'UNIDADE' && !newUser.linkedOriginUnit && !newUser.linkedDestUnit ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                                    value={newUser.linkedOriginUnit || ''}
                                    onChange={e => setNewUser({...newUser, linkedOriginUnit: e.target.value})}
                                >
                                    <option value="">Nenhuma</option>
                                    {originUnits.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Unidade de Destino Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Unidade de Destino (Vinculada)
                                    {newUser.role === 'UNIDADE' && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <select 
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 font-medium appearance-none ${newUser.role === 'UNIDADE' && !newUser.linkedOriginUnit && !newUser.linkedDestUnit ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                                    value={newUser.linkedDestUnit || ''}
                                    onChange={e => setNewUser({...newUser, linkedDestUnit: e.target.value})}
                                >
                                    <option value="">Nenhuma</option>
                                    {destUnits.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>

                            {newUser.role === 'UNIDADE' && !newUser.linkedOriginUnit && !newUser.linkedDestUnit && (
                                <p className="text-xs text-red-600 mt-1 font-bold">
                                    Para o perfil UNIDADE, selecione Origem ou Destino.
                                </p>
                            )}

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-600/20"
                            >
                                {loading ? 'Salvando...' : <><Save size={18} /> Salvar Usuário</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Perfil (Novo / Editar) */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-gray-800 text-lg">
                                {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
                            </h3>
                            <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="profileForm" onSubmit={handleSaveProfile} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Perfil</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Ex: Supervisor"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                                            value={tempProfileName}
                                            onChange={e => setTempProfileName(e.target.value)}
                                            disabled={!!editingProfile} // Name immutable on edit usually to act as key
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                        <input 
                                            type="text" 
                                            placeholder="Breve descrição..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                                            value={tempProfileDesc}
                                            onChange={e => setTempProfileDesc(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Permissões de Acesso</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {PERMISSIONS_LIST.map((perm) => {
                                            const isSelected = tempPermissions.includes(perm.key);
                                            return (
                                                <div 
                                                    key={perm.key}
                                                    onClick={() => togglePermission(perm.key)}
                                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                                                        isSelected 
                                                        ? 'bg-blue-50 border-blue-500 text-blue-800' 
                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'
                                                    }`}>
                                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                                    </div>
                                                    <span className="text-sm font-medium">{perm.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0">
                            <button 
                                type="submit" 
                                form="profileForm"
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                            >
                                {loading ? 'Salvando...' : <><Save size={18} /> Salvar Perfil</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;