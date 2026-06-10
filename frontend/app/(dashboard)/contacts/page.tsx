// Página de listagem de contatos
'use client';

import { useState } from 'react';
import { Plus, Search, Download, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContactForm } from '@/components/crm/contact-form';
import { useContacts, useContactDuplicates } from '@/hooks/use-contacts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  META_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  PORTAL: 'Portal',
  WHATSAPP: 'WhatsApp',
  SITE: 'Site',
  REFERRAL: 'Indicação',
};

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [showNewContactModal, setShowNewContactModal] = useState(false);

  const { data, isLoading } = useContacts({
    search: search || undefined,
    type: typeFilter || undefined,
    origin: originFilter || undefined,
    page,
    limit: 20,
  });

  const { data: duplicates } = useContactDuplicates();

  const contacts = data?.data ?? [];
  const meta = data?.meta;
  const hasDuplicates = Array.isArray(duplicates) && duplicates.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-muted-foreground text-sm">
            {meta ? `${meta.total} contatos` : 'Carregando...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-1.5" />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            Exportar
          </Button>
          <Button onClick={() => setShowNewContactModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Alerta de duplicatas */}
      {hasDuplicates && (
        <div className="flex items-center gap-2 p-3 border border-orange-200 bg-orange-50 rounded-lg text-sm text-orange-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Possíveis contatos duplicados detectados.{' '}
            <Link href="/contacts?duplicates=true" className="underline font-medium">
              Ver duplicatas
            </Link>
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PERSON">Pessoa Física</SelectItem>
            <SelectItem value="COMPANY">Pessoa Jurídica</SelectItem>
          </SelectContent>
        </Select>

        <Select value={originFilter} onValueChange={(v) => { setOriginFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="META_ADS">Meta Ads</SelectItem>
            <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
            <SelectItem value="PORTAL">Portal</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="SITE">Site</SelectItem>
            <SelectItem value="REFERRAL">Indicação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.type === 'COMPANY' ? 'secondary' : 'outline'}>
                      {contact.type === 'COMPANY' ? 'PJ' : 'PF'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.email || '-'}</TableCell>
                  <TableCell className="text-sm">{contact.phone || '-'}</TableCell>
                  <TableCell className="text-sm">{contact.city || '-'}</TableCell>
                  <TableCell>
                    {contact.origin && (
                      <Badge variant="outline" className="text-xs">
                        {ORIGIN_LABELS[contact.origin] ?? contact.origin}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {contact.tags?.slice(0, 2).map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="text-xs px-1.5 py-0.5 rounded-full border"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.pages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Modal de novo contato */}
      <Dialog open={showNewContactModal} onOpenChange={setShowNewContactModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
          </DialogHeader>
          <ContactForm
            onSuccess={() => setShowNewContactModal(false)}
            onCancel={() => setShowNewContactModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
