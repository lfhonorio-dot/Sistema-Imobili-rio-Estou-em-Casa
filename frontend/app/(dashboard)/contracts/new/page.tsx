'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateContract, useGenerateInstallments } from '@/hooks/use-contracts';
import { useProperties } from '@/hooks/use-properties';
import { useContacts } from '@/hooks/use-contacts';

export default function NewContractPage() {
  const router = useRouter();
  const createContract = useCreateContract();
  const generateInstallments = useGenerateInstallments();

  const { data: propertiesData } = useProperties({ limit: 500 });
  const { data: contactsData } = useContacts({ limit: 500 });

  const properties = propertiesData?.items ?? [];
  const contacts = contactsData?.items ?? [];

  const [form, setForm] = useState({
    type: '',
    propertyId: '',
    ownerId: '',
    tenantId: '',
    startDate: '',
    endDate: '',
    rentalValue: '',
    saleValue: '',
    dueDay: '',
    commissionRate: '',
    notes: '',
    templateKey: '',
    adjustmentIndex: 'IGPM',
    guaranteeType: '',
    guaranteeValue: '',
    guaranteeDetails: '',
  });
  // Fiadores (usados no modelo de sala comercial)
  const [guarantorIds, setGuarantorIds] = useState<string[]>([]);
  const [generateMonths, setGenerateMonths] = useState('12');

  // Corretores parceiros que recebem repasse de % da comissão
  const [partnerSplits, setPartnerSplits] = useState<Array<{ contactId: string; percentage: string }>>([]);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addPartner() {
    setPartnerSplits((prev) => [...prev, { contactId: '', percentage: '' }]);
  }
  function updatePartner(index: number, key: 'contactId' | 'percentage', value: string) {
    setPartnerSplits((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  }
  function removePartner(index: number) {
    setPartnerSplits((prev) => prev.filter((_, i) => i !== index));
  }

  const parseNum = (v: string) => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const commissionPctNum = parseNum(form.commissionRate);
  const saleValueNum = parseNum(form.saleValue);
  const commissionAmount = (saleValueNum * commissionPctNum) / 100;
  const partnersPctTotal = partnerSplits.reduce((s, p) => s + parseNum(p.percentage), 0);
  const agencyPct = Math.max(0, 100 - partnersPctTotal);
  const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const isRental = form.type === 'RENTAL_RESIDENTIAL' || form.type === 'RENTAL_COMMERCIAL';
  const isSale = form.type === 'SALE';
  const isBrokerage = form.type === 'BROKERAGE';
  const isCommercial = form.type === 'RENTAL_COMMERCIAL';
  const needsGuarantors = isRental && form.guaranteeType === 'FIADOR';
  const needsGuaranteeValue = isRental && (form.guaranteeType === 'CAUCAO' || form.guaranteeType === 'TITULO_CAPITALIZACAO');
  const needsInsurer = isRental && form.guaranteeType === 'SEGURO_FIANCA';

  async function handleSubmit() {
    if (!form.type || !form.propertyId) {
      toast.error('Tipo e imóvel são obrigatórios.');
      return;
    }

    try {
      // Normaliza separador decimal (aceita vírgula ou ponto)
      const parseBR = (v: string) => {
        if (!v) return undefined;
        const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
        return isNaN(n) ? undefined : n;
      };

      const payload: Record<string, unknown> = {
        type: form.type,
        propertyId: form.propertyId,
        ownerId: form.ownerId || undefined,
        tenantId: form.tenantId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        rentalValue: parseBR(form.rentalValue),
        saleValue: parseBR(form.saleValue),
        dueDay: form.dueDay ? parseInt(form.dueDay) : undefined,
        commissionRate: parseBR(form.commissionRate),
        notes: form.notes || undefined,
        templateKey: isCommercial && form.templateKey ? form.templateKey : undefined,
        adjustmentIndex: isRental ? form.adjustmentIndex : undefined,
        guaranteeType: isRental && form.guaranteeType ? form.guaranteeType : undefined,
        guaranteeValue: needsGuaranteeValue ? parseBR(form.guaranteeValue) : undefined,
        guaranteeDetails: form.guaranteeDetails || undefined,
        guarantorIds: guarantorIds.length ? guarantorIds : undefined,
      };

      // Repasses aos corretores parceiros (% da comissão)
      const validSplits = partnerSplits.filter((p) => p.contactId && parseNum(p.percentage) > 0);
      if (validSplits.length > 0) {
        if (partnersPctTotal > 100) {
          toast.error('A soma dos repasses aos parceiros não pode exceder 100% da comissão.');
          return;
        }
        payload.partnerSplits = validSplits.map((p) => ({
          contactId: p.contactId,
          percentage: parseNum(p.percentage),
        }));
      }

      const contract = await createContract.mutateAsync(payload as any);

      // Para locação: gera parcelas automaticamente
      if (isRental && parseInt(generateMonths) > 0) {
        try {
          const result = await generateInstallments.mutateAsync({
            id: contract.id,
            months: parseInt(generateMonths),
          });
          toast.success(`Contrato criado! ${result.created} parcelas geradas.`);
        } catch {
          toast.success('Contrato criado! Gere as parcelas manualmente no detalhe do contrato.');
        }
      } else {
        toast.success('Contrato criado com sucesso!');
      }

      router.push(`/contracts/${contract.id}`);
    } catch (err: unknown) {
      const errAny = err as { response?: { data?: { message?: string | string[]; error?: string }; status?: number }; message?: string };
      const apiMsg = errAny?.response?.data?.message;
      const httpStatus = errAny?.response?.data?.error || (errAny?.response?.status ? `HTTP ${errAny.response.status}` : null);
      const networkMsg = errAny?.message;

      let displayMsg: string;
      if (apiMsg) {
        displayMsg = Array.isArray(apiMsg) ? apiMsg[0] : apiMsg;
      } else if (httpStatus) {
        displayMsg = `Erro do servidor: ${httpStatus}`;
      } else if (networkMsg) {
        displayMsg = `Erro de conexão: ${networkMsg}`;
      } else {
        displayMsg = 'Erro ao criar contrato. Verifique sua conexão.';
      }
      toast.error(displayMsg);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Novo Contrato</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do Contrato</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de Contrato *</Label>
            <Select value={form.type} onValueChange={(v) => setField('type', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RENTAL_RESIDENTIAL">Locação Residencial</SelectItem>
                <SelectItem value="RENTAL_COMMERCIAL">Locação Comercial</SelectItem>
                <SelectItem value="SALE">Compra e Venda</SelectItem>
                <SelectItem value="BROKERAGE">Intermediação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Modelo do documento (locação comercial) */}
          {isCommercial && (
            <div className="space-y-1.5">
              <Label>Modelo do Contrato</Label>
              <Select value={form.templateKey} onValueChange={(v) => setField('templateKey', v)}>
                <SelectTrigger><SelectValue placeholder="Automático (pelo tipo do imóvel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RENTAL_WAREHOUSE">Barracão / Galpão (não residencial)</SelectItem>
                  <SelectItem value="RENTAL_COMMERCIAL_ROOM">Sala Comercial (com fiadores)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define o texto do contrato gerado. Sem escolha, o sistema usa o modelo de barracão para
                galpões/áreas e o de sala comercial para os demais imóveis.
              </p>
            </div>
          )}

          {/* Índice de reajuste e garantia locatícia */}
          {isRental && (
            <>
              <div className="space-y-1.5">
                <Label>Índice de Reajuste</Label>
                <Select value={form.adjustmentIndex} onValueChange={(v) => setField('adjustmentIndex', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o índice..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IGPM">IGP-M/FGV (mais usado em locação)</SelectItem>
                    <SelectItem value="IPCA">IPCA/IBGE</SelectItem>
                    <SelectItem value="INPC">INPC/IBGE</SelectItem>
                    <SelectItem value="IGPDI">IGP-DI/FGV</SelectItem>
                    <SelectItem value="INCC">INCC/FGV</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Usado na cláusula de reajuste e no reajuste automático anual (IGP-M e IPCA são buscados no
                  Banco Central).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Garantia Locatícia</Label>
                <Select value={form.guaranteeType} onValueChange={(v) => setField('guaranteeType', v)}>
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

              {needsGuaranteeValue && (
                <div className="space-y-1.5">
                  <Label>Valor da {form.guaranteeType === 'CAUCAO' ? 'Caução' : 'Título'} (R$)</Label>
                  <Input
                    type="text" inputMode="decimal" placeholder="0,00"
                    value={form.guaranteeValue}
                    onChange={(e) => setField('guaranteeValue', e.target.value)}
                  />
                  {form.guaranteeType === 'CAUCAO' && (
                    <p className="text-xs text-muted-foreground">
                      Limite legal: até 3 aluguéis{parseNum(form.rentalValue) > 0
                        ? ` (${brl(parseNum(form.rentalValue) * 3)})`
                        : ''} — art. 38, §2º.
                    </p>
                  )}
                </div>
              )}

              {needsInsurer && (
                <div className="space-y-1.5">
                  <Label>Seguradora / Apólice</Label>
                  <Input
                    placeholder="Ex.: Porto Seguro, apólice n.º 123456"
                    value={form.guaranteeDetails}
                    onChange={(e) => setField('guaranteeDetails', e.target.value)}
                  />
                </div>
              )}

              {needsGuarantors && (
                <div className="space-y-1.5">
                  <Label>Fiadores</Label>
                  <Select value="" onValueChange={(v) => setGuarantorIds((prev) => prev.includes(v) ? prev : [...prev, v])}>
                    <SelectTrigger><SelectValue placeholder="Adicionar fiador..." /></SelectTrigger>
                    <SelectContent>
                      {contacts.filter((c) => !guarantorIds.includes(c.id)).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {guarantorIds.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {guarantorIds.map((gid) => {
                        const c = contacts.find((x) => x.id === gid);
                        return (
                          <div key={gid} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                            <span>{c?.name ?? gid}</span>
                            <button
                              type="button"
                              onClick={() => setGuarantorIds((prev) => prev.filter((x) => x !== gid))}
                              className="text-red-600 text-xs"
                            >
                              Remover
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Respondem solidariamente pelas obrigações do contrato.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Imóvel */}
          <div className="space-y-1.5">
            <Label>Imóvel *</Label>
            <Select value={form.propertyId} onValueChange={(v) => setField('propertyId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o imóvel..." /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => {
                  const statusLabel: Record<string, string> = { AVAILABLE: 'Disponível', RENTED: 'Alugado', SOLD: 'Vendido', INACTIVE: 'Inativo' };
                  const addr = p.street ? `${p.street}${p.number ? `, ${p.number}` : ''}` : 'Endereço não informado';
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {addr}{p.city ? ` (${p.city})` : ''}{p.status !== 'AVAILABLE' ? ` [${statusLabel[p.status] ?? p.status}]` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Proprietário */}
          <div className="space-y-1.5">
            <Label>Proprietário</Label>
            <Select value={form.ownerId || 'NONE'} onValueChange={(v) => setField('ownerId', v === 'NONE' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o proprietário..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nenhum</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Locatário / Comprador */}
          {(isRental || isSale || isBrokerage) && (
            <div className="space-y-1.5">
              <Label>{isRental ? 'Locatário' : 'Comprador'}</Label>
              <Select value={form.tenantId || 'NONE'} onValueChange={(v) => setField('tenantId', v === 'NONE' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={`Selecione o ${isRental ? 'locatário' : 'comprador'}...`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Nenhum</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de Início</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Encerramento</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
            </div>
          </div>

          {/* Valores */}
          {isRental && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Valor do Aluguel (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00" value={form.rentalValue} onChange={(e) => setField('rentalValue', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Dia do Vencimento</Label>
                <Input type="number" min={1} max={31} placeholder="10" value={form.dueDay} onChange={(e) => setField('dueDay', e.target.value)} />
              </div>
            </div>
          )}

          {(isSale || isBrokerage) && (
            <div className="space-y-1.5">
              <Label>{isSale ? 'Valor de Venda (R$)' : 'Valor da Negociação (R$) *'}</Label>
              <Input type="text" inputMode="decimal" placeholder="0,00" value={form.saleValue} onChange={(e) => setField('saleValue', e.target.value)} />
              {isBrokerage && (
                <p className="text-xs text-muted-foreground">
                  Base de cálculo da comissão de intermediação. O contas a receber será gerado pelo
                  valor da comissão, não pelo valor da negociação.
                </p>
              )}
            </div>
          )}

          {/* Comissão */}
          <div className="space-y-1.5">
            <Label>Taxa de Comissão (%)</Label>
            <Input type="text" inputMode="decimal" placeholder="5,0" value={form.commissionRate} onChange={(e) => setField('commissionRate', e.target.value)} />
            {commissionAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                Comissão total: <span className="font-medium">{brl(commissionAmount)}</span>
              </p>
            )}
          </div>

          {/* Corretores parceiros (repasse da comissão) */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>Corretores Parceiros (repasse da comissão)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPartner} disabled={commissionPctNum <= 0}>
                + Adicionar parceiro
              </Button>
            </div>
            {commissionPctNum <= 0 && (
              <p className="text-xs text-muted-foreground">Informe a taxa de comissão para configurar repasses.</p>
            )}

            {partnerSplits.map((p, i) => {
              const valor = (commissionAmount * parseNum(p.percentage)) / 100;
              return (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Corretor parceiro</Label>
                    <Select value={p.contactId || undefined} onValueChange={(v) => updatePartner(i, 'contactId', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o contato..." /></SelectTrigger>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">% comissão</Label>
                    <Input type="text" inputMode="decimal" placeholder="30" value={p.percentage} onChange={(e) => updatePartner(i, 'percentage', e.target.value)} />
                  </div>
                  <div className="w-28 pb-2 text-xs text-muted-foreground">
                    {valor > 0 ? brl(valor) : '—'}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="pb-2 text-red-500" onClick={() => removePartner(i)}>
                    Remover
                  </Button>
                </div>
              );
            })}

            {partnerSplits.length > 0 && (
              <div className={`text-xs ${partnersPctTotal > 100 ? 'text-red-500' : 'text-muted-foreground'}`}>
                Parceiros: {partnersPctTotal}% da comissão · Imobiliária fica com {agencyPct}%
                {commissionAmount > 0 && ` (${brl((commissionAmount * agencyPct) / 100)})`}
                {partnersPctTotal > 100 && ' — soma excede 100%!'}
              </div>
            )}
          </div>

          {/* Gerar parcelas automáticas (só para locação) */}
          {isRental && (
            <div className="space-y-1.5">
              <Label>Gerar Parcelas Automaticamente</Label>
              <Select value={generateMonths} onValueChange={setGenerateMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Não gerar agora</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                  <SelectItem value="36">36 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} placeholder="Observações sobre o contrato..." value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={createContract.isPending || generateInstallments.isPending}>
          {createContract.isPending ? 'Criando...' : 'Criar Contrato'}
        </Button>
      </div>
    </div>
  );
}
