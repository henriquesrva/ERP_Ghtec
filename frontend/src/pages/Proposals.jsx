import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listProposals, deleteProposal } from '../api/proposals';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';

/**
 * Proposals.jsx — migrado de public/proposals.html
 *
 * Preserva:
 *  - GET /proposals
 *  - DELETE /proposals/:id
 *  - View "home" (dois cards) e view "listing" (tabela)
 *  - Filtro client-side por número ou cliente
 *  - Loading state, toast, confirm antes de deletar
 *  - Link para PDF (/files/proposta-{numero}.pdf)
 *  - Badge "Faturado" quando billed_at existe
 *  - Formatação monetária pt-BR
 */

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Proposals() {
  // ── View ─────────────────────────────────────────────────────────────────────
  const [view, setView] = useState('home'); // 'home' | 'listing'

  // ── Dados ────────────────────────────────────────────────────────────────────
  const [all, setAll]         = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchQ, setSearchQ] = useState('');

  // ── Status da lista ──────────────────────────────────────────────────────────
  const [listLoaded, setListLoaded] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [loadError, setLoadError]   = useState('');

  // ── Feedback ─────────────────────────────────────────────────────────────────
  const [toast,   setToast]   = useState({ message: '', type: 'success' });
  const [confirm, setConfirm] = useState(null); // { id, num }

  // ── Subtitle da page bar ─────────────────────────────────────────────────────
  const subtitle = view === 'home'
    ? 'Geração e histórico de propostas comerciais'
    : 'Histórico de propostas geradas';

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await listProposals();
      setAll(data);
    } catch {
      setLoadError('Erro ao carregar propostas.');
    } finally {
      setLoading(false);
    }
  }, []);

  function goListing() {
    setView('listing');
    if (!listLoaded) {
      setListLoaded(true);
      loadList();
    }
  }

  // ── Filtro client-side ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim()) {
      setFiltered(all);
    } else {
      const q = searchQ.toLowerCase();
      setFiltered(all.filter(p =>
        p.numero_proposta.toLowerCase().includes(q) ||
        p.cliente_nome.toLowerCase().includes(q)
      ));
    }
  }, [searchQ, all]);

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm) return;
    const { id, num } = confirm;
    setConfirm(null);
    try {
      await deleteProposal(id);
      setAll(prev => prev.filter(p => p.id !== id));
      setToast({ message: `Proposta ${num} excluída com sucesso.`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Erro ao excluir proposta.', type: 'error' });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Page bar */}
      <div className="page-bar">
        <div>
          <h1>Propostas</h1>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="container">

        {/* ══ HOME ══════════════════════════════════════════════════════════════ */}
        {view === 'home' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            maxWidth: '580px',
            margin: '40px auto 0',
          }}>
            <Link className="section-card" to="/nova-proposta">
              <span className="sc-icon">📝</span>
              <div className="sc-title">Nova proposta</div>
              <div className="sc-desc">Criar uma nova proposta comercial e gerar o PDF</div>
            </Link>

            <div
              className="section-card"
              role="button"
              tabIndex={0}
              onClick={goListing}
              onKeyDown={e => e.key === 'Enter' && goListing()}
              style={{ cursor: 'pointer' }}
            >
              <span className="sc-icon">📋</span>
              <div className="sc-title">Histórico de propostas</div>
              <div className="sc-desc">Visualizar e acessar as propostas já geradas</div>
            </div>
          </div>
        )}

        {/* ══ LISTING ═══════════════════════════════════════════════════════════ */}
        {view === 'listing' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn-back" onClick={() => setView('home')}>
                ← Voltar
              </button>
            </div>

            <div className="card">
              <div className="card-title">Todas as propostas</div>

              {/* Filtro */}
              <div className="search-wrap" style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Filtrar por número ou cliente..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>

              {/* Estados de carregamento */}
              {loading   && <div className="empty">Carregando...</div>}
              {loadError && (
                <div className="empty" style={{ color: 'var(--color-danger)' }}>
                  {loadError}
                  <br />
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }} onClick={loadList}>
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Tabela */}
              {!loading && !loadError && (
                filtered.length === 0
                  ? <div className="empty">Nenhuma proposta encontrada.</div>
                  : (
                    <table>
                      <thead>
                        <tr>
                          <th>Nº da Proposta</th>
                          <th>Cliente</th>
                          <th>Data de Emissão</th>
                          <th>Valor Total</th>
                          <th>Status</th>
                          <th>PDF</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(p => (
                          <tr key={p.id}>
                            <td><strong>{p.numero_proposta}</strong></td>
                            <td>{p.cliente_nome}</td>
                            <td>{p.data_emissao}</td>
                            <td>{fmt(p.valor_total)}</td>
                            <td>
                              {p.billed_at
                                ? <span className="badge badge-faturado">&#10003; Faturado</span>
                                : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>
                              }
                            </td>
                            <td>
                              {p.pdf_path
                                ? (
                                  <a
                                    className="btn btn-outline btn-sm"
                                    href={`/files/proposta-${p.numero_proposta}.pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Abrir PDF
                                  </a>
                                )
                                : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>
                              }
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-danger-outline"
                                title="Excluir proposta"
                                onClick={() => setConfirm({ id: p.id, num: p.numero_proposta })}
                              >
                                ✕ Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {confirm && (
        <ConfirmModal
          title="Excluir proposta"
          message={`Deseja excluir a proposta <strong>${confirm.num}</strong>? Esta ação não pode ser desfeita.<br><small>O arquivo PDF gerado não será removido.</small>`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(t => ({ ...t, message: '' }))}
      />
    </>
  );
}
