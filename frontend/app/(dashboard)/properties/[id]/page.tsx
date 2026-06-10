// Página de detalhe do imóvel com tabs, fotos, status e QR code
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Bed, Bath, Car, Maximize, QrCode, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { PropertyStatusBadge } from '@/components/erp/property-status-badge';
import { useProperty, useChangePropertyStatus } from '@/hooks/use-properties';
import api from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Apartamento', HOUSE: 'Casa', COMMERCIAL: 'Comercial',
  LAND: 'Terreno', WAREHOUSE: 'Galpão', LAUNCH: 'Lançamento', RURAL: 'Rural',
};

const PURPOSE_LABELS: Record<string, string> = {
  SALE: 'Venda', RENTAL: 'Aluguel', SALE_RENTAL: 'Venda/Aluguel',
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [qrData, setQrData] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  const { data: property, isLoading } = useProperty(id);
  const changeStatus = useChangePropertyStatus();

  async function loadQrCode() {
    const { data } = await api.get(`/properties/${id}/qrcode`);
    setQrData(data.dataUrl);
  }

  async function handleChangeStatus() {
    if (!newStatus) return;
    await changeStatus.mutateAsync({ id, status: newStatus, note: statusNote || undefined });
    setShowStatusDialog(false);
    setNewStatus('');
    setStatusNote('');
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  if (!property) {
    return <div className="p-6">Imóvel não encontrado</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{property.code}</h1>
              <Badge variant="outline">{TYPE_LABELS[property.type] ?? property.type}</Badge>
              <Badge variant="secondary">{PURPOSE_LABELS[property.purpose] ?? property.purpose}</Badge>
              <PropertyStatusBadge status={property.status} />
            </div>
            {property.street && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {property.street}, {property.number} — {property.neighborhood}, {property.city}/{property.state}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {/* QR Code */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={loadQrCode}>
                <QrCode className="w-4 h-4 mr-1.5" />
                QR Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>QR Code do Imóvel</DialogTitle>
              </DialogHeader>
              {qrData && (
                <div className="flex flex-col items-center gap-4">
                  <img src={qrData} alt="QR Code" className="w-48 h-48" />
                  <p className="text-xs text-muted-foreground text-center">
                    Escaneie para acessar o imóvel no portal
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Alterar status */}
          <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <DialogTrigger asChild>
              <Button size="sm">Alterar Status</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Status do Imóvel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Novo status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Disponível</SelectItem>
                    <SelectItem value="RESERVED">Reservado</SelectItem>
                    <SelectItem value="RENTED">Alugado</SelectItem>
                    <SelectItem value="SOLD">Vendido</SelectItem>
                    <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
                    <SelectItem value="INACTIVE">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  placeholder="Observação (opcional)..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={handleChangeStatus}
                  disabled={!newStatus || changeStatus.isPending}
                >
                  Confirmar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Galeria de fotos */}
      {property.photos && property.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {property.photos.map((photo, i) => (
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption ?? `Foto ${i + 1}`}
              className="h-40 w-60 object-cover rounded-lg flex-shrink-0"
            />
          ))}
        </div>
      )}

      {/* Características rápidas */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {property.bedrooms != null && (
          <span className="flex items-center gap-1.5">
            <Bed className="w-4 h-4" /> {property.bedrooms} quartos
          </span>
        )}
        {property.bathrooms != null && (
          <span className="flex items-center gap-1.5">
            <Bath className="w-4 h-4" /> {property.bathrooms} banheiros
          </span>
        )}
        {property.parkingSpaces != null && (
          <span className="flex items-center gap-1.5">
            <Car className="w-4 h-4" /> {property.parkingSpaces} vagas
          </span>
        )}
        {property.totalArea != null && (
          <span className="flex items-center gap-1.5">
            <Maximize className="w-4 h-4" /> {Number(property.totalArea)} m²
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="inspections">Vistorias</TabsTrigger>
          <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Valores</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Preço de Venda</span><span className="font-medium">{formatCurrency(property.salePrice)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Aluguel</span><span className="font-medium">{formatCurrency(property.rentalPrice)}/mês</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IPTU Mensal</span><span>{formatCurrency(property.iptuMonthly)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Condomínio</span><span>{formatCurrency(property.condoMonthly)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Proprietário</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {property.owner ? (
                  <p className="font-medium">{property.owner.name}</p>
                ) : (
                  <p className="text-muted-foreground">Não informado</p>
                )}
              </CardContent>
            </Card>
          </div>
          {property.description && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Descrição</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{property.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          {(property as any).contracts?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum contrato associado</p>
          ) : (
            <div className="space-y-2">
              {(property as any).contracts?.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.type}</p>
                      <p className="text-xs text-muted-foreground">{c.status}</p>
                    </div>
                    <Badge variant="outline">{c.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inspections" className="mt-4">
          <p className="text-muted-foreground text-sm">Vistorias serão listadas aqui</p>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          {(property as any).maintenanceOrders?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma ordem de manutenção</p>
          ) : (
            <div className="space-y-2">
              {(property as any).maintenanceOrders?.map((m: any) => (
                <Card key={m.id}>
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{m.type} • {m.priority} • {m.status}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <p className="text-muted-foreground text-sm">Documentos serão listados aqui</p>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="space-y-2">
            {(property as any).statusHistory?.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <span className="font-medium">{h.status}</span>
                  {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                  <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
