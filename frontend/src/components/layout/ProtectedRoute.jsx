import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Loading from '../shared/Loading';

/**
 * Guarda de rota: redireciona para /login se não houver sessão ativa.
 * Mostra spinner enquanto AuthContext carrega.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user)   return <Navigate to="/login" replace />;
  return <Outlet />;
}
