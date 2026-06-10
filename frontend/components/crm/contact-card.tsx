// Componente de cartão de contato reutilizável
'use client';

import Link from 'next/link';
import { Phone, Mail, MapPin, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Contact } from '@/hooks/use-contacts';

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  META_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  PORTAL: 'Portal',
  WHATSAPP: 'WhatsApp',
  SITE: 'Site',
  REFERRAL: 'Indicação',
};

interface ContactCardProps {
  contact: Contact;
  className?: string;
  compact?: boolean;
}

export function ContactCard({ contact, className, compact }: ContactCardProps) {
  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Link href={`/contacts/${contact.id}`}>
      <div className={cn(
        'p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer',
        className,
      )}>
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="text-sm bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{contact.name}</p>
              <Badge variant={contact.type === 'COMPANY' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                {contact.type === 'COMPANY' ? 'PJ' : 'PF'}
              </Badge>
            </div>

            {!compact && (
              <div className="mt-1 space-y-1">
                {contact.email && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.city && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{contact.city}{contact.state ? `, ${contact.state}` : ''}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {contact.origin && (
                <Badge variant="outline" className="text-xs">
                  {ORIGIN_LABELS[contact.origin] ?? contact.origin}
                </Badge>
              )}
              {contact.tags?.slice(0, 3).map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
