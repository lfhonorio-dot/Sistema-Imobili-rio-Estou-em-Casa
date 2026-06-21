// Página do Pipeline Kanban
'use client';

import { useState } from 'react';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { KanbanBoard } from '@/components/crm/kanban-board';
import { DealForm } from '@/components/crm/deal-form';
import { DealCard } from '@/components/crm/deal-card';
import { usePipelines } from '@/hooks/use-pipelines';
import { useDeals } from '@/hooks/use-deals';
import { useRouter } from 'next/navigation';

export default function PipelinePage() {
  const router = useRouter();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showNewDealModal, setShowNewDealModal] = useState(false);

  const { data: pipelines = [], isLoading: loadingPipelines } = usePipelines();

  // Seleciona pipeline padrão quando os dados carregam
  const activePipelineId = selectedPipelineId || pipelines[0]?.id || '';
  const activePipeline = pipelines.find((p) => p.id === activePipelineId);

  const { data: dealsResult, isLoading: loadingDeals } = useDeals({
    pipelineId: activePipelineId,
    limit: 200,
  });
  const deals = dealsResult?.items ?? [];

  if (loadingPipelines) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando pipelines...</p>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Nenhum pipeline cadastrado</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Crie um pipeline para começar a gerenciar seus negócios
        </p>
        <Button onClick={() => router.push('/settings/pipelines')}>
          Criar Pipeline
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={`p-2 transition-colors ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setView('kanban')}
                title="Visualização Kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                className={`p-2 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setView('list')}
                title="Visualização Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button onClick={() => setShowNewDealModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Negócio
            </Button>
          </div>
        </div>

        {/* Seletor de pipeline */}
        {pipelines.length > 1 && (
          <Tabs value={activePipelineId} onValueChange={setSelectedPipelineId}>
            <TabsList>
              {pipelines.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6 overflow-auto">
        {loadingDeals ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">Carregando negócios...</p>
          </div>
        ) : activePipeline ? (
          view === 'kanban' ? (
            <KanbanBoard pipeline={activePipeline} deals={deals} />
          ) : (
            // Visualização em lista
            <div className="space-y-2 max-w-2xl">
              {deals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum negócio neste pipeline
                </div>
              ) : (
                deals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => router.push(`/deals/${deal.id}`)}
                    className="w-full"
                  />
                ))
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Modal de novo negócio */}
      <Dialog open={showNewDealModal} onOpenChange={setShowNewDealModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Negócio</DialogTitle>
          </DialogHeader>
          <DealForm
            defaultPipelineId={activePipelineId}
            onSuccess={() => setShowNewDealModal(false)}
            onCancel={() => setShowNewDealModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
