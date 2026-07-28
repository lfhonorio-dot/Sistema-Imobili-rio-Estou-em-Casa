// Página de detalhe do contrato
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileSignature, FileText, Trash2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useContract, useChangeContractStatus, useGenerateInstallments, useRequestSignature, useUpdateContract } from '@/hooks/use-contracts';
import { useContacts } from '@/hooks/use-contacts';
import { usePayEntry } from '@/hooks/use-financial';
import { FinancialEntryRow } from '@/components/erp/financial-entry-row';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

const TYPE_LABELS: Record<string, string> = {
  SALE: 'Venda', RENTAL_RESIDENTIAL: 'Locação Residencial',
  RENTAL_COMMERCIAL: 'Locação Comercial', BROKERAGE: 'Intermediação',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho', ACTIVE: 'Ativo', TERMINATED: 'Encerrado', RESCINDED: 'Rescindido',
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });
}

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.currentWorkspaceId);
  const id = params.id as string;

  const { data: contract, isLoading } = useContract(id);
  const changeStatus = useChangeContractStatus();
  const generateInstallments = useGenerateInstallments();
  const requestSignature = useRequestSignature();
  const payEntry = usePayEntry();

  const deleteContract = useMutation({
    mutationFn: async () => {
      await api.delete(`/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', workspaceId] });
      toast.success('Contrato excluído com sucesso.');
      router.push('/contracts');
    },
  });

  const [newStatus, setNewStatus] = useState('');
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showInstallmentsDialog, setShowInstallmentsDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const [months, setMonths] = useState('12');
  const [loadingDoc, setLoadingDoc] = useState(false);

  // Edição das condições (índice de reajuste e garantia locatícia)
  const updateContract = useUpdateContract();
  const { data: contactsData } = useContacts({ limit: 500 });
  const allContacts = contactsData?.items ?? [];
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [terms, setTerms] = useState({
    adjustmentIndex: '', guaranteeType: '', guaranteeValue: '', guaranteeDetails: '',
  });
  const [termsGuarantors, setTermsGuarantors] = useState<string[]>([]);

  function openTermsDialog() {
    const c = contract as any;
    setTerms({
      adjustmentIndex: c?.adjustmentIndex ?? 'IGPM',
      guaranteeType: c?.guaranteeType ?? '',
      guaranteeValue: c?.guaranteeValue != null ? String(c.guaranteeValue) : '',
      guaranteeDetails: c?.guaranteeDetails ?? '',
    });
    setTermsGuarantors(c?.guarantorIds ?? []);
    setShowTermsDialog(true);
  }

  async function handleSaveTerms() {
    const parseBR = (v: string) => {
      if (!v) return undefined;
      const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? undefined : n;
    };
    const needsValue = terms.guaranteeType === 'CAUCAO' || terms.guaranteeType === 'TITULO_CAPITALIZACAO';
    try {
      await updateContract.mutateAsync({
        id,
        adjustmentIndex: terms.adjustmentIndex || undefined,
        guaranteeType: terms.guaranteeType || undefined,
        guaranteeValue: needsValue ? parseBR(terms.guaranteeValue) : undefined,
        guaranteeDetails: terms.guaranteeDetails || undefined,
        guarantorIds: terms.guaranteeType === 'FIADOR' ? termsGuarantors : [],
      } as any);
      toast.success('Condições atualizadas! Gere o contrato novamente para ver o texto.');
      setShowTermsDialog(false);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Erro ao atualizar as condições.');
    }
  }

  async function handleViewContract() {
    setLoadingDoc(true);
    try {
      const { data } = await api.get(`/contracts/${id}/document`, {
        responseType: 'text',
        headers: { Accept: 'text/html' },
      });
      const blob = new Blob([data], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error('Erro ao gerar o contrato.');
    } finally {
      setLoadingDoc(false);
    }
  }

  async function handleChangeStatus() {
    if (!newStatus) return;
    await changeStatus.mutateAsync({ id, status: newStatus });
    toast.success('Status atualizado!');
    setShowStatusDialog(false);
    setNewStatus('');
  }

  async function handleRequestSignature() {
    try {
      await requestSignature.mutateAsync({ id, message: signatureMessage || undefined });
      toast.success('Envelope de assinatura criado! Acesse o módulo de Assinaturas para enviar.');
      setShowSignatureDialog(false);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Erro ao criar envelope de assinatura.';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  async function handleGenerateInstallments() {
    const result = await generateInstallments.mutateAsync({ id, months: parseInt(months) });
    toast.success(`${result.created} parcelas geradas com sucesso!`);
    setShowInstallmentsDialog(false);
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!contract) return <div className="p-6">Contrato não encontrado</div>;

  const isRental = contract.type === 'RENTAL_RESIDENTIAL' || contract.type === 'RENTAL_COMMERCIAL';
  const financialEntries = (contract as any).financialEntries ?? [];
  const commissions = (contract as any).commissions ?? [];
  const envelopes = (contract as any).signatureEnvelopes ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Contrato</h1>
              <Badge variant="secondary">{TYPE_LABELS[contract.type] ?? contract.type}</Badge>
              <Badge>{STATUS_LABELS[contract.status] ?? contract.status}</Badge>
            </div>
            {contract.property && (
              <p className="text-sm text-muted-foreground">
                {contract.property.street}{contract.property.number ? `, ${contract.property.number}` : ''}{contract.property.city ? ` — ${contract.property.city}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {/* Ver Contrato */}
          <Button variant="outline" size="sm" onClick={handleViewContract} disabled={loadingDoc}>
            <FileText className="w-4 h-4 mr-1.5" />
            {loadingDoc ? 'Gerando...' : 'Ver Contrato'}
          </Button>

          {/* Solicitar Assinatura Eletrônica */}
          <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSignature className="w-4 h-4 mr-1.5" />
                Solicitar Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Solicitar Assinatura Eletrônica</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Será criado um envelope de assinatura com o proprietário e inquilino/comprador cadastrados no contrato.
                </p>
                <div className="space-y-1.5">
                  <Label>Mensagem para os signatários (opcional)</Label>
                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={3}
                    placeholder="Prezado(a), solicitamos sua assinatura no contrato..."
                    value={signatureMessage}
                    onChange={(e) => setSignatureMessage(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>Cancelar</Button>
                  <Button onClick={handleRequestSignature} disabled={requestSignature.isPending}>
                    {requestSignature.isPending ? 'Criando...' : 'Criar Envelope'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Editar condições: índice de reajuste e garantia (locação) */}
          {isRental && (
            <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
              <Button variant="outline" size="sm" onClick={openTermsDialog}>
                <Settings2 className="w-4 h-4 mr-1.5" />
                Editar Condições
              </Button>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Índice de Reajuste e Garantia</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Índice de Reajuste</Label>
                    <Select
                      value={terms.adjustmentIndex}
                      onValueChange={(v) => setTerms((p) => ({ ...p, adjustmentIndex: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o índice..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IGPM">IGP-M/FGV (mais usado em locação)</SelectItem>
                        <SelectItem value="IPCA">IPCA/IBGE</SelectItem>
                        <SelectItem value="INPC">INPC/IBGE</SelectItem>
                        <SelectItem value="IGPDI">IGP-DI/FGV</SelectItem>
                        <SelectItem value="INCC">INCC/FGV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Garantia Locatícia</Label>
                    <Select
                      value={terms.guaranteeType}
                      onValueChange={(v) => setTerms((p) => ({ ...p, guaranteeType: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a garantia..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIADOR">Fiador</SelectItem>
                        <SelectItem value="CAUCAO">Caução (aluguel calção)</SelectItem>
                        <SelectItem value="SEGURO_FIANCA">Seguro Fiança</SelectItem>
                        <SelectItem value="TITULO_CAPITALIZACAO">Título de Capitalização</SelectItem>
                        <SelectItem value="NONE">Sem garantia</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Art. 37 da Lei 8.245/91 — as modalidades não podem ser cumuladas.
                    </p>
                  </div>

                  {(terms.guaranteeType === 'CAUCAO' || terms.guaranteeType === 'TITULO_CAPITALIZACAO') && (
                    <div className="space-y-1.5">
                      <Label>Valor da {terms.guaranteeType === 'CAUCAO' ? 'Caução' : 'Título'} (R$)</Label>
                      <Input
                        type="text" inputMode="decimal" placeholder="0,00"
                        value={terms.guaranteeValue}
                        onChange={(e) => setTerms((p) => ({ ...p, guaranteeValue: e.target.value }))}
                      />
                      {terms.guaranteeType === 'CAUCAO' && (contract as any)?.rentalValue && (
                        <p className="text-xs text-muted-foreground">
                          Limite legal: até 3 aluguéis ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                            .format(Number((contract as any).rentalValue) * 3)}) — art. 38, §2º.
                        </p>
                      )}
                    </div>
                  )}

                  {terms.guaranteeType === 'SEGURO_FIANCA' && (
                    <div className="space-y-1.5">
                      <Label>Seguradora / Apólice</Label>
                      <Input
                        placeholder="Ex.: Porto Seguro, apólice n.º 123456"
                        value={terms.guaranteeDetails}
                        onChange={(e) => setTerms((p) => ({ ...p, guaranteeDetails: e.target.value }))}
                      />
                    </div>
                  )}

                  {terms.guaranteeType === 'FIADOR' && (
                    <div className="space-y-1.5">
                      <Label>Fiadores</Label>
                      <Select
                        value=""
                        onValueChange={(v) => setTermsGuarantors((prev) => prev.includes(v) ? prev : [...prev, v])}
                      >
                        <SelectTrigger><SelectValue placeholder="Adicionar fiador..." /></SelectTrigger>
                        <SelectContent>
                          {allContacts.filter((c) => !termsGuarantors.includes(c.id)).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {termsGuarantors.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {termsGuarantors.map((gid) => {
                            const c = allContacts.find((x) => x.id === gid);
                            return (
                              <div key={gid} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                                <span>{c?.name ?? gid}</span>
                                <button
                                  type="button"
                                  onClick={() => setTermsGuarantors((prev) => prev.filter((x) => x !== gid))}
                                  className="text-red-600 text-xs"
                                >
                                  Remover
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setShowTermsDialog(false)}>Cancelar</Button>
                    <Button onClick={handleSaveTerms} disabled={updateContract.isPending}>
                      {updateContract.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Gerar Parcelas (só para locação) */}
          {isRental && (
            <Dialog open={showInstallmentsDialog} onOpenChange={setShowInstallmentsDialog}>
              <DialogTrigger asChild>
                <Button size="sm">Gerar Parcelas</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Gerar Parcelas de Aluguel</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Quantidade de meses</Label>
                    <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Serão geradas {months} parcelas de {formatCurrency(contract.rentalValue)} cada.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowInstallmentsDialog(false)}>Cancelar</Button>
                    <Button onClick={handleGenerateInstallments} disabled={generateInstallments.isPending}>
                      {generateInstallments.isPending ? 'Gerando...' : 'Gerar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Alterar Status */}
          <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Alterar Status</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Alterar Status do Contrato</DialogTitle></DialogHeader>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="Novo status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="TERMINATED">Encerrado</SelectItem>
                  <SelectItem value="RESCINDED">Rescindido</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancelar</Button>
                <Button onClick={handleChangeStatus} disabled={!newStatus || changeStatus.isPending}>
                  {changeStatus.isPending ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Excluir Contrato */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-white">
                <Trash2 className="w-4 h-4 mr-1.5" />
                Excluir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Excluir Contrato</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
                Os lançamentos financeiros e comissões associados não serão removidos automaticamente.
              </p>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteContract.mutate()}
                  disabled={deleteContract.isPending}
                >
                  {deleteContract.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="financial">Financeiro {financialEntries.length > 0 && `(${financialEntries.length})`}</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="signatures">Assinaturas {envelopes.length > 0 && `(${envelopes.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Partes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Proprietário/Vendedor: </span>{contract.owner?.name ?? '-'}</div>
                <div><span className="text-muted-foreground">{isRental ? 'Inquilino' : 'Comprador'}: </span>{contract.tenant?.name ?? '-'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Datas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Início: </span>{formatDate(contract.startDate)}</div>
                <div><span className="text-muted-foreground">Fim: </span>{formatDate(contract.endDate)}</div>
                <div><span className="text-muted-foreground">Assinatura: </span>{formatDate(contract.signedAt)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Valores</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {contract.rentalValue && (
                  <div><span className="text-muted-foreground">Aluguel: </span><strong>{formatCurrency(contract.rentalValue)}/mês</strong></div>
                )}
                {contract.saleValue && (
                  <div><span className="text-muted-foreground">Valor de Venda: </span><strong>{formatCurrency(contract.saleValue)}</strong></div>
                )}
                {contract.dueDay && (
                  <div><span className="text-muted-foreground">Vencimento: </span>Dia {contract.dueDay}</div>
                )}
                {contract.commissionRate && (
                  <div><span className="text-muted-foreground">Comissão: </span>{contract.commissionRate}%</div>
                )}
              </CardContent>
            </Card>
            {contract.notes && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
                <CardContent className="text-sm">{contract.notes}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          {financialEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm mb-3">Nenhum lançamento financeiro</p>
              {isRental && (
                <Button size="sm" onClick={() => setShowInstallmentsDialog(true)}>
                  Gerar Parcelas de Aluguel
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {financialEntries.map((entry: any) => (
                    <FinancialEntryRow
                      key={entry.id}
                      entry={entry}
                      onPay={(entryId) => payEntry.mutate({ id: entryId })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          {commissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma comissão registrada</p>
          ) : (
            <div className="space-y-2">
              {commissions.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(c.amount)} ({c.rate}%)</p>
                    </div>
                    <Badge variant={c.status === 'PAID' ? 'default' : 'secondary'}>
                      {c.status === 'PAID' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="signatures" className="mt-4">
          {envelopes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm mb-3">Nenhum envelope de assinatura criado</p>
              <Button size="sm" onClick={() => setShowSignatureDialog(true)}>
                <FileSignature className="w-4 h-4 mr-1.5" />
                Solicitar Assinatura
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {envelopes.map((env: any) => (
                <Card key={env.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{env.title}</p>
                      <Badge variant={env.status === 'COMPLETED' ? 'default' : env.status === 'SENT' ? 'secondary' : 'outline'}>
                        {env.status === 'DRAFT' ? 'Rascunho' : env.status === 'SENT' ? 'Enviado' : env.status === 'COMPLETED' ? 'Concluído' : env.status}
                      </Badge>
                    </div>
                    {env.signatories?.map((s: any) => (
                      <p key={s.id} className="text-xs text-muted-foreground">
                        {s.name} ({s.role}) — {s.status === 'SIGNED' ? '✓ Assinado' : s.status === 'PENDING' ? 'Aguardando' : s.status}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
