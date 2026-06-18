'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@investimentos.local');
  const [password, setPassword] = useState('senha123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.auth.login(email, password);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D1B2A' }}>
      <div style={{ background: '#112236', border: '1px solid #1E3A5F', borderRadius: 20, padding: '2.5rem', width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💎</div>
          <h1 style={{ color: '#C9A227', fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Controle de Investimentos
          </h1>
          <p style={{ color: '#6B8CAE', fontSize: '0.875rem', marginTop: 6 }}>
            Sistema Patrimonial Pessoal
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.625rem 0.875rem', color: '#EF4444', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(201,162,39,0.05)', borderRadius: 8, border: '1px solid rgba(201,162,39,0.15)' }}>
          <p style={{ color: '#94A3B8', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
            Credenciais padrão: <span style={{ color: '#C9A227' }}>admin@investimentos.local / senha123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
