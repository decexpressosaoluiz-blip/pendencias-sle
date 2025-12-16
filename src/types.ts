export enum PendencyStatus {
  LATE = 'FORA DO PRAZO',
  CRITICAL = 'CRÍTICO',
  PRIORITY = 'PRIORIDADE',
  TOMORROW = 'VENCE AMANHÃ',
  ON_TIME = 'NO PRAZO'
}

export enum PaymentType {
  FOB = 'FOB',
  CIF = 'CIF',
  SENDER = 'FATURAR_REMETENTE',
  DEST = 'FATURAR_DEST'
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64
}

export interface CTE {
  id: string;
  cteNumber: string;
  serie: string;
  emissionDate: string;
  deadlineDate: string;
  limitDate?: string;
  status: string;
  collectionUnit: string;
  deliveryUnit: string;
  value: number;
  freightPaid: boolean;
  recipient: string;
  justification: string;
  type: PaymentType | 'OUTROS';
  hasNotes: boolean;
  notesCount: number;
  isSearch?: boolean;
}

export interface Note {
  id: string;
  cteId: string;
  date: string;
  author: string;
  text: string;
  imageUrl?: string; // Mantido para compatibilidade
  attachments?: Attachment[]; // Novo campo para múltiplos arquivos
  isSearchProcess?: boolean;
}

export interface User {
  id: string;
  username: string;
  role: string;
  name?: string;
  linkedOriginUnit?: string;
  linkedDestUnit?: string;
  avatarUrl?: string;
  password?: string;
}

export interface Profile {
  name: string;
  description: string;
  permissions: string[];
}

export interface AppConfig {
  criticalDaysLimit: number;
  uploadFolderUrl: string;
  googleScriptUrl: string;
  lastUpdate: number;
}

export interface LoginCredentials {
  username: string;
  password?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  data?: any;
}

export const PERMISSIONS_LIST = [
    { key: 'VIEW_DASHBOARD', label: 'Visualizar Dashboard' },
    { key: 'VIEW_PENDENCIES', label: 'Visualizar Pendências' },
    { key: 'EDIT_NOTES', label: 'Adicionar/Editar Justificativas' },
    { key: 'MANAGE_USERS', label: 'Gerenciar Usuários (Admin)' },
    { key: 'MANAGE_SETTINGS', label: 'Gerenciar Configurações' },
    { key: 'VIEW_FINANCIAL', label: 'Visualizar Valores' },
    { key: 'EXPORT_DATA', label: 'Exportar Relatórios' }
];