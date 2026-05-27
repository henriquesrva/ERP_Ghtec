import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute  from './components/layout/ProtectedRoute';
import AppLayout       from './components/layout/AppLayout';
import Login           from './pages/Login';
import Dashboard       from './pages/Dashboard';
import Proposals       from './pages/Proposals';
import Responsaveis    from './pages/Responsaveis';
import LegacyRedirect  from './pages/LegacyRedirect';

// Telas ainda não migradas — abrem a versão legacy
const LEGACY = [
  { path: '/nova-proposta',    href: '/legacy/nova-proposta.html',    label: 'Nova Proposta' },
  { path: '/clients',          href: '/legacy/clients.html',          label: 'Clientes' },
  { path: '/parts',            href: '/legacy/parts.html',            label: 'Peças' },
  { path: '/kanban',           href: '/legacy/kanban.html',           label: 'Kanban' },
  { path: '/stock',            href: '/legacy/stock.html',            label: 'Estoque' },
  { path: '/financeiro',       href: '/legacy/financeiro.html',       label: 'Financeiro' },
  { path: '/contas-pagar',     href: '/legacy/contas-pagar.html',     label: 'Contas a Pagar' },
  { path: '/notas-recebidas',  href: '/legacy/notas-recebidas.html',  label: 'Notas Recebidas' },
  { path: '/fornecedores',     href: '/legacy/fornecedores.html',     label: 'Fornecedores' },
  { path: '/usuarios',         href: '/legacy/usuarios.html',         label: 'Usuários' },
  { path: '/objetos',          href: '/legacy/objetos.html',          label: 'Objetos e Condições' },
];

export default function AppRouter() {
  return (
    <Routes>
      {/* Pública: Login */}
      <Route path="/login" element={<Login />} />

      {/* Protegidas: requerem sessão */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* ── Telas já migradas ── */}
          <Route path="/"              element={<Dashboard />} />
          <Route path="/proposals"     element={<Proposals />} />
          <Route path="/responsaveis"  element={<Responsaveis />} />

          {/* ── Legacy redirects — telas ainda não migradas ── */}
          {LEGACY.map(({ path, href, label }) => (
            <Route
              key={path}
              path={path}
              element={<LegacyRedirect to={href} label={label} />}
            />
          ))}
        </Route>
      </Route>

      {/* Qualquer rota desconhecida → dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
