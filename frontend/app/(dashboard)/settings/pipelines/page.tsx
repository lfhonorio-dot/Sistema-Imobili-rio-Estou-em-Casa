'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  usePipelines,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
  useCreateStage,
  useUpdateStage,
  useDeleteStage,
  type Pipeline,
  type PipelineStage,
} from '@/hooks/use-pipelines';

const PIPELINE_TYPES = [
  { value: 'SALES', label: 'Vendas' },
  { value: 'RENTAL', label: 'Locação' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

const STAGE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`w-7 h-7 rounded-full border-2 transition-transform ${value === c ? 'border-foreground scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export default function PipelinesSettingsPage() {
  const { data: pipelines = [], isLoading } = usePipelines();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pipeline modals
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [editPipeline, setEditPipeline] = useState<Pipeline | null>(null);
  const [deletePipelineTarget, setDeletePipelineTarget] = useState<Pipeline | null>(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineType, setPipelineType] = useState('SALES');

  // Stage modals
  const [showNewStage, setShowNewStage] = useState<string | null>(null); // pipelineId
  const [editStageTarget, setEditStageTarget] = useState<{ stage: PipelineStage; pipelineId: string } | null>(null);
  const [deleteStageTarget, setDeleteStageTarget] = useState<{ stage: PipelineStage; pipelineId: string } | null>(null);
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState(STAGE_COLORS[0]);

  function openNewPipeline() {
    setPipelineName('');
    setPipelineType('SALES');
    setShowNewPipeline(true);
  }

  async function handleCreatePipeline() {
    if (!pipelineName.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      await createPipeline.mutateAsync({ name: pipelineName.trim(), type: pipelineType });
      toast.success('Pipeline criado!');
      setShowNewPipeline(false);
    } catch {
      toast.error('Erro ao criar pipeline');
    }
  }

  function openEditPipeline(p: Pipeline) {
    setEditPipeline(p);
    setPipelineName(p.name);
  }

  async function handleUpdatePipeline() {
    if (!editPipeline || !pipelineName.trim()) return;
    try {
      await updatePipeline.mutateAsync({ id: editPipeline.id, name: pipelineName.trim() });
      toast.success('Pipeline atualizado!');
      setEditPipeline(null);
    } catch {
      toast.error('Erro ao atualizar pipeline');
    }
  }

  async function handleDeletePipeline() {
    if (!deletePipelineTarget) return;
    try {
      await deletePipeline.mutateAsync(deletePipelineTarget.id);
      toast.success('Pipeline excluído!');
      setDeletePipelineTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir pipeline';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  function openNewStage(pipelineId: string) {
    setStageName('');
    setStageColor(STAGE_COLORS[0]);
    setShowNewStage(pipelineId);
  }

  async function handleCreateStage() {
    if (!showNewStage || !stageName.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      await createStage.mutateAsync({ pipelineId: showNewStage, name: stageName.trim(), color: stageColor });
      toast.success('Estágio criado!');
      setShowNewStage(null);
    } catch {
      toast.error('Erro ao criar estágio');
    }
  }

  function openEditStage(stage: PipelineStage, pipelineId: string) {
    setEditStageTarget({ stage, pipelineId });
    setStageName(stage.name);
    setStageColor(stage.color);
  }

  async function handleUpdateStage() {
    if (!editStageTarget || !stageName.trim()) return;
    try {
      await updateStage.mutateAsync({
        pipelineId: editStageTarget.pipelineId,
        stageId: editStageTarget.stage.id,
        name: stageName.trim(),
        color: stageColor,
      });
      toast.success('Estágio atualizado!');
      setEditStageTarget(null);
    } catch {
      toast.error('Erro ao atualizar estágio');
    }
  }

  async function handleDeleteStage() {
    if (!deleteStageTarget) return;
    try {
      await deleteStage.mutateAsync({ pipelineId: deleteStageTarget.pipelineId, stageId: deleteStageTarget.stage.id });
      toast.success('Estágio excluído!');
      setDeleteStageTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir estágio';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipelines</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus funis de negócios e etapas</p>
        </div>
        <Button onClick={openNewPipeline}>
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Pipeline
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : pipelines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum pipeline cadastrado. Crie o primeiro para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => {
            const isOpen = expandedId === p.id;
            const typeLabel = PIPELINE_TYPES.find((t) => t.value === p.type)?.label ?? p.type;
            return (
              <Card key={p.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-2 text-left flex-1"
                      onClick={() => setExpandedId(isOpen ? null : p.id)}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                      {p.isDefault && <Badge variant="outline" className="text-xs">Padrão</Badge>}
                      <span className="text-xs text-muted-foreground ml-1">{p.stages.length} etapas</span>
                    </button>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPipeline(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletePipelineTarget(p)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0 pb-3 px-4 space-y-2">
                    <div className="space-y-1.5">
                      {p.stages
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 p-2 rounded border bg-muted/30"
                          >
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-sm flex-1">{s.name}</span>
                            {s.isWon && <Badge variant="outline" className="text-xs text-green-600 border-green-300">Ganho</Badge>}
                            {s.isLost && <Badge variant="outline" className="text-xs text-red-600 border-red-300">Perdido</Badge>}
                            <span className="text-xs text-muted-foreground">{s._count?.deals ?? 0} negócios</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditStage(s, p.id)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => setDeleteStageTarget({ stage: s, pipelineId: p.id })}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openNewStage(p.id)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Etapa
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Pipeline */}
      <Dialog open={showNewPipeline} onOpenChange={setShowNewPipeline}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Vendas Imóveis" value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={pipelineType} onValueChange={setPipelineType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowNewPipeline(false)}>Cancelar</Button>
            <Button onClick={handleCreatePipeline} disabled={createPipeline.isPending}>
              {createPipeline.isPending ? 'Criando...' : 'Criar Pipeline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Pipeline */}
      <Dialog open={!!editPipeline} onOpenChange={(o) => !o && setEditPipeline(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setEditPipeline(null)}>Cancelar</Button>
            <Button onClick={handleUpdatePipeline} disabled={updatePipeline.isPending}>
              {updatePipeline.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Pipeline */}
      <Dialog open={!!deletePipelineTarget} onOpenChange={(o) => !o && setDeletePipelineTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Pipeline</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o pipeline <strong>{deletePipelineTarget?.name}</strong>?
            Todos os negócios associados serão afetados.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeletePipelineTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeletePipeline} disabled={deletePipeline.isPending}>
              {deletePipeline.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Nova Etapa */}
      <Dialog open={!!showNewStage} onOpenChange={(o) => !o && setShowNewStage(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Etapa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Proposta Enviada" value={stageName} onChange={(e) => setStageName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <ColorPicker value={stageColor} onChange={setStageColor} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowNewStage(null)}>Cancelar</Button>
            <Button onClick={handleCreateStage} disabled={createStage.isPending}>
              {createStage.isPending ? 'Criando...' : 'Criar Etapa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Etapa */}
      <Dialog open={!!editStageTarget} onOpenChange={(o) => !o && setEditStageTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Etapa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={stageName} onChange={(e) => setStageName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <ColorPicker value={stageColor} onChange={setStageColor} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setEditStageTarget(null)}>Cancelar</Button>
            <Button onClick={handleUpdateStage} disabled={updateStage.isPending}>
              {updateStage.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Etapa */}
      <Dialog open={!!deleteStageTarget} onOpenChange={(o) => !o && setDeleteStageTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Etapa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a etapa <strong>{deleteStageTarget?.stage.name}</strong>?
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteStageTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteStage} disabled={deleteStage.isPending}>
              {deleteStage.isPending ? 'Excluindo...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
