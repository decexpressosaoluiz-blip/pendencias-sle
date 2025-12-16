import { CTE, Note, User, AppConfig, Profile, PaymentType } from '../types';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

export const API_URL = 'https://script.google.com/macros/s/AKfycbz9otqfSKZX0ho9pugWiMAQ9kAY6MLN_o5eCx2UFzTm_BUnlQMtE8ekbI2bH92m0zKQ/exec';

// ============================================================================
// CACHE SYSTEM
// ============================================================================
let globalCache: {
    data: { ctes: CTE[], notes: Note[], users: User[], profiles: Profile[], config: AppConfig } | null,
    timestamp: number
} = { data: null, timestamp: 0 };

const CACHE_TTL = 2 * 60 * 1000; 

// ============================================================================
// DADOS MOCKADOS (FALLBACK)
// ============================================================================
const getMockData = () => {
    const mockCtes: CTE[] = [
        {
            id: 'cte-123456-1', cteNumber: '123456', serie: '1', emissionDate: '2023-10-01', deadlineDate: '2023-10-05', limitDate: '2023-10-10',
            status: 'PENDENTE', collectionUnit: 'SAO PAULO', deliveryUnit: 'RIO DE JANEIRO', value: 1500.50, freightPaid: false,
            recipient: 'CLIENTE EXEMPLO LTDA', justification: '', type: 'CIF' as any, hasNotes: false, notesCount: 0, isSearch: false
        }
    ];

    const mockConfig: AppConfig = {
        criticalDaysLimit: 5,
        uploadFolderUrl: '',
        googleScriptUrl: API_URL,
        lastUpdate: Date.now()
    };

    return { ctes: mockCtes, notes: [], users: [], profiles: [], config: mockConfig };
};

// ============================================================================
// API CLIENT
// ============================================================================

const apiRequest = async (action: string, payload: any = {}) => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, payload })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            return json;
        } catch (e) {
            console.error("Invalid JSON response:", text);
            throw new Error("Invalid JSON from server");
        }
    } catch (e) {
        console.error(`API Error [${action}]:`, e);
        return { success: false, error: String(e) };
    }
};

// ============================================================================
// HELPERS
// ============================================================================

export const normalizeText = (text: string | undefined): string => {
    return (text || '').trim().toLowerCase();
};

const formatDate = (dateVal: any): string => {
    if (!dateVal) return '';
    const s = String(dateVal).trim();
    return s.split('T')[0];
};

const cleanKey = (key: string) => {
    return String(key).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, ""); 
};

const getProp = (obj: any, keys: string[]) => {
    if (!obj) return undefined;
    const objKeys = Object.keys(obj);
    for (const keyAlias of keys) {
        const cleanAlias = cleanKey(keyAlias);
        const foundKey = objKeys.find(k => {
             if (k.toLowerCase() === keyAlias.toLowerCase()) return true;
             if (cleanKey(k) === cleanAlias) return true;
             return false;
        });
        if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null && obj[foundKey] !== '') {
            return obj[foundKey];
        }
    }
    return undefined;
};

const getTrimmedString = (obj: any, keys: string[]): string | undefined => {
    const val = getProp(obj, keys);
    if (val === undefined || val === null) return undefined;
    const str = String(val).trim();
    return str === '' ? undefined : str;
};

