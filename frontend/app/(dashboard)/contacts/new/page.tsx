// Página de criação de novo contato
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/components/crm/contact-form';

export default function NewContactPage() {
  const router = useRouter();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Contato</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do novo contato</p>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <ContactForm
          onSuccess={() => router.push('/contacts')}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
