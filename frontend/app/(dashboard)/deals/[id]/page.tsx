// Página de detalhe do negócio
'use client';
import { getApiErrorMessage } from '@/lib/api-error';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit, ArrowRight, Plus, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ActivityFeed } from '@/components/crm/activity-feed';
import { TaskForm } from '@/components/crm/task-form';
import { useDeal, useMoveStage } from '@/hooks/use-deals';
import { useActivities } from '@/hooks/use-activities';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Activity } from '@/hooks/use-activities';
import { LOST_REASONS, lostReasonLabel } from '@/lib/funnel';
import { DealPropertiesPanel, DealProposalsPanel, DealVisitsPanel } from '@/components/funnel/deal-panels';

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: deal, isLoading } = useDeal(id);
  const { data: activitiesResult } = useActivities({ dealId: id });
  const activities = activitiesResult?.items ?? [];
  const moveStage = useMoveStage();

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [targetStageId, setTargetStageId] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [lostNote, setLostNote] = useState('');

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  if (!deal) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Negócio não encontrado</p>
        <Button variant="link" onClick={() => router.push('/pipeline')}>
          Voltar ao pipeline
        </Button>
      </div>
    );
  }

  const dealProps = ((deal as { properties?: Array<{ propertyId: string; property?: { id: string; code: string; street?: string | null; salePrice?: unknown } | null }> }).properties ?? []);

  const targetStage = deal.pipeline?.stages?.find((s: {id: string; isLost: boolean}) => s.id === targetStageId);
  const isLostStage = targetStage?.isLost;

  const handleMoveStage = async () => {
    if (!targetStageId) return;

    try {
      const result = await moveStage.mutateAsync({
        dealId: id,
        stageId: targetStageId,
        lostReason: lostReason || undefined,
        lostNote: lostNote || undefined,
      });
      setShowMoveModal(false);
      setTargetStageId('');
      setLostReason('');
      setLostNote('');
      // Ganho → abre o contrato de venda já preenchido (ou o contrato existente)
      if (result.nextStep?.url) {
        toast.success(
          result.nextStep.type === 'OPEN_CONTRACT'
            ? 'Negócio ganho. Este negócio já tem contrato: abrindo.'
            : 'Negócio ganho! Abrindo o contrato de venda já preenchido.',
        );
        router.push(result.nextStep.url);
        return;
      }
      toast.success('Negócio movido com sucesso');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao mover negócio'));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {deal.stage && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border font-medium"
                  style={{ borderColor: deal.stage.color, color: deal.stage.color }}
                >
                  {deal.stage.name}
                </span>
              )}
              {deal.pipeline && (
                <span className="text-xs text-muted-foreground">{deal.pipeline.name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTaskModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Atividade
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMoveModal(true)}>
            <ArrowRight className="w-4 h-4 mr-1.5" />
            Mover Etapa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          {/* Valor */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(deal.value)}</p>
            </CardContent>
          </Card>

          {/* Contato */}
          {deal.contact && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/contacts/${deal.contact.id}`} className="font-medium hover:underline text-sm">
                  {deal.contact.name}
                </Link>
                {deal.contact.email && (
                  <p className="text-xs text-muted-foreground mt-0.5">{deal.contact.email}</p>
                )}
                {deal.contact.phone && (
                  <p className="text-xs text-muted-foreground">{deal.contact.phone}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Previsão de fechamento */}
          {deal.expectedCloseAt && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Previsão de Fechamento</p>
                    <p className="text-sm font-medium">
                      {new Date(deal.expectedCloseAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {deal.tags && deal.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {deal.tags.map(({ tag }: { tag: { id: string; name: string; color: string } }) => (
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

          {/* Histórico de etapas */}
          {deal.stageHistory && deal.stageHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Histórico de Etapas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deal.stageHistory.map((h: { id: string; movedAt: string; stage: { name: string; color: string }; daysInStage?: number }) => (
                  <div key={h.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: h.stage.color }} className="font-medium">
                      {h.stage.name}
                    </span>
                    <div className="text-muted-foreground text-right">
                      <div>{new Date(h.movedAt).toLocaleDateString('pt-BR')}</div>
                      {h.daysInStage != null && h.daysInStage > 0 && (
                        <div>{h.daysInStage}d</div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna direita: funil (Fase 3) + atividades */}
        <div className="col-span-2 space-y-4">
          {deal.lostReason && deal.stage?.isLost && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Perdido — motivo: <strong>{lostReasonLabel(deal.lostReason)}</strong>
              {deal.lostNote && <> · {deal.lostNote}</>}
            </div>
          )}
          {deal.stage?.isWon && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
              <span>Negócio ganho.</span>
              <Button size="sm" onClick={() => router.push(`/contracts/new?dealId=${id}`)}>Abrir contrato de venda</Button>
            </div>
          )}
          <DealPropertiesPanel dealId={id} items={dealProps} />
          <DealVisitsPanel dealId={id} propertyIds={dealProps.map((p) => p.propertyId)} />
          <DealProposalsPanel
            dealId={id}
            closed={!!(deal.stage?.isWon || deal.stage?.isLost)}
            properties={dealProps.map((p) => ({ id: p.propertyId, code: p.property?.code ?? p.propertyId }))}
          />
          <ActivityFeed
            activities={activities as Activity[]}
            dealId={id}
          />
        </div>
      </div>

      {/* Modal mover etapa */}
      <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para outra Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Etapa de Destino</Label>
              <Select value={targetStageId} onValueChange={setTargetStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {deal.pipeline?.stages
                    ?.filter((s: {id: string}) => s.id !== deal.stageId)
                    .map((s: {id: string; name: string; color: string; isLost: boolean; isWon: boolean}) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span style={{ color: s.color }}>{s.name}</span>
                        {s.isLost && ' (Perdido)'}
                        {s.isWon && ' (Ganho)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {isLostStage && (
              <>
                <div className="space-y-1">
                  <Label>Motivo da Perda *</Label>
                  <Select value={lostReason} onValueChange={setLostReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOST_REASONS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Observação</Label>
                  <Textarea
                    value={lostNote}
                    onChange={(e) => setLostNote(e.target.value)}
                    placeholder="Detalhes sobre a perda..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowMoveModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleMoveStage()}
              disabled={!targetStageId || (isLostStage && !lostReason) || moveStage.isPending}
            >
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal nova atividade */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
          </DialogHeader>
          <TaskForm
            dealId={id}
            contactId={deal.contactId}
            onSuccess={() => setShowTaskModal(false)}
            onCancel={() => setShowTaskModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
