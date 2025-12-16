import { User, LoginCredentials, AuthResponse } from '../types';
import { authenticateUser, fetchAllData } from './api';

const AUTH_KEY = 'sle_auth_token';

const ADMIN_FALLBACK: User = {
  id: 'admin-fallback-001',
  username: 'admin',
  role: 'ADMIN',
  name: 'Administrador (Fallback)'
};

/**
 * Realiza o login do usuário.
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
        const inputUsername = (credentials.username || '').trim();
        const safePassword = (credentials.password || '').trim();

        console.log(`[AuthService] Iniciando login para: ${inputUsername}`);

        // 1. HARDCODED ADMIN FALLBACK (Case Insensitive)
        if (inputUsername.toLowerCase() === 'admin' && (safePassword === '02965740155' || safePassword === 'admin')) {
            console.log('[AuthService] Admin fallback ativado.');
            const fakeToken = 'admin-fallback-token-' + Date.now();
            localStorage.setItem('authToken', fakeToken);
            localStorage.setItem(AUTH_KEY, JSON.stringify(ADMIN_FALLBACK));
            return { success: true, token: fakeToken, user: ADMIN_FALLBACK };
        }

        // 2. RESOLUÇÃO DE CASE-SENSITIVITY
        // O backend do Google Sheets verifica a string exata (ex: "RONDONOPOLIS" != "rondonopolis").
        // Para permitir que o usuário digite de qualquer jeito, buscamos o nome correto na lista de usuários antes de autenticar.
        let usernameToSend = inputUsername;

        try {
            // Buscamos a lista de usuários (geralmente rápida ou cacheada)
            const data = await fetchAllData();
            
            if (data && data.users) {
                // Procura um usuário onde o nome bata (ignorando maiúsculas/minúsculas)
                const targetUser = data.users.find(u => 
                    u.username.trim().toLowerCase() === inputUsername.toLowerCase()
                );

                if (targetUser) {
                    console.log(`[AuthService] Case Match: Input "${inputUsername}" -> DB "${targetUser.username}"`);
                    usernameToSend = targetUser.username;
                }
            }
        } catch (fetchErr) {
            console.warn("[AuthService] Não foi possível verificar lista de usuários pré-login. Tentando direto.", fetchErr);
            // Se falhar a busca, segue com o que o usuário digitou
        }

        // 3. API AUTHENTICATION
        // Envia o username correto (conforme está no banco) e a senha
        const response = await authenticateUser(usernameToSend, safePassword);
        console.log("[AuthService] Resposta bruta da API:", response);

        // VALIDAÇÃO FLEXÍVEL:
        const hasSuccessFlag = response && response.success === true;
        const hasUserObject = response && (response.user || response.data?.user);
        const hasToken = response && (response.token || response.data?.token);

        if (hasSuccessFlag || hasUserObject || hasToken) {
            // Tenta extrair o usuário de várias estruturas possíveis
            const userData = response.data?.user || response.user || response.data || response;
            
            // Verifica se o objeto extraído parece um usuário (tem username ou nome)
            if (userData && (userData.username || userData.name || userData.role)) {
                const cleanUser: User = {
                    id: String(userData.id || 'api-user'),
                    username: String(userData.username || usernameToSend),
                    role: String(userData.role || 'USER'),
                    linkedOriginUnit: userData.linkedOriginUnit ? String(userData.linkedOriginUnit) : undefined,
                    linkedDestUnit: userData.linkedDestUnit ? String(userData.linkedDestUnit) : undefined,
                    name: userData.name || userData.username || usernameToSend
                };
                
                const token = response.data?.token || response.token || 'session-token';
                localStorage.setItem('authToken', token);
                localStorage.setItem(AUTH_KEY, JSON.stringify(cleanUser));
                return { success: true, user: cleanUser, token: token };
            }
        }

        // Extrai a melhor mensagem de erro disponível
        const errorMsg = response?.error || response?.message || response?.data?.message || 'Falha na autenticação via API.';
        return { success: false, message: errorMsg };

    } catch (e: any) {
        console.error("[AuthService] Erro fatal:", e);
        return { success: false, message: e.message || 'Erro de conexão.' };
    }
};

export const logout = (): void => {
    localStorage.removeItem('authToken');
    localStorage.removeItem(AUTH_KEY);
    // REMOVED: window.location.href = '/'; 
    // This prevents the "Refused to display" error and allows React state to handle the transition to Login.
};

export const getCurrentUser = (): User | null => {
    try {
        const stored = localStorage.getItem(AUTH_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as User;
    } catch (e) {
        console.error("[AuthService] Erro ao parsear usuário:", e);
        return null;
    }
};

export const isAuthenticated = (): boolean => {
    return !!getCurrentUser();
};

export const authService = {
  login,
  logout,
  getCurrentUser,
  isAuthenticated
};
