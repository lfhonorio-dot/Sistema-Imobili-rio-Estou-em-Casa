// Formulário de criação/edição de contato
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateContact, useUpdateContact } from '@/hooks/use-contacts';
import type { Contact } from '@/hooks/use-contacts';
import { toast } from 'sonner';

const contactSchema = z.object({
  type: z.enum(['PERSON', 'COMPANY']),
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  profession: z.string().optional(),
  companyName: z.string().optional(),
  tradeName: z.string().optional(),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  marketingConsent: z.boolean().optional(),
  origin: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  contact?: Contact;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Placeholder para busca de CEP
async function fetchCepData(cep: string): Promise<void> {
  // TODO: Funcionalidade de busca de CEP via ViaCEP será implementada em breve
  console.info('Busca de CEP para:', cep, '- funcionalidade em desenvolvimento');
}

export function ContactForm({ contact, onSuccess, onCancel }: ContactFormProps) {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const isEditing = !!contact;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: (contact?.type as 'PERSON' | 'COMPANY') ?? 'PERSON',
      name: contact?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      cpf: contact?.cpf ?? '',
      cnpj: contact?.cnpj ?? '',
      profession: contact?.profession ?? '',
      companyName: contact?.companyName ?? '',
      tradeName: contact?.tradeName ?? '',
      zipCode: contact?.zipCode ?? '',
      street: contact?.street ?? '',
      number: contact?.number ?? '',
      complement: contact?.complement ?? '',
      neighborhood: contact?.neighborhood ?? '',
      city: contact?.city ?? '',
      state: contact?.state ?? '',
      marketingConsent: contact?.marketingConsent ?? false,
      origin: contact?.origin ?? 'MANUAL',
    },
  });

  const type = watch('type');
  const marketingConsent = watch('marketingConsent');

  const onSubmit = async (data: ContactFormValues) => {
    try {
      if (isEditing && contact) {
        await updateContact.mutateAsync({ id: contact.id, ...data });
        toast.success('Contato atualizado');
      } else {
        await createContact.mutateAsync(data);
        toast.success('Contato criado');
      }
      onSuccess?.();
    } catch {
      toast.error('Erro ao salvar contato');
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      {/* Tipo de Contato */}
      <div className="space-y-1">
        <Label>Tipo de Contato</Label>
        <div className="flex gap-3">
          {(['PERSON', 'COMPANY'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 py-2 px-3 border rounded-md text-sm transition-colors ${
                type === t ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
              }`}
              onClick={() => setValue('type', t)}
            >
              {t === 'PERSON' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>

      {/* Nome */}
      <div className="space-y-1">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" {...register('name')} placeholder="Nome completo" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register('email')} placeholder="email@exemplo.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" {...register('phone')} placeholder="(11) 99999-0000" />
        </div>
      </div>

      {/* CPF/CNPJ */}
      {type === 'PERSON' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" {...register('cpf')} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profession">Profissão</Label>
            <Input id="profession" {...register('profession')} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" {...register('cnpj')} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="companyName">Razão Social</Label>
              <Input id="companyName" {...register('companyName')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tradeName">Nome Fantasia</Label>
            <Input id="tradeName" {...register('tradeName')} />
          </div>
        </>
      )}

      {/* Endereço */}
      <div className="space-y-1">
        <Label htmlFor="zipCode">CEP</Label>
        <div className="flex gap-2">
          <Input
            id="zipCode"
            {...register('zipCode')}
            placeholder="00000-000"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchCepData(watch('zipCode') ?? '')}
          >
            Buscar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Busca automática de CEP em breve</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="street">Rua</Label>
          <Input id="street" {...register('street')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="number">Número</Label>
          <Input id="number" {...register('number')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" {...register('neighborhood')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" {...register('city')} />
        </div>
      </div>

      {/* Origem */}
      <div className="space-y-1">
        <Label>Origem</Label>
        <Select
          value={watch('origin')}
          onValueChange={(v) => setValue('origin', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a origem" />
          </SelectTrigger>
          <SelectContent>
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

      {/* Consentimento LGPD */}
      <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/20">
        <Switch
          checked={marketingConsent ?? false}
          onCheckedChange={(v) => setValue('marketingConsent', v)}
        />
        <div>
          <p className="text-sm font-medium">Consentimento de Marketing</p>
          <p className="text-xs text-muted-foreground">Autoriza o envio de comunicações de marketing (LGPD)</p>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Contato'}
        </Button>
      </div>
    </form>
  );
}
