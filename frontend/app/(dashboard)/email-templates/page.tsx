// Página de Templates de Email
'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Mail, Eye } from 'lucide-react';
import { useEmail, type EmailTemplate } from '@/hooks/use-email';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORIES = ['BOAS_VINDAS', 'PROPOSTA', 'CONTRATO', 'VISTORIA', 'MANUTENCAO', 'MARKETING', 'OUTRO'];

const CATEGORY_LABELS: Record<string, string> = {
  BOAS_VINDAS: 'Boas-vindas',
  PROPOSTA: 'Proposta',
  CONTRATO: 'Contrato',
  VISTORIA: 'Vistoria',
  MANUTENCAO: 'Manutenção',
  MARKETING: 'Marketing',
  OUTRO: 'Outro',
};

interface FormData {
  name: string;
  subject: string;
  body: string;
  category: string;
}

const empty: FormData = { name: '', subject: '', body: '', category: 'OUTRO' };

export default function EmailTemplatesPage() {
  const { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate, previewTemplate } = useEmail();

  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormData>(empty);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, body: t.body, category: t.category });
    setOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await updateTemplate(editing.id, form);
    } else {
      await createTemplate(form);
    }
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Confirma exclusão do template?')) return;
    await deleteTemplate(id);
  };

  const handlePreview = async (t: EmailTemplate) => {
    const result = await previewTemplate(t.id);
    setPreview(result);
    setPreviewOpen(true);
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Templates de Email
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie e gerencie templates reutilizáveis com variáveis dinâmicas
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum template encontrado
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.subject}</TableCell>
                <TableCell>
                  <Badge variant="outline">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                    {t.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(t.createdAt), { locale: ptBR, addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handlePreview(t)} title="Pré-visualizar">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Assunto</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label>Corpo do email</Label>
              <p className="text-xs text-muted-foreground">Use {'{{variavel}}'} para campos dinâmicos</p>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.subject || !form.body}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Template</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Assunto</Label>
                <p className="font-medium mt-1">{preview.subject}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Corpo</Label>
                <div
                  className="mt-1 rounded border p-4 text-sm bg-muted/30 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: preview.body }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
