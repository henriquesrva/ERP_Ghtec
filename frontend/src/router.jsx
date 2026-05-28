import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute  from './components/layout/ProtectedRoute';
import AppLayout       from './components/layout/AppLayout';
import Loading         from './components/shared/Loading';

// Carregamento imediato: telas de entrada mais frequentes
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';

// Carregamento lazy: demais telas carregadas sob demanda
const Proposals      = lazy(() => import('./pages/Proposals'));
const NovaProposta   = lazy(() => import('./pages/NovaProposta'));
const Kanban         = lazy(() => import('./pages/Kanban'));
const Clients        = lazy(() => import('./pages/Clients'));
const Objetos        = lazy(() => import('./pages/Objetos'));
const Parts          = lazy(() => import('./pages/Parts'));
const Stock          = lazy(() => import('./pages/Stock'));
const Fornecedores   = lazy(() => import('./pages/Fornecedores'));
const NotasRecebidas = lazy(() => import('./pages/NotasRecebidas'));
const ContasPagar    = lazy(() => import('./pages/ContasPagar'));
const Financeiro     = lazy(() => import('./pages/Financeiro'));
const Responsaveis   = lazy(() => import('./pages/Responsaveis'));
const Usuarios       = lazy(() => import('./pages/Usuarios'));

export default function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
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
    </Suspense>
  );
}
