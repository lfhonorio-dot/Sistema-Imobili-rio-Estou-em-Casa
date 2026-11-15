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
import { useState } from 'react';
import { useContacts, useCreateContact, useUpdateContact } from '@/hooks/use-contacts';
import { getApiErrorMessage } from '@/lib/api-error';
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
  maritalStatus: z.string().optional(),
  marriageRegime: z.string().optional(),
  spouseContactId: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  contact?: Contact;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Busca de endereço pelo CEP no ViaCEP (serviço público e gratuito).
// Só o CEP sai do navegador; nenhum dado pessoal é enviado.
async function fetchCepData(cep: string): Promise<{ street: string; neighborhood: string; city: string; state: string }> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) throw new Error('Informe um CEP com 8 dígitos.');
  let res: Response;
  try {
    res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  } catch {
    throw new Error('Sem conexão com o serviço de CEP. Preencha o endereço manualmente.');
  }
  const data = (await res.json().catch(() => null)) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string } | null;
  if (!res.ok || !data || data.erro) throw new Error('CEP não encontrado. Confira o número ou preencha manualmente.');
  return { street: data.logradouro ?? '', neighborhood: data.bairro ?? '', city: data.localidade ?? '', state: data.uf ?? '' };
}

const MARITAL_LABELS: Record<string, string> = {
  SOLTEIRO: 'Solteiro(a)', CASADO: 'Casado(a)', UNIAO_ESTAVEL: 'União estável',
  DIVORCIADO: 'Divorciado(a)', VIUVO: 'Viúvo(a)', SEPARADO: 'Separado(a)',
};
const REGIME_LABELS: Record<string, string> = {
  COMUNHAO_PARCIAL: 'Comunhão parcial de bens', COMUNHAO_UNIVERSAL: 'Comunhão universal de bens',
  SEPARACAO_TOTAL: 'Separação total (convencional)', SEPARACAO_OBRIGATORIA: 'Separação obrigatória',
  PARTICIPACAO_FINAL: 'Participação final nos aquestos',
};
const nativeSelect =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

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
      maritalStatus: contact?.maritalStatus ?? '',
      marriageRegime: contact?.marriageRegime ?? '',
      spouseContactId: contact?.spouseContactId ?? '',
    },
  });

  const type = watch('type');
  const marketingConsent = watch('marketingConsent');
  const maritalStatus = watch('maritalStatus');
  const married = maritalStatus === 'CASADO' || maritalStatus === 'UNIAO_ESTAVEL';
  const [cepLoading, setCepLoading] = useState(false);
  const spouseContacts = useContacts({ limit: 500, type: 'PERSON' });
  const spouseOptions = ((spouseContacts.data?.items ?? []) as Array<{ id: string; name: string }>).filter((c) => c.id !== contact?.id);

  // force=true reenvia confirmando a criação apesar do e-mail/telefone repetido
  const onSubmit = async (raw: ContactFormValues, force = false) => {
    // campos de seleção vazios viram null (o backend aceita null para limpar)
    const data = {
      ...raw,
      maritalStatus: raw.maritalStatus || null,
      marriageRegime: raw.maritalStatus === 'CASADO' || raw.maritalStatus === 'UNIAO_ESTAVEL' ? raw.marriageRegime || null : null,
      spouseContactId: raw.maritalStatus === 'CASADO' || raw.maritalStatus === 'UNIAO_ESTAVEL' ? raw.spouseContactId || null : null,
    };
    try {
      if (isEditing && contact) {
        await updateContact.mutateAsync({ id: contact.id, ...data });
        toast.success('Contato atualizado');
      } else {
        await createContact.mutateAsync(force ? { ...data, force: true } : data);
        toast.success('Contato criado');
      }
      onSuccess?.();
    } catch (err: unknown) {
      const response = (err as {
        response?: {
          status?: number;
          data?: {
            message?: string | string[];
            code?: string;
            duplicates?: Array<{ name: string; email?: string | null; phone?: string | null }>;
          };
        };
      })?.response;

      // 409 com code DUPLICATE_CONTACT = e-mail/telefone já usados por outro
      // contato. Não é bloqueio: pergunta e reenvia com force. Duplicidade de
      // CPF/CNPJ vem sem esse code e continua sendo bloqueio de verdade.
      if (!isEditing && !force && response?.status === 409 && response.data?.code === 'DUPLICATE_CONTACT') {
        const dup = response.data.duplicates?.[0];
        const dupLabel = dup
          ? `${dup.name}${dup.email ? ` (${dup.email})` : dup.phone ? ` (${dup.phone})` : ''}`
          : 'um contato existente';
        const confirmed = window.confirm(
          `Já existe um contato com este e-mail ou telefone: ${dupLabel}.\n\nDeseja cadastrar assim mesmo?`,
        );
        if (confirmed) await onSubmit(raw, true);
        return;
      }

      const apiMsg = response?.data?.message;
      const displayMsg = Array.isArray(apiMsg) ? apiMsg[0] : apiMsg;
      toast.error(displayMsg || 'Erro ao salvar contato. Verifique os dados e tente novamente.');
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit((data) => onSubmit(data))(e)} className="space-y-4">
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

      {/* Estado civil e cônjuge (Fase 2) — a venda exige anuência do cônjuge */}
      {type === 'PERSON' && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="maritalStatus">Estado civil</Label>
              <select id="maritalStatus" className={nativeSelect} {...register('maritalStatus')}>
                <option value="">Não informado</option>
                {Object.entries(MARITAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {married && (
              <div className="space-y-1">
                <Label htmlFor="marriageRegime">Regime de bens</Label>
                <select id="marriageRegime" className={nativeSelect} {...register('marriageRegime')}>
                  <option value="">Não informado</option>
                  {Object.entries(REGIME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
          {married && (
            <div className="space-y-1">
              <Label htmlFor="spouseContactId">Cônjuge / companheiro(a)</Label>
              <select id="spouseContactId" className={nativeSelect} {...register('spouseContactId')}>
                <option value="">Selecione o contato do cônjuge…</option>
                {spouseOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                Cadastre o cônjuge como contato antes. Ele precisa assinar a venda junto.
              </p>
              {spouseContacts.isError && <p className="text-xs text-red-600">{getApiErrorMessage(spouseContacts.error)}</p>}
            </div>
          )}
        </div>
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
            disabled={cepLoading}
            onClick={async () => {
              setCepLoading(true);
              try {
                const addr = await fetchCepData(watch('zipCode') ?? '');
                setValue('street', addr.street);
                setValue('neighborhood', addr.neighborhood);
                setValue('city', addr.city);
                setValue('state', addr.state);
                toast.success('Endereço preenchido pelo CEP');
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setCepLoading(false);
              }
            }}
          >
            {cepLoading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
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
            <SelectItem value="PLACA">Placa no imóvel</SelectItem>
            <SelectItem value="OUTRO">Outro</SelectItem>
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
