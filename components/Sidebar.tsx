'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  PhoneCall, 
  Cpu, 
  ShieldCheck, 
  Users, 
  LogOut,
  Layers
} from 'lucide-react';
import { getCurrentUser, signOut } from '../lib/auth';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: ['jrc_admin', 'jrc_operacao', 'jrc_auditoria', 'cetesb_consulta', 'cetesb_gestao']
    },
    {
      label: 'Atendimentos Operação',
      path: '/relatorios/atendimentos-operacao',
      icon: <PhoneCall className="w-5 h-5" />,
      roles: ['jrc_admin', 'jrc_operacao', 'jrc_auditoria', 'cetesb_consulta', 'cetesb_gestao']
    },
    {
      label: 'URA CETESB',
      path: '/relatorios/ura',
      icon: <Cpu className="w-5 h-5" />,
      roles: ['jrc_admin', 'jrc_operacao', 'jrc_auditoria', 'cetesb_consulta', 'cetesb_gestao']
    },
    {
      label: 'Auditoria das Fontes',
      path: '/auditoria',
      icon: <ShieldCheck className="w-5 h-5" />,
      roles: ['jrc_admin', 'jrc_operacao', 'jrc_auditoria', 'cetesb_gestao']
    },
    {
      label: 'Usuários',
      path: '/admin/usuarios',
      icon: <Users className="w-5 h-5" />,
      roles: ['jrc_admin']
    }
  ];

  // Filtra itens baseando-se no perfil de usuário
  const userRole = user?.perfil || 'cetesb_consulta';
  const filteredMenuItems = menuItems.filter(item => item.roles.includes(userRole));

  const getRoleLabel = (role: string) => {
    const roles: { [key: string]: string } = {
      jrc_admin: 'Admin JRC',
      jrc_operacao: 'Op JRC',
      jrc_auditoria: 'Auditor JRC',
      cetesb_consulta: 'Consulta CETESB',
      cetesb_gestao: 'Gestor CETESB'
    };
    return roles[role] || 'Consulta';
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen fixed left-0 top-0 z-30 shadow-lg select-none">
      {/* Header / Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg text-white">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-white leading-tight">Portal CETESB</h1>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Retenção Histórica</span>
        </div>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Caixa de Sessão do Usuário */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-blue-400">
            {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.nome || 'Usuário CETESB'}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email || 'email@cetesb.sp.gov.br'}</p>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-blue-900/40 text-blue-400 text-[9px] font-bold border border-blue-800/30">
              {getRoleLabel(userRole)}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair da Conta
        </button>
      </div>
    </aside>
  );
}
