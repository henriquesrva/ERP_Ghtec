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

export default function AppRouter() {
  return (
    <Routes>
      {/* Pública: Login */}
      <Route path="/login" element={<Login />} />

      {/* Protegidas: requerem sessão */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/"                element={<Dashboard />} />
          <Route path="/proposals"       element={<Proposals />} />
          <Route path="/nova-proposta"   element={<NovaProposta />} />
          <Route path="/kanban"          element={<Kanban />} />
          <Route path="/clients"         element={<Clients />} />
          <Route path="/objetos"         element={<Objetos />} />
          <Route path="/parts"           element={<Parts />} />
          <Route path="/stock"           element={<Stock />} />
          <Route path="/fornecedores"    element={<Fornecedores />} />
          <Route path="/notas-recebidas" element={<NotasRecebidas />} />
          <Route path="/contas-pagar"    element={<ContasPagar />} />
          <Route path="/financeiro"      element={<Financeiro />} />
          <Route path="/responsaveis"    element={<Responsaveis />} />
          <Route path="/usuarios"        element={<Usuarios />} />
        </Route>
      </Route>

      {/* Qualquer rota desconhecida → dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
