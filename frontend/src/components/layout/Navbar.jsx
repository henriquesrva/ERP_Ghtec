import { Link, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const MENUS = [
  {
    group: 'comercial',
    label: 'Comercial',
    links: [
      { label: 'Propostas',           to: '/proposals'      },
      { label: 'Kanban',              to: '/kanban'          },
      { label: 'Clientes',            to: '/clients'         },
      { label: 'Objetos e Condições', to: '/objetos'         },
    ],
    activePaths: ['/proposals', '/kanban', '/clients', '/objetos', '/nova-proposta'],
  },
  {
    group: 'operacional',
    label: 'Operacional',
    links: [
      { label: 'Peças',           to: '/parts'           },
      { label: 'Estoque',         to: '/stock'           },
      { label: 'Fornecedores',    to: '/fornecedores'    },
      { label: 'Notas Recebidas', to: '/notas-recebidas' },
    ],
    activePaths: ['/parts', '/stock', '/fornecedores', '/notas-recebidas', '/part-categories'],
  },
  {
    group: 'financeiro',
    label: 'Financeiro',
    links: [
      { label: 'Contas a Pagar', to: '/contas-pagar' },
      { label: 'Financeiro',     to: '/financeiro'   },
    ],
    activePaths: ['/contas-pagar', '/financeiro'],
  },
];

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const path = location.pathname;

  const isAdmin = path.startsWith('/usuarios') || path.startsWith('/responsaveis');

  return (
    <nav className="nav">
      {/* Brand */}
      <Link className="nav-brand" to="/">
        <img src="/assets/logoGHTEC.png" alt="GHTec" className="app-logo" />
      </Link>

      {/* Grupos de menu */}
      {MENUS.map(menu => {
        const isActive = menu.activePaths.some(p => path === p || path.startsWith(p + '/'));
        return (
          <div
            key={menu.group}
            className={`nav-group${isActive ? ' active' : ''}`}
            data-group={menu.group}
          >
            <button className="nav-group-btn">
              {menu.label} <span className="nav-arrow">&#9662;</span>
            </button>
            <div className="nav-dropdown">
              {menu.links.map(link => {
                const cls = `nav-dd-link${path === link.to ? ' active' : ''}`;
                return <Link key={link.label} to={link.to} className={cls}>{link.label}</Link>;
              })}
            </div>
          </div>
        );
      })}

      {/* Lado direito */}
      <div className="nav-right">
        <span id="navUserLabel">{user?.nome}</span>
        <Link
          to="/usuarios"
          className={`nav-icon-link${isAdmin ? ' active' : ''}`}
          title="Usuários e configurações"
        >
          &#9881;
        </Link>
        <button className="btn-logout" onClick={logout}>Sair</button>
      </div>
    </nav>
  );
}
