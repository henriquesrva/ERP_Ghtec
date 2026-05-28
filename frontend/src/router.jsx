import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute  from './components/layout/ProtectedRoute';
import AppLayout       from './components/layout/AppLayout';
import Login           from './pages/Login';
import Dashboard       from './pages/Dashboard';
import Proposals       from './pages/Proposals';
import Responsaveis    from './pages/Responsaveis';
import Fornecedores    from './pages/Fornecedores';
import Usuarios        from './pages/Usuarios';
import Objetos         from './pages/Objetos';
import Clients         from './pages/Clients';
import Financeiro      from './pages/Financeiro';
import ContasPagar      from './pages/ContasPagar';
import NotasRecebidas  from './pages/NotasRecebidas';
import Stock           from './pages/Stock';
import Parts           from './pages/Parts';
import Kanban          from './pages/Kanban';
import NovaProposta    from './pages/NovaProposta';

// Todas as telas já migradas — lista legacy vazia
const LEGACY = [
  // /nova-proposta já migrado
  // /kanban já migrado
  // /parts já migrado — removido da lista legacy
  // /stock já migrado — removido da lista legacy
  // /financeiro já migrado — removido da lista legacy
  // /contas-pagar já migrado — removido da lista legacy
  // /notas-recebidas já migrado — removido da lista legacy
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
          <Route path="/fornecedores"  element={<Fornecedores />} />
          <Route path="/usuarios"      element={<Usuarios />} />
          <Route path="/objetos"       element={<Objetos />} />
          <Route path="/clients"       element={<Clients />} />
          <Route path="/financeiro"    element={<Financeiro />} />
          <Route path="/contas-pagar"      element={<ContasPagar />} />
          <Route path="/notas-recebidas" element={<NotasRecebidas />} />
          <Route path="/stock"           element={<Stock />} />
          <Route path="/parts"           element={<Parts />} />
          <Route path="/kanban"          element={<Kanban />} />
          <Route path="/nova-proposta"   element={<NovaProposta />} />

          {/* ── Legacy redirects — todas migradas ── */}
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
