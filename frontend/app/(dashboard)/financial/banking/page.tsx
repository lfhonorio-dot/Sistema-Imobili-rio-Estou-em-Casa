'use client';
import { useState, useEffect } from 'react';
import { useBanking } from '@/hooks/use-banking';

type BankAccount = {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  balance: number;
  isDefault: boolean;
  _count?: { transactions: number };
};

export default function BankingPage() {
  const { findAccounts, findTransactions, autoReconcile, loading } = useBanking();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Array<Record<string, unknown>>>([]);

  const loadAccounts = async () => {
    const data = await findAccounts();
    if (data) setAccounts(data);
  };

  const loadTransactions = async (accountId: string) => {
    const data = await findTransactions({ bankAccountId: accountId, limit: 20 });
    if (data) setTransactions(data.items);
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleSelectAccount = (id: string) => {
    setSelectedAccount(id);
    loadTransactions(id);
  };

  const handleAutoReconcile = async (id: string) => {
    const result = await autoReconcile(id);
    if (result) alert(`Conciliação: ${result.matched} de ${result.total} transações conciliadas`);
    loadTransactions(id);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contas Bancárias</h1>
        <p className="text-sm text-gray-500 mt-1">Gerenciamento e conciliação bancária</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => handleSelectAccount(acc.id)}
            className={`text-left p-4 rounded-lg border-2 transition-colors ${
              selectedAccount === acc.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{acc.name}</p>
                {acc.bankName && <p className="text-xs text-gray-500">{acc.bankName}</p>}
                {acc.accountNumber && <p className="text-xs text-gray-400 font-mono">{acc.accountNumber}</p>}
              </div>
              {acc.isDefault && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Padrão</span>
              )}
            </div>
            <p className="mt-2 text-lg font-bold text-gray-900">
              {acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-xs text-gray-400">{acc._count?.transactions ?? 0} transações</p>
          </button>
        ))}
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-800">Transações</h2>
            <button
              onClick={() => handleAutoReconcile(selectedAccount)}
              className="text-sm text-blue-600 hover:underline"
            >
              Conciliar Automaticamente
            </button>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Data</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Descrição</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Conciliado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id as string} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(tx.date as string).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{tx.description as string}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      (tx.amount as number) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(tx.amount as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3">
                      {tx.reconciled ? (
                        <span className="text-xs text-green-600">✓ Sim</span>
                      ) : (
                        <span className="text-xs text-gray-400">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
