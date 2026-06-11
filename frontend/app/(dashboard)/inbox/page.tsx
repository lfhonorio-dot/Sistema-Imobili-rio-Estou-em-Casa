// Página de Caixa de Entrada — Hub de Comunicação
'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Plus, Filter } from 'lucide-react';
import { useConversations, type Conversation } from '@/hooks/use-conversations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  INSTAGRAM: 'Instagram',
  CHAT_INTERNO: 'Chat Interno',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-gray-100 text-gray-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

export default function InboxPage() {
  const {
    conversations, selected, messages, loading,
    fetchConversations, selectConversation, sendMessage, changeStatus,
  } = useConversations();

  const [text, setText] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations(channelFilter ? { channel: channelFilter } : undefined);
  }, [channelFilter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelect = (conv: Conversation) => {
    selectConversation(conv.id);
  };

  const handleSend = async () => {
    if (!text.trim() || !selected) return;
    await sendMessage(selected.id, text.trim());
    setText('');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Lista de conversas */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Caixa de Entrada
            </h2>
          </div>
          <div className="flex gap-1 flex-wrap">
            {['', 'WHATSAPP', 'EMAIL', 'CHAT_INTERNO'].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                  channelFilter === ch
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white text-muted-foreground border-border hover:bg-accent',
                )}
              >
                {ch === '' ? 'Todos' : CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv)}
              className={cn(
                'w-full text-left p-3 hover:bg-accent transition-colors',
                selected?.id === conv.id && 'bg-accent',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {conv.contact?.name || 'Sem contato'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.subject || CHANNEL_LABELS[conv.channel] || conv.channel}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant="outline" className={cn('text-xs px-1.5 py-0', STATUS_COLORS[conv.status])}>
                    {conv.status}
                  </Badge>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { locale: ptBR, addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {!loading && conversations.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa encontrada
            </div>
          )}
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* Header da conversa */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selected.contact?.name || 'Sem contato'}</h3>
                <p className="text-sm text-muted-foreground">
                  {CHANNEL_LABELS[selected.channel]} · {selected.contact?.phone || selected.contact?.email || ''}
                </p>
              </div>
              <div className="flex gap-2">
                {selected.status === 'OPEN' && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(selected.id, 'RESOLVED')}>
                    Resolver
                  </Button>
                )}
                {selected.status === 'RESOLVED' && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(selected.id, 'OPEN')}>
                    Reabrir
                  </Button>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm',
                      msg.direction === 'OUTBOUND'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p className={cn(
                      'text-xs mt-1',
                      msg.direction === 'OUTBOUND' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}>
                      {formatDistanceToNow(new Date(msg.createdAt), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input de envio */}
            <div className="p-4 border-t flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!text.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
