// Página de conformidade LGPD

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, FileText, Users, AlertTriangle, Download } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { formatDateTime, translateLgpdType, translateLgpdStatus } from '@/lib/utils';
import type { LgpdRequest, PaginatedResponse, PrivacyPolicy } from '@/types';

// Mapa de cores por status
const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
  REJECTED: 'destructive',
};

export default function LgpdSettingsPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'policies' | 'incidents'>('requests');

  // Busca requisições LGPD
  const { data: requestsData, isLoading: isLoadingRequests } = useQuery({
    queryKey: ['lgpd-requests'],
    queryFn: async () => {
      const response = await api.get<{ data: PaginatedResponse<LgpdRequest> }>('/lgpd/requests');
      return response.data.data;
    },
  });

  // Busca políticas de privacidade
  const { data: policiesData, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['privacy-policies'],
    queryFn: async () => {
      const response = await api.get<{ data: PrivacyPolicy[] }>('/lgpd/policies');
      return response.data.data;
    },
  });

  const requests = requestsData?.items || [];
  const policies = policiesData || [];

  const tabs = [
    { id: 'requests', label: 'Requisições de Titulares', icon: Users },
    { id: 'policies', label: 'Políticas de Privacidade', icon: FileText },
    { id: 'incidents', label: 'Incidentes', icon: AlertTriangle },
  ];

  return (
    <div>
      <Header title="Conformidade LGPD" />

      <div className="p-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-50 p-2">
                  <Users className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requestsData?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Requisições</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{policies.length}</p>
                  <p className="text-xs text-muted-foreground">Versões de Política</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter((r) => r.status === 'COMPLETED').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Requisições Atendidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo das tabs */}
        {activeTab === 'requests' && (
          <Card>
            <CardHeader>
              <CardTitle>Requisições dos Titulares</CardTitle>
              <CardDescription>
                Solicitações de exercício de direitos (LGPD Art. 18)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : requests.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma requisição registrada
                </p>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{translateLgpdType(req.type)}</Badge>
                          <span className="text-sm font-medium">{req.subjectEmail}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(req.createdAt)}
                        </p>
                      </div>
                      <Badge variant={statusVariant[req.status] || 'outline'}>
                        {translateLgpdStatus(req.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'policies' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Políticas de Privacidade</CardTitle>
                <CardDescription>Versões da política publicadas</CardDescription>
              </div>
              <Button size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Nova Versão
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingPolicies ? (
                <Skeleton className="h-24 w-full" />
              ) : policies.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma política de privacidade cadastrada
                </p>
              ) : (
                <div className="space-y-2">
                  {policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">Versão {policy.version}</p>
                        <p className="text-xs text-muted-foreground">
                          Vigência: {formatDateTime(policy.effectiveAt)} •{' '}
                          {policy._count?.consents || 0} consentimentos
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-3 w-3" />
                        Ver
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'incidents' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Incidentes de Segurança</CardTitle>
                <CardDescription>
                  Registro de incidentes conforme exigido pela LGPD
                </CardDescription>
              </div>
              <Button size="sm" variant="destructive">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Registrar Incidente
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhum incidente registrado
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
