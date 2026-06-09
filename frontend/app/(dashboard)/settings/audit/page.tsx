// Página de logs de auditoria

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, Filter } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog, PaginatedResponse } from '@/types';

// Mapa de cores por tipo de ação
function getActionBadge(action: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (action.includes('DELETE') || action.includes('DELETED') || action.includes('LOCKED')) {
    return 'destructive';
  }
  if (action.includes('CREATE') || action.includes('REGISTER') || action.includes('LOGIN')) {
    return 'default';
  }
  if (action.includes('UPDATE') || action.includes('UPDATED') || action.includes('CHANGED')) {
    return 'secondary';
  }
  return 'outline';
}

// Traduz ações de auditoria
function translateAction(action: string): string {
  const map: Record<string, string> = {
    WORKSPACE_CREATED: 'Workspace criado',
    WORKSPACE_UPDATED: 'Workspace atualizado',
    USER_LOGIN: 'Login realizado',
    USER_LOGOUT: 'Logout realizado',
    USER_LOGOUT_ALL_DEVICES: 'Logout em todos os dispositivos',
    PROFILE_UPDATED: 'Perfil atualizado',
    PASSWORD_CHANGED: 'Senha alterada',
    PASSWORD_RESET_REQUESTED: 'Redefinição de senha solicitada',
    PASSWORD_RESET_COMPLETED: 'Senha redefinida',
    ACCOUNT_LOCKED: 'Conta bloqueada',
    '2FA_ENABLED': '2FA habilitado',
    '2FA_DISABLED': '2FA desabilitado',
    ROLE_CREATED: 'Papel criado',
    ROLE_UPDATED: 'Papel atualizado',
    ROLE_DELETED: 'Papel excluído',
    MEMBER_REMOVED: 'Membro removido',
    MEMBER_ROLE_UPDATED: 'Papel do membro atualizado',
    USER_INVITED: 'Usuário convidado',
    SESSION_REVOKED: 'Sessão revogada',
    LGPD_CONSENT_RECORDED: 'Consentimento registrado',
    LGPD_CONSENT_WITHDRAWN: 'Consentimento retirado',
    LGPD_REQUEST_CREATED: 'Requisição LGPD criada',
    LGPD_REQUEST_UPDATED: 'Requisição LGPD atualizada',
    LGPD_DATA_ANONYMIZED: 'Dados anonimizados',
    PRIVACY_POLICY_CREATED: 'Política de privacidade criada',
    SECURITY_INCIDENT_CREATED: 'Incidente de segurança registrado',
  };
  return map[action] || action;
}

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  // Busca logs de auditoria
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(actionFilter && { action: actionFilter }),
      });
      const response = await api.get<{ data: PaginatedResponse<AuditLog> }>(
        `/audit/logs?${params.toString()}`,
      );
      return response.data.data;
    },
  });

  const logs = data?.items || [];
  const totalPages = data?.pages || 1;

  return (
    <div>
      <Header title="Logs de Auditoria" />

      <div className="p-6">
        {/* Filtros */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por ação..."
              className="pl-9"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Lista de logs */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Atividades</CardTitle>
            <CardDescription>
              {data?.total || 0} evento{(data?.total || 0) !== 1 ? 's' : ''} registrado{(data?.total || 0) !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum log encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant={getActionBadge(log.action)} className="mt-0.5 shrink-0">
                        {translateAction(log.action)}
                      </Badge>
                      <div>
                        {log.user && (
                          <p className="text-sm font-medium">{log.user.name}</p>
                        )}
                        {log.entity && (
                          <p className="text-xs text-muted-foreground">
                            {log.entity}
                            {log.entityId && ` #${log.entityId.substring(0, 8)}...`}
                          </p>
                        )}
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground">IP: {log.ipAddress}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0 ml-4">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
