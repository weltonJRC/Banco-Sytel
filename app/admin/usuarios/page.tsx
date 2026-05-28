'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { fetchProfiles } from '@/lib/dataProvider';
import { formatDateTime } from '@/lib/formatters';
import { ShieldCheck, UserCheck, UserX, UserPlus, Info } from 'lucide-react';

interface ProfileRow {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  created_at: string;
}

export default function UsuariosAdminPage() {
  const [data, setData] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchProfiles();
        setData(res);
      } catch (err) {
        console.error('Erro ao carregar perfis:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getProfileRoleLabel = (role: string) => {
    const roles: { [key: string]: { label: string; bg: string; text: string } } = {
      jrc_admin: { label: 'Administrador JRC', bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
      jrc_operacao: { label: 'Operador JRC', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
      jrc_auditoria: { label: 'Auditor JRC', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
      cetesb_consulta: { label: 'Consulta CETESB', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700' },
      cetesb_gestao: { label: 'Gestor CETESB', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' }
    };
    
    return roles[role] || { label: role, bg: 'bg-gray-100 border-gray-300', text: 'text-gray-700' };
  };

  return (
    <AppLayout title="Administração de Usuários">
      <div className="space-y-6">
        
        {/* Topo com Título */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Gerenciamento de Perfis de Acesso
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Administração de permissões e controle de contas JRC e CETESB autorizadas
            </p>
          </div>
          
          <button
            onClick={() => alert('Para criar novos usuários autenticados, siga o checklist do docs/CHECKLIST_MANUAL.md usando o painel do Supabase Auth e insira os perfis correspondentes.')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Usuário
          </button>
        </div>

        {/* Alerta Informativo de Integração */}
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-5 text-sm text-slate-800 flex items-start gap-3 shadow-sm select-none">
          <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-slate-900 mb-1">
              Integração com Supabase Auth
            </p>
            <p>
              Esta tela exibe os perfis cadastrados na tabela <code>public.profiles</code>. No modo real, a tabela está protegida por RLS e 
              vinculada diretamente ao ID de segurança das contas criadas no Supabase Auth. Você pode ativar e desativar contas alterando o campo 
              <code>ativo</code> para <code>false</code> diretamente no painel do Supabase, o que interromperá o acesso imediatamente.
            </p>
          </div>
        </div>

        {/* Tabela de Perfis de Acesso */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Nome Completo</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">E-mail de Acesso</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Perfil de Acesso</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Status do Usuário</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Data de Criação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array(3).fill(0).map((_, idx) => (
                    <tr key={idx} className="animate-pulse bg-white">
                      {Array(5).fill(0).map((_, cIdx) => (
                        <td key={cIdx} className="px-6 py-4">
                          <div className="h-4 bg-slate-100 rounded w-full"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data.length > 0 ? (
                  data.map((user) => {
                    const style = getProfileRoleLabel(user.perfil);
                    return (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{user.nome}</td>
                        <td className="px-6 py-4 text-slate-600 font-semibold">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.ativo ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              <UserCheck className="w-3.5 h-3.5" />
                              Conta Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <UserX className="w-3.5 h-3.5" />
                              Conta Inativa
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-semibold">
                          {formatDateTime(user.created_at)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-xs font-semibold">
                      Nenhum perfil cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
