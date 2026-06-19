'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useIntegrations } from '@/hooks/use-integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Key, Webhook, Plus, Trash2, Play, Copy, Check } from 'lucide-react';

const AVAILABLE_SCOPES = ['read', 'write', 'admin'];

export default function IntegrationsPage() {
  const { accessToken, currentWorkspace } = useAuthStore();
  const token = accessToken ?? '';
  const workspaceId = currentWorkspace?.workspace.id ?? '';
  const integrations = useIntegrations(token, workspaceId);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<unknown[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<unknown[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);

  useEffect(() => {
    integrations.listApiKeys().then(data => { if (data) setApiKeys(data as unknown[]); });
    integrations.listWebhooks().then(data => { if (data) setWebhooks(data as unknown[]); });
    integrations.getAvailableEvents().then(data => { if (data) setAvailableEvents(data as string[]); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    const result = await integrations.createApiKey({ name: newKeyName, scopes: newKeyScopes }) as Record<string, unknown> | null;
    if (result) {
      setCreatedKey(result.key as string);
      setNewKeyName('');
      integrations.listApiKeys().then(data => { if (data) setApiKeys(data as unknown[]); });
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    await integrations.revokeApiKey(id);
    integrations.listApiKeys().then(data => { if (data) setApiKeys(data as unknown[]); });
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0) return;
    await integrations.createWebhook({ url: newWebhookUrl, events: newWebhookEvents });
    setNewWebhookUrl('');
    setNewWebhookEvents([]);
    integrations.listWebhooks().then(data => { if (data) setWebhooks(data as unknown[]); });
  };

  const handleTestWebhook = async (id: string) => {
    await integrations.testWebhook(id);
  };

  const handleDeleteWebhook = async (id: string) => {
    await integrations.deleteWebhook(id);
    integrations.listWebhooks().then(data => { if (data) setWebhooks(data as unknown[]); });
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Gerencie API Keys e Webhooks do seu workspace.</p>
      </div>

      <Tabs defaultValue="api-keys">
        <TabsList>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Criar API Key</CardTitle>
              <CardDescription>Gere uma chave para integrar sistemas externos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nome da chave (ex: Integração ERP)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
              />
              <div className="flex gap-2">
                {AVAILABLE_SCOPES.map(scope => (
                  <label key={scope} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    <span className="text-sm">{scope}</span>
                  </label>
                ))}
              </div>
              <Button onClick={handleCreateApiKey} disabled={integrations.loading}>
                <Plus className="h-4 w-4 mr-2" /> Criar Chave
              </Button>

              {createdKey && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    Copie a chave agora — ela não será exibida novamente:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">{createdKey}</code>
                    <Button size="sm" variant="outline" onClick={handleCopyKey}>
                      {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {(apiKeys as Array<Record<string, unknown>>).map(key => (
              <Card key={key.id as string}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{key.name as string}</p>
                    <p className="text-sm text-muted-foreground font-mono">{key.keyPrefix as string}...</p>
                    <div className="flex gap-1 mt-1">
                      {(key.scopes as string[]).map(scope => (
                        <Badge key={scope} variant="secondary">{scope}</Badge>
                      ))}
                    </div>
                    {(key.lastUsedAt as string | null) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Último uso: {new Date(key.lastUsedAt as string).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeApiKey(key.id as string)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Revogar
                  </Button>
                </CardContent>
              </Card>
            ))}
            {apiKeys.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhuma API Key criada ainda.</p>
            )}
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Criar Webhook</CardTitle>
              <CardDescription>Receba notificações em tempo real sobre eventos da plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="URL do endpoint (https://...)"
                value={newWebhookUrl}
                onChange={e => setNewWebhookUrl(e.target.value)}
              />
              <div>
                <p className="text-sm font-medium mb-2">Eventos:</p>
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                  {availableEvents.map(event => (
                    <label key={event} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWebhookEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                      />
                      <span className="text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateWebhook} disabled={integrations.loading}>
                <Plus className="h-4 w-4 mr-2" /> Criar Webhook
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {(webhooks as Array<Record<string, unknown>>).map(wh => (
              <Card key={wh.id as string}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">{wh.url as string}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(wh.events as string[]).slice(0, 3).map(event => (
                        <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                      ))}
                      {(wh.events as string[]).length > 3 && (
                        <Badge variant="outline" className="text-xs">+{(wh.events as string[]).length - 3}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant={wh.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {wh.status as string}
                      </Badge>
                      {(wh.failureCount as number) > 0 && (
                        <span className="text-xs text-red-500">{wh.failureCount as number} falhas</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => handleTestWebhook(wh.id as string)}>
                      <Play className="h-4 w-4 mr-1" /> Testar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteWebhook(wh.id as string)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {webhooks.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum webhook criado ainda.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
