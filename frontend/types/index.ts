// Tipos TypeScript compartilhados do frontend

// -----------------------------------------------
// Autenticação
// -----------------------------------------------
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  workspaces: WorkspaceMembership[];
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  isOwner: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  role: {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  workspaceId?: string;
}

// -----------------------------------------------
// Workspace
// -----------------------------------------------
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  timezone: string;
  currency: string;
  logo?: string;
  twoFactorRequired: boolean;
  dpoName?: string;
  dpoEmail?: string;
  createdAt: string;
  roles: Role[];
  _count: { users: number };
}

export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Record<string, boolean>;
  _count?: { workspaceUsers: number };
}

// -----------------------------------------------
// LGPD
// -----------------------------------------------
export interface LgpdConsent {
  id: string;
  subjectEmail: string;
  subjectName?: string;
  consentedAt: string;
  withdrawnAt?: string;
  policyVersion: { version: string };
}

export interface LgpdRequest {
  id: string;
  type: string;
  subjectEmail: string;
  subjectName?: string;
  status: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PrivacyPolicy {
  id: string;
  version: string;
  effectiveAt: string;
  createdAt: string;
  _count?: { consents: number };
}

// -----------------------------------------------
// Auditoria
// -----------------------------------------------
export interface AuditLog {
  id: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

// -----------------------------------------------
// Resposta paginada
// -----------------------------------------------
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// -----------------------------------------------
// Resposta padrão da API
// -----------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}
