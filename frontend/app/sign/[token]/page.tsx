// Portal público de assinatura eletrônica (sem autenticação)
// Fluxo: carrega documento -> solicita OTP -> valida OTP -> assina

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Building2, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

// Resolve a base da API igual ao lib/api (proxy em produção)
const API_BASE =
  process.env.NODE_ENV === 'production'
    ? '/api-proxy'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface PortalData {
  signatory: { name: string; email?: string; role?: string; status: string };
  envelope: { title: string; message?: string; deadline?: string; status: string };
}

type Step = 'loading' | 'review' | 'otp' | 'done' | 'rejected' | 'error' | 'already';

export default function SignPage() {
  const params = useParams();
  const token = String(params.token);

  const [step, setStep] = useState<Step>('loading');
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpDev, setOtpDev] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/esignature/portal/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.message || 'Link inválido ou expirado.');
          setStep('error');
          return;
        }
        const portal: PortalData = json.data ?? json;
        setData(portal);
        const st = portal.signatory.status;
        if (st === 'SIGNED') setStep('already');
        else if (st === 'REJECTED') setStep('rejected');
        else setStep('review');
      } catch {
        setError('Não foi possível carregar o documento. Verifique sua conexão.');
        setStep('error');
      }
    })();
  }, [token]);

  async function requestOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/esignature/portal/${token}/otp`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Falha ao gerar código.');
      const payload = json.data ?? json;
      if (payload.otp_dev) setOtpDev(payload.otp_dev); // homologação
      setStep('otp');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSignature() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/esignature/portal/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Código inválido.');
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Assinatura Eletrônica</h1>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Carregando documento...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="font-medium text-gray-900">Não foi possível abrir</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {step === 'already' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-medium text-gray-900">Documento já assinado</p>
              <p className="text-sm text-gray-500">Você já assinou este documento. Obrigado!</p>
            </div>
          )}

          {step === 'rejected' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-orange-500" />
              <p className="font-medium text-gray-900">Assinatura recusada</p>
              <p className="text-sm text-gray-500">Esta solicitação foi recusada anteriormente.</p>
            </div>
          )}

          {step === 'review' && data && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Olá,</p>
                <p className="text-lg font-semibold text-gray-900">{data.signatory.name}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="font-medium text-gray-900">{data.envelope.title}</p>
                {data.envelope.message && (
                  <p className="mt-1 text-sm text-gray-600">{data.envelope.message}</p>
                )}
                {data.envelope.deadline && (
                  <p className="mt-2 text-xs text-gray-500">
                    Prazo: {new Date(data.envelope.deadline).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  Li e concordo com o conteúdo do documento e declaro que sou{' '}
                  <strong>{data.signatory.name}</strong>.
                </span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={requestOtp}
                disabled={!accepted || busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Receber código de validação
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-blue-600" />
                <p className="mt-2 font-medium text-gray-900">Confirme o código</p>
                <p className="text-sm text-gray-500">
                  Enviamos um código de 6 dígitos para validar sua assinatura.
                </p>
              </div>

              {otpDev && (
                <div className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">
                  Código (homologação): <strong className="tracking-widest">{otpDev}</strong>
                </div>
              )}

              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="w-full rounded-lg border border-gray-300 py-3 text-center text-2xl tracking-[0.5em]"
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={submitSignature}
                disabled={otp.length !== 6 || busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Assinar Documento
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <p className="text-lg font-semibold text-gray-900">Documento assinado!</p>
              <p className="text-sm text-gray-500">
                Sua assinatura foi registrada com sucesso em{' '}
                {new Date().toLocaleString('pt-BR')}.
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Assinatura eletrônica com validação por código (OTP) e trilha de auditoria.
        </p>
      </div>
    </div>
  );
}