const parseCurrency = (input: any): number => {
    if (typeof input === 'number') return input;
    if (!input) return 0;
    
    let str = String(input).trim();
    if (str === '-' || str === '') return 0;

    str = str.replace(/[^\d.,-]/g, '');
    if (!str) return 0;

    if (str.includes(',')) {
        if (str.includes('.') && str.indexOf('.') < str.indexOf(',')) {
             str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes('.') && str.indexOf('.') > str.indexOf(',')) {
             str = str.replace(/,/g, '');
        } else {
             str = str.replace(',', '.');
        }
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

const normalizePaymentType = (raw: string): string => {
    if (!raw) return 'OUTROS';
    const s = String(raw).toUpperCase().trim();
    
    if (s.includes('CIF')) return PaymentType.CIF;
    if (s.includes('FOB')) return PaymentType.FOB;
    if (s.includes('REMETENTE') || s.includes('REM') || s.includes('EMITENTE') || s.includes('EXPEDIDOR') || s === 'FATURAR_REMETENTE') return PaymentType.SENDER;
    if (s.includes('DEST') || s.includes('DST') || s.includes('RECEBEDOR') || s === 'FATURAR_DEST') return PaymentType.DEST;
    return 'OUTROS';
};

// ============================================================================
// 1. LEITURA DE DADOS (GET_ALL)
// ============================================================================

export const fetchAllData = async (forceRefresh = false): Promise<{ ctes: CTE[], notes: Note[], users: User[], profiles: Profile[], config: AppConfig }> => {
    const now = Date.now();
    if (!forceRefresh && globalCache.data && (now - globalCache.timestamp < CACHE_TTL)) {
        console.log("Using Cached Data (Fast Load)");
        return globalCache.data;
    }

    console.log("Fetching fresh data from API...");
    const response = await apiRequest('GET_ALL');

    if (!response || !response.success || !response.data) {
        console.warn("API indisponível. Carregando dados de fallback.");
        return getMockData();
    }

    const { ctes: rawCtes, processData, config: rawConfig, users: rawUsers, profiles: rawProfiles } = response.data;

    const KEYS = {
        id: ['id', 'ID', 'Identificador', 'key', 'chave'],
        cteNumber: ['CTE', 'cteNumber', 'cte', 'numero', 'Numero', 'Conhecimento', 'CT-e', 'n_cte', 'cte_numero', 'numero_cte'],
        serie: ['SERIE', 'serie', 'Serie', 'ser'],
        emissionDate: ['DATA EMISSAO', 'emissionDate', 'emissao', 'data_emissao', 'Data Emissão', 'Dt Emissao', 'data', 'emission'],
        deadlineDate: ['PRAZO PARA BAIXA (DIAS)', 'deadlineDate', 'prazo', 'data_prazo', 'Prazo', 'Previsão', 'Previsao', 'previsao_entrega', 'deadline'],
        limitDate: ['DATA LIMITE DE BAIXA', 'limitDate', 'limite', 'data_limite', 'Data Limite', 'Vencimento', 'dt_limite', 'limit', 'Data Limite de Baixa'],
        status: ['STATUS', 'status', 'Status', 'Situacao', 'Situação', 'estado', 'st'],
        collectionUnit: ['COLETA', 'collectionUnit', 'origem', 'Origem', 'collection_unit', 'Unidade Origem', 'Filial Origem', 'U. Origem', 'col', 'coleta'],
        deliveryUnit: ['ENTREGA', 'deliveryUnit', 'destino', 'Destino', 'delivery_unit', 'Unidade Destino', 'Filial Destino', 'U. Destino', 'ent', 'entrega'],
        value: ['VALOR DO CTE', 'value', 'Valor', 'valor', 'amount', 'valordocte', 'valor do cte', 'Vlr', 'Valor Frete', 'Vlr. Frete', 'Valor Total', 'Vlr Total', 'Total Frete', 'vlr_frete', 'valor_frete', 'total', 'montante'],
        freightPaid: ['freightPaid', 'pago', 'Pago', 'Status Pagamento', 'quitado', 'pagamento_realizado'], 
        recipient: ['DESTINATARIO', 'recipient', 'destinatario', 'Destinatario', 'Destinatário', 'cliente', 'Cliente', 'Recebedor', 'nome_destinatario', 'nome_cliente'],
        justification: ['JUSTIFICATIVA', 'justification', 'justificativa', 'Justificativa', 'Obs', 'Observacao', 'comentario', 'notas'],
        type: ['FRETE_PAGO', 'FRETE PAGO', 'frete_pago', 'frete pago', 'type', 'tipo', 'Tipo', 'fretepago', 'paymentType', 'Tipo Frete', 'Tipo Pagamento', 'Pagamento', 'pagto', 'Condição', 'Condicao', 'Condição Pagamento', 'tp_frete', 'cond_pagamento', 'pagamento', 'forma_pagamento', 'modalidade', 'modalidade_frete'],
        hasNotes: ['hasNotes', 'notas_sistema', 'Tem Nota', 'possui_nota'],
        notesCount: ['notesCount', 'qtd_notas', 'Qtd Notas', 'quantidade_notas']
    };

    const ctes: CTE[] = (rawCtes || []).map((r: any) => {
        const rawType = String(getProp(r, KEYS.type) || 'OUTROS');
        const cteNum = String(getProp(r, KEYS.cteNumber) || '');
        const serie = String(getProp(r, KEYS.serie) || '');
        
        // --- FIX CRÍTICO: ID DETERMINÍSTICO ---
        // Forçamos o ID gerado para garantir unicidade e consistência no render do React.
        // Isso previne que a tela pisque ou perca o foco quando os dados atualizam.
        const generatedId = `cte-${cteNum}-${serie}`;
        const id = generatedId; // Ignoramos o ID do banco se ele não for confiável

        return {
            id: id,
            cteNumber: cteNum,
            serie: serie,
            emissionDate: formatDate(getProp(r, KEYS.emissionDate)),
            deadlineDate: formatDate(getProp(r, KEYS.deadlineDate)), 
            limitDate: formatDate(getProp(r, KEYS.limitDate)), 
            status: String(getProp(r, KEYS.status) || 'PENDENTE').toUpperCase(),
            collectionUnit: String(getProp(r, KEYS.collectionUnit) || 'N/A').toUpperCase(),
            deliveryUnit: String(getProp(r, KEYS.deliveryUnit) || 'N/A').toUpperCase(),
            value: parseCurrency(getProp(r, KEYS.value)), 
            freightPaid: !!getProp(r, KEYS.freightPaid),
            recipient: String(getProp(r, KEYS.recipient) || 'Consumidor').toUpperCase(),
            justification: String(getProp(r, KEYS.justification) || ''),
            type: normalizePaymentType(rawType) as any, 
            hasNotes: !!getProp(r, KEYS.hasNotes),
            notesCount: Number(getProp(r, KEYS.notesCount) || 0),
            isSearch: false
        };
    });

    const searchMap = new Set((processData || []).map((p: any) => String(p.cte))); 
    const enrichedCtes = ctes.map(c => ({
        ...c,
        isSearch: searchMap.has(c.cteNumber) || c.status === 'EM BUSCA'
    }));

    const config: AppConfig = {
        criticalDaysLimit: Number(rawConfig?.PRAZO_LIMITE || 5),
        uploadFolderUrl: rawConfig?.URL_DRIVE_UPLOAD || '',
        googleScriptUrl: API_URL,
        lastUpdate: Date.now()
    };
    
    const USER_KEYS = {
        id: ['id', 'ID', 'username', 'usuario'],
        username: ['username', 'usuario', 'Usuario', 'user', 'Login'],
        role: ['role', 'perfil', 'cargo', 'Role', 'access_level'],
        name: ['name', 'nome', 'Nome', 'Full Name'],
        linkedOriginUnit: ['linkedOriginUnit', 'unidade_origem', 'Unidade Origem', 'origem_vinculada', 'UnidadeOrigem', 'Filial Origem'],
        linkedDestUnit: ['linkedDestUnit', 'unidade_destino', 'Unidade Destino', 'destino_vinculado', 'UnidadeDestino', 'Filial Destino']
    };

    const users: User[] = (rawUsers || []).map((u: any) => ({
        id: String(getProp(u, USER_KEYS.id) || getProp(u, USER_KEYS.username) || 'unknown'),
        username: String(getProp(u, USER_KEYS.username)),
        role: String(getProp(u, USER_KEYS.role) || 'USER'),
        name: getProp(u, USER_KEYS.name),
        linkedOriginUnit: getTrimmedString(u, USER_KEYS.linkedOriginUnit),
        linkedDestUnit: getTrimmedString(u, USER_KEYS.linkedDestUnit)
    }));

    const profiles: Profile[] = (rawProfiles || []).map((p: any) => ({
        name: String(p.name),
        description: String(p.description),
        permissions: Array.isArray(p.permissions) ? p.permissions : []
    }));

    const result = { 
        ctes: enrichedCtes, 
        notes: [], 
        users, 
        profiles, 
        config 
    };

    globalCache = {
        data: result,
        timestamp: Date.now()
    };

    return result;
};

// ============================================================================
// 2. LEITURA DE NOTAS (ON-DEMAND)
// ============================================================================

export const fetchNotesForCte = async (cteId: string, cteNumber?: string): Promise<Note[]> => {
    const lookupValue = cteNumber || cteId;
    
    const response = await apiRequest('getNotes', { cteId: lookupValue });
    if (!response.success || !Array.isArray(response.data)) return [];

    const KEYS = {
        id: ['id', 'ID'],
        cteId: ['cteId', 'cte', 'CTE', 'Cte'],
        date: ['date', 'data', 'DATA', 'Data'],
        author: ['author', 'usuario', 'USUARIO', 'Usuario', 'User'],
        text: ['text', 'texto', 'TEXTO', 'Texto', 'Conteudo'],
        imageUrl: ['imageUrl', 'link_imagem', 'LINK_IMAGEM', 'imagem', 'url'],
        attachments: ['attachments', 'anexos', 'arquivos']
    };

    return response.data.map((n: any) => {
        const rawAttachments = getProp(n, KEYS.attachments);
        let attachments = [];
        
        if (Array.isArray(rawAttachments)) {
            attachments = rawAttachments;
        } else if (typeof rawAttachments === 'string' && rawAttachments.trim().startsWith('[')) {
            try {
                attachments = JSON.parse(rawAttachments);
            } catch {
                attachments = [];
            }
        } else if (getProp(n, KEYS.imageUrl)) {
            attachments = [{ name: 'Anexo', mimeType: 'image/jpeg', data: getProp(n, KEYS.imageUrl) }];
        }

        // Gera ID determinístico para notas se não houver um vindo do backend
        const author = String(getProp(n, KEYS.author) || 'Sistema');
        const date = String(getProp(n, KEYS.date) || '');
        const textSnippet = String(getProp(n, KEYS.text) || '').substring(0, 10);
        // ID composto único e estável
        const noteId = String(getProp(n, KEYS.id) || `note-${cteId}-${cleanKey(author)}-${cleanKey(date)}-${cleanKey(textSnippet)}`);

        return {
            id: noteId,
            cteId: String(getProp(n, KEYS.cteId) || cteId),
            date: formatDate(getProp(n, KEYS.date)),
            author: author,
            text: String(getProp(n, KEYS.text) || ''),
            imageUrl: getProp(n, KEYS.imageUrl) || undefined,
            attachments: attachments,
            isSearchProcess: !!n.isSearchProcess
        };
    });
};

// ============================================================================
// 3. AUTENTICAÇÃO
// ============================================================================

export const authenticateUser = async (username: string, password: string) => {
    return apiRequest('login', { username, password });
};

// ============================================================================
// 4. ESCRITA (ACTIONS)
// ============================================================================

export const sendNoteToScript = async (note: Note, cteDetails?: any) => {
    const result = await apiRequest('addNote', {
        cteId: note.cteId, 
        cteNumber: cteDetails?.cteNumber || note.cteId,
        serie: cteDetails?.serie || "",
        author: note.author,
        text: note.text,
        imageUrl: note.attachments && note.attachments.length > 0 && note.attachments[0].mimeType.startsWith('image') 
                  ? note.attachments[0].data 
                  : note.imageUrl,
        attachments: note.attachments || [],
        markInSearch: note.isSearchProcess === true
    });

    if (result.success) {
        globalCache = { data: null, timestamp: 0 };
    }
    return result;
};

export const createSystemUser = async (user: User) => {
    const res = await apiRequest('createUser', { ...user });
    if(res.success) globalCache = { data: null, timestamp: 0 };
    return res;
};

export const updateSystemUser = async (user: User) => {
    const res = await apiRequest('updateUser', { ...user });
    if(res.success) globalCache = { data: null, timestamp: 0 };
    return res;
};

export const deleteSystemUser = async (username: string) => {
    const res = await apiRequest('deleteUser', { username });
    if(res.success) globalCache = { data: null, timestamp: 0 };
    return res;
};

export const saveProfile = async (profile: Profile) => {
    const res = await apiRequest('saveProfile', { ...profile });
    if(res.success) globalCache = { data: null, timestamp: 0 };
    return res;
};

export const deleteProfile = async (profileName: string) => {
    const res = await apiRequest('deleteProfile', { name: profileName });
    if(res.success) globalCache = { data: null, timestamp: 0 };
    return res;
};

export const changeSystemPassword = async (currentUser: User, newPass: string) => {
    return updateSystemUser({ ...currentUser, password: newPass });
};

export const logAction = async (user: string, action: string, details: string) => {
    console.log("Log (Client):", user, action, details);
};