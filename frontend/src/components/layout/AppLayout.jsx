import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

/**
 * Layout principal autenticado: Navbar + conteúdo da rota.
 */
export default function AppLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}
