// Página de cadastro de novo imóvel - formulário multi-step
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateProperty } from '@/hooks/use-properties';

const STEPS = ['Tipo & Endereço', 'Características', 'Valores', 'Revisão'];

type FormData = {
  type: string;
  purpose: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  totalArea: string;
  privateArea: string;
  bedrooms: string;
  suites: string;
  bathrooms: string;
  parkingSpaces: string;
  floor: string;
  acceptsPets: boolean;
  furnished: boolean;
  salePrice: string;
  rentalPrice: string;
  iptuMonthly: string;
  condoMonthly: string;
  description: string;
};

export default function NewPropertyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    type: '',
    purpose: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    totalArea: '',
    privateArea: '',
    bedrooms: '',
    suites: '',
    bathrooms: '',
    parkingSpaces: '',
    floor: '',
    acceptsPets: false,
    furnished: false,
    salePrice: '',
    rentalPrice: '',
    iptuMonthly: '',
    condoMonthly: '',
    description: '',
  });

  const createProperty = useCreateProperty();

  function setField(key: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    try {
      const payload: Record<string, unknown> = {
        type: formData.type,
        purpose: formData.purpose,
        zipCode: formData.zipCode || undefined,
        street: formData.street || undefined,
        number: formData.number || undefined,
        complement: formData.complement || undefined,
        neighborhood: formData.neighborhood || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        totalArea: formData.totalArea ? parseFloat(formData.totalArea) : undefined,
        privateArea: formData.privateArea ? parseFloat(formData.privateArea) : undefined,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        suites: formData.suites ? parseInt(formData.suites) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        parkingSpaces: formData.parkingSpaces ? parseInt(formData.parkingSpaces) : undefined,
        floor: formData.floor ? parseInt(formData.floor) : undefined,
        acceptsPets: formData.acceptsPets,
        furnished: formData.furnished,
        salePrice: formData.salePrice ? parseFloat(formData.salePrice) : undefined,
        rentalPrice: formData.rentalPrice ? parseFloat(formData.rentalPrice) : undefined,
        iptuMonthly: formData.iptuMonthly ? parseFloat(formData.iptuMonthly) : undefined,
        condoMonthly: formData.condoMonthly ? parseFloat(formData.condoMonthly) : undefined,
        description: formData.description || undefined,
      };

      const result = await createProperty.mutateAsync(payload);
      router.push(`/properties/${result.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao cadastrar imóvel.';
      alert(msg);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Novo Imóvel</h1>
      </div>

      {/* Indicador de etapas */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-gray-200" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Etapa 0: Tipo & Endereço */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
                  <Select value={formData.type} onValueChange={(v) => setField('type', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APARTMENT">Apartamento</SelectItem>
                      <SelectItem value="HOUSE">Casa</SelectItem>
                      <SelectItem value="COMMERCIAL">Comercial</SelectItem>
                      <SelectItem value="LAND">Terreno</SelectItem>
                      <SelectItem value="WAREHOUSE">Galpão</SelectItem>
                      <SelectItem value="LAUNCH">Lançamento</SelectItem>
                      <SelectItem value="RURAL">Rural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Finalidade *</Label>
                  <Select value={formData.purpose} onValueChange={(v) => setField('purpose', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SALE">Venda</SelectItem>
                      <SelectItem value="RENTAL">Aluguel</SelectItem>
                      <SelectItem value="SALE_RENTAL">Venda e Aluguel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={formData.zipCode}
                    onChange={(e) => setField('zipCode', e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Rua</Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => setField('street', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input value={formData.number} onChange={(e) => setField('number', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Complemento</Label>
                  <Input value={formData.complement} onChange={(e) => setField('complement', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={formData.neighborhood} onChange={(e) => setField('neighborhood', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={formData.city} onChange={(e) => setField('city', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Input placeholder="SP" value={formData.state} onChange={(e) => setField('state', e.target.value)} maxLength={2} />
                </div>
              </div>
            </>
          )}

          {/* Etapa 1: Características */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Área Total (m²)</Label>
                  <Input type="number" value={formData.totalArea} onChange={(e) => setField('totalArea', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Área Privativa (m²)</Label>
                  <Input type="number" value={formData.privateArea} onChange={(e) => setField('privateArea', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Quartos</Label>
                  <Input type="number" min={0} value={formData.bedrooms} onChange={(e) => setField('bedrooms', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Suítes</Label>
                  <Input type="number" min={0} value={formData.suites} onChange={(e) => setField('suites', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Banheiros</Label>
                  <Input type="number" min={0} value={formData.bathrooms} onChange={(e) => setField('bathrooms', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Vagas de Garagem</Label>
                  <Input type="number" min={0} value={formData.parkingSpaces} onChange={(e) => setField('parkingSpaces', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Andar</Label>
                  <Input type="number" value={formData.floor} onChange={(e) => setField('floor', e.target.value)} />
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="acceptsPets"
                    checked={formData.acceptsPets}
                    onChange={(e) => setField('acceptsPets', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="acceptsPets">Aceita pets</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="furnished"
                    checked={formData.furnished}
                    onChange={(e) => setField('furnished', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="furnished">Mobiliado</Label>
                </div>
              </div>
            </>
          )}

          {/* Etapa 2: Valores */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Preço de Venda (R$)</Label>
                  <Input type="number" placeholder="0.00" value={formData.salePrice} onChange={(e) => setField('salePrice', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Aluguel Mensal (R$)</Label>
                  <Input type="number" placeholder="0.00" value={formData.rentalPrice} onChange={(e) => setField('rentalPrice', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>IPTU Mensal (R$)</Label>
                  <Input type="number" placeholder="0.00" value={formData.iptuMonthly} onChange={(e) => setField('iptuMonthly', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Condomínio Mensal (R$)</Label>
                  <Input type="number" placeholder="0.00" value={formData.condoMonthly} onChange={(e) => setField('condoMonthly', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={4}
                  placeholder="Descreva o imóvel..."
                  value={formData.description}
                  onChange={(e) => setField('description', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Etapa 3: Revisão */}
          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="font-medium">Tipo:</span> {formData.type}</div>
                <div><span className="font-medium">Finalidade:</span> {formData.purpose}</div>
                <div><span className="font-medium">Endereço:</span> {[formData.street, formData.number, formData.neighborhood, formData.city, formData.state].filter(Boolean).join(', ')}</div>
                <div><span className="font-medium">Quartos:</span> {formData.bedrooms || '-'}</div>
                <div><span className="font-medium">Área:</span> {formData.totalArea ? `${formData.totalArea} m²` : '-'}</div>
                <div><span className="font-medium">Preço Venda:</span> {formData.salePrice ? `R$ ${formData.salePrice}` : '-'}</div>
                <div><span className="font-medium">Aluguel:</span> {formData.rentalPrice ? `R$ ${formData.rentalPrice}/mês` : '-'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navegação */}
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && (!formData.type || !formData.purpose)}
          >
            Próximo
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createProperty.isPending}>
            {createProperty.isPending ? 'Salvando...' : 'Cadastrar Imóvel'}
          </Button>
        )}
      </div>
    </div>
  );
}
