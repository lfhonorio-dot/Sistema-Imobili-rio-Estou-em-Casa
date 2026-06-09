// Página de gerenciamento de usuários do workspace

'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Mail } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface Member {
  id: string;
  isOwner: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    lastLoginAt?: string;
    deletedAt?: string;
  };
  role: { id: string; name: string };
}

export default function UsersSettingsPage() {
  // Busca membros do workspace
  const { data, isLoading } = useQuery({
    queryKey: ['workspace-members'],
    queryFn: async () => {
      const response = await api.get<{ data: Member[] }>('/users/workspace/members');
      return response.data.data;
    },
  });

  const members = data || [];

  return (
    <div>
      <Header title="Usuários" />

      <div className="p-6">
        {/* Cabeçalho com botão de convite */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Membros do Workspace</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} membro{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar Usuário
          </Button>
        </div>

        {/* Lista de membros */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {members.map((member) => {
                  const initials = member.user.name
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.user.avatar} alt={member.user.name} />
                          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{member.user.name}</p>
                            {member.isOwner && (
                              <Badge variant="secondary" className="text-xs">
                                Proprietário
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.user.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant="outline">{member.role.name}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {member.user.lastLoginAt
                              ? `Último acesso: ${formatDateTime(member.user.lastLoginAt)}`
                              : 'Nunca acessou'}
                          </p>
                        </div>
                        {!member.isOwner && (
                          <Button variant="ghost" size="sm">
                            Gerenciar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {members.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum membro encontrado
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
