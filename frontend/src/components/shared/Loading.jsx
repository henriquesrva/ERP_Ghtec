export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--color-muted)',
      fontSize: '13px',
      gap: '10px',
    }}>
      <span className="spinner spinner-dark" />
      Carregando...
    </div>
  );
}
