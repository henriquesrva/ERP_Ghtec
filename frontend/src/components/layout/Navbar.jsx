import { Link, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

// ── Definição dos menus ────────────────────────────────────────────────────────
// react: true  → Link interno React Router (sem reload)
// react: false → <a href> para página legacy (saí do SPA)

const MENUS = [
  {
    group: 'comercial',
    label: 'Comercial',
    links: [
      { label: 'Propostas',           to: '/proposals',                      react: true  },
      { label: 'Kanban',              href: '/legacy/kanban.html',           react: false },
      { label: 'Clientes',            to:   '/clients',                      react: true  },
      { label: 'Objetos e Condições', to:   '/objetos',                       react: true  },
    ],
    activePaths: ['/proposals', '/kanban', '/clients', '/objetos', '/nova-proposta'],
  },
  {
    group: 'operacional',
    label: 'Operacional',
    links: [
      { label: 'Peças',           href: '/legacy/parts.html',             react: false },
      { label: 'Estoque',         href: '/legacy/stock.html',             react: false },
      { label: 'Fornecedores',    to:   '/fornecedores',                  react: true  },
      { label: 'Notas Recebidas', href: '/legacy/notas-recebidas.html',   react: false },
    ],
    activePaths: ['/parts', '/stock', '/fornecedores', '/notas-recebidas'],
  },
  {
    group: 'financeiro',
    label: 'Financeiro',
    links: [
      { label: 'Contas a Pagar', to:   '/contas-pagar',             react: true  },
      { label: 'Financeiro',     to:   '/financeiro',               react: true  },
    ],
    activePaths: ['/contas-pagar', '/financeiro'],  // /financeiro já é React
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
                const isLinkActive = link.react && path === link.to;
                const cls = `nav-dd-link${isLinkActive ? ' active' : ''}`;
                return link.react
                  ? <Link key={link.label} to={link.to} className={cls}>{link.label}</Link>
                  : <a    key={link.label} href={link.href} className={cls}>{link.label}</a>;
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
