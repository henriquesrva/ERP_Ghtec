import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const QUICK_LINKS = [
  { emoji: '📝', label: 'Nova Proposta',   href: '/legacy/nova-proposta.html', react: false },
  { emoji: '📋', label: 'Propostas',       to:   '/proposals',                 react: true  },
  { emoji: '📊', label: 'Kanban',          href: '/legacy/kanban.html',        react: false },
  { emoji: '👥', label: 'Clientes',        href: '/legacy/clients.html',       react: false },
  { emoji: '🔧', label: 'Peças',           href: '/legacy/parts.html',         react: false },
  { emoji: '📦', label: 'Estoque',         href: '/legacy/stock.html',         react: false },
  { emoji: '🏭', label: 'Fornecedores',    href: '/legacy/fornecedores.html',  react: false },
  { emoji: '💰', label: 'Financeiro',      href: '/legacy/financeiro.html',    react: false },
];

export default function Dashboard() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #003f22 0%, #006b35 100%)',
        padding: '20px 32px',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              GHTec ERP
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
              Sistema de Gestão Comercial
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
              Olá, {user?.nome}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              {today}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de módulos */}
      <div className="container" style={{ maxWidth: '900px', margin: '32px auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
        }}>
          {QUICK_LINKS.map(item =>
            item.react
              ? (
                <Link key={item.label} to={item.to} className="section-card" style={{ textDecoration: 'none' }}>
                  <div className="sc-icon">{item.emoji}</div>
                  <div className="sc-title">{item.label}</div>
                </Link>
              )
              : (
                <a key={item.label} href={item.href} className="section-card">
                  <div className="sc-icon">{item.emoji}</div>
                  <div className="sc-title">{item.label}</div>
                </a>
              )
          )}
        </div>
      </div>
    </>
  );
}
