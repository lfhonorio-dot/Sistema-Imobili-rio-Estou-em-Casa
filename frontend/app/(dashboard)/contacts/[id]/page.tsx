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
import { ActivityFeed } from '@/components/crm/activity-feed';
import { TaskForm } from '@/components/crm/task-form';
import { ContactForm } from '@/components/crm/contact-form';
import { useContact, useContactTimeline, useDeleteContact } from '@/hooks/use-contacts';
import Link from 'next/link';
import type { Activity } from '@/hooks/use-activities';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: contact, isLoading } = useContact(id);
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
              <TabsTrigger value="documents">Documentos</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <ActivityFeed
                activities={timeline as Activity[]}
                contactId={id}
              />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <div className="text-center py-8 text-muted-foreground text-sm">
                Funcionalidade de documentos em desenvolvimento
              </div>
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
