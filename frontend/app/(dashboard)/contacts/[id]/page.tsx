// Página de detalhe do contato
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MapPin, Building, Edit, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InterestProfilePanel, MatchingPropertiesPanel } from '@/components/contacts/interest-profile-panel';

const MARITAL_LABELS: Record<string, string> = {
  SOLTEIRO: 'Solteiro(a)', CASADO: 'Casado(a)', UNIAO_ESTAVEL: 'União estável',
  DIVORCIADO: 'Divorciado(a)', VIUVO: 'Viúvo(a)', SEPARADO: 'Separado(a)',
};
const REGIME_LABELS: Record<string, string> = {
  COMUNHAO_PARCIAL: 'comunhão parcial', COMUNHAO_UNIVERSAL: 'comunhão universal',
  SEPARACAO_TOTAL: 'separação total', SEPARACAO_OBRIGATORIA: 'separação obrigatória',
  PARTICIPACAO_FINAL: 'participação final nos aquestos',
};
import { ActivityFeed } from '@/components/crm/activity-feed';
import { TaskForm } from '@/components/crm/task-form';
import { ContactForm } from '@/components/crm/contact-form';
import { useContact, useContactTimeline, useDeleteContact } from '@/hooks/use-contacts';
import Link from 'next/link';
import { ErrorState } from '@/components/common/error-state';
import { useRoleKey } from '@/hooks/use-role';
import { lgpdAnonymize, lgpdExport, lgpdPreview } from '@/hooks/use-team';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/api-error';
import type { Activity } from '@/hooks/use-activities';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [showEditModal, setShowEditModal] = useState(false);
  const roleKey = useRoleKey();
  const [lgpdBusy, setLgpdBusy] = useState(false);
  const doLgpdExport = async () => {
    setLgpdBusy(true);
    try { await lgpdExport(id); toast.success('Arquivo com os dados do titular baixado.'); }
    catch (e) { toast.error(getApiErrorMessage(e, 'Não foi possível exportar os dados.')); }
    finally { setLgpdBusy(false); }
  };
  const doLgpdAnonymize = async () => {
    setLgpdBusy(true);
    try {
      const p = await lgpdPreview(id);
      const intro = p.legalHold
        ? `Este cliente tem contratos, lançamentos ou notas fiscais. Por obrigação legal, nome, CPF/CNPJ e endereço serão mantidos (${p.reason}); telefone, e-mail, conversas e anotações serão apagados.`
        : 'Todos os dados pessoais deste cliente serão apagados de forma definitiva.';
      const reason = window.prompt(`${intro}\n\nEsta ação não pode ser desfeita. Informe o motivo (ex.: pedido do titular por e-mail em dd/mm):`);
      if (!reason || !reason.trim()) return;
      await lgpdAnonymize(id, reason.trim());
      toast.success('Dados anonimizados conforme a LGPD.');
      router.refresh();
      window.location.reload();
    } catch (e) { toast.error(getApiErrorMessage(e, 'Não foi possível anonimizar.')); }
    finally { setLgpdBusy(false); }
  };
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: contact, isLoading, isError, error, refetch } = useContact(id);
  const { data: timeline = [] } = useContactTimeline(id);
  const deleteContact = useDeleteContact();

  async function handleDelete() {
    await deleteContact.mutateAsync(id);
    toast.success('Contato excluído com sucesso.');
    router.push('/contacts');
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  // Erro que não seja "não encontrado" (rede, servidor) aparece como erro, não como
  // "Contato não encontrado" — regra do projeto: diferenciar erro de ausência.
  if (isError && getApiErrorStatus(error) !== 404) {
    return <div className="p-6"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  }

  if (!contact) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Contato não encontrado</p>
        <Button variant="link" onClick={() => router.push('/contacts')}>
          Voltar para contatos
        </Button>
      </div>
    );
  }

  const initials = contact.name
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              <Badge variant={contact.type === 'COMPANY' ? 'secondary' : 'outline'}>
                {contact.type === 'COMPANY' ? 'PJ' : 'PF'}
              </Badge>
            </div>
            {contact.profession && (
              <p className="text-sm text-muted-foreground">{contact.profession}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {roleKey === 'ADMIN' && (<>
            <Button variant="outline" size="sm" disabled={lgpdBusy} onClick={() => void doLgpdExport()}>Exportar dados (LGPD)</Button>
            <Button variant="outline" size="sm" disabled={lgpdBusy} onClick={() => void doLgpdAnonymize()}>Anonimizar</Button>
          </>)}
          <Button variant="outline" size="sm" onClick={() => setShowTaskModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tarefa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            <Edit className="w-4 h-4 mr-1.5" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Coluna esquerda: Informações */}
        <div className="space-y-4">
          {/* Informações de contato */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:underline truncate">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${contact.phone}`} className="hover:underline">
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.city && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{contact.city}{contact.state ? `, ${contact.state}` : ''}</span>
                </div>
              )}
              {contact.maritalStatus && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Estado civil: </span>
                  {MARITAL_LABELS[contact.maritalStatus] ?? contact.maritalStatus}
                  {contact.marriageRegime && ` — ${REGIME_LABELS[contact.marriageRegime] ?? contact.marriageRegime}`}
                </div>
              )}
              {(contact.maritalStatus === 'CASADO' || contact.maritalStatus === 'UNIAO_ESTAVEL') && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Cônjuge: </span>
                  {contact.spouse ? (
                    <Link href={`/contacts/${contact.spouse.id}`} className="hover:underline">{contact.spouse.name}</Link>
                  ) : (
                    <span className="text-amber-700">não cadastrado</span>
                  )}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Consentimento de marketing (LGPD):{' '}
                {contact.marketingConsent
                  ? `sim${contact.marketingConsentAt ? `, desde ${new Date(contact.marketingConsentAt).toLocaleDateString('pt-BR')}` : ''}`
                  : 'não'}
              </div>
              {contact.companyName && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{contact.companyName}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="text-xs px-2 py-1 rounded-full border"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Negócios */}
          {contact.deals && contact.deals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Negócios ({contact.deals.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contact.deals.map((deal: {id: string; title: string; stage?: {name: string; color: string}}) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="block p-2 border rounded hover:bg-muted/50 text-sm"
                  >
                    <p className="font-medium">{deal.title}</p>
                    {deal.stage && (
                      <span
                        className="text-xs"
                        style={{ color: deal.stage.color }}
                      >
                        {deal.stage.name}
                      </span>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna direita: Timeline */}
        <div className="col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="interest">Perfil de interesse</TabsTrigger>
              <TabsTrigger value="matching">Imóveis compatíveis</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <ActivityFeed
                activities={timeline as Activity[]}
                contactId={id}
              />
            </TabsContent>
            <TabsContent value="interest" className="mt-4">
              <InterestProfilePanel contactId={id} />
            </TabsContent>
            <TabsContent value="matching" className="mt-4">
              <MatchingPropertiesPanel contactId={id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal de edição */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <ContactForm
            contact={contact}
            onSuccess={() => setShowEditModal(false)}
            onCancel={() => setShowEditModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Contato</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{contact.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteContact.isPending}>
              {deleteContact.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de nova tarefa */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
          </DialogHeader>
          <TaskForm
            contactId={id}
            onSuccess={() => setShowTaskModal(false)}
            onCancel={() => setShowTaskModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
