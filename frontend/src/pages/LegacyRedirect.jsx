/**
 * Placeholder para telas ainda não migradas para React.
 * Mostra uma mensagem clara com link para a versão legacy.
 */
export default function LegacyRedirect({ to, label }) {
  return (
    <>
      <div className="page-bar">
        <div>
          <h1>{label}</h1>
          <span>Migração para React em andamento</span>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card" style={{
          maxWidth: '480px',
          margin: '0 auto',
          padding: '40px 32px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '18px' }}>🔧</div>
          <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700 }}>
            Tela em migração para React
          </h3>
          <p style={{
            margin: '0 0 24px',
            fontSize: '13px',
            color: 'var(--color-muted)',
            lineHeight: 1.65,
          }}>
            Esta tela ainda utiliza a interface legada.<br />
            Clique abaixo para abrir a versão atual.
          </p>
          <a href={to} className="btn btn-primary">
            Abrir {label}
          </a>
        </div>
      </div>
    </>
  );
}
