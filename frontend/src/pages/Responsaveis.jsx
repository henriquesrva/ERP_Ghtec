import { useState, useEffect, useRef, useCallback } from 'react';
import {
  listResponsaveis,
  searchResponsaveis,
  createResponsavel,
  deleteResponsavel,
} from '../api/responsaveis';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';

/**
 * Responsaveis.jsx
 *
 * Preserva:
 *  - GET /responsaveis (lista completa)
 *  - GET /responsaveis/search?q=... (busca com debounce 280ms)
 *  - POST /responsaveis (criação)
 *  - DELETE /responsaveis/:id (exclusão com confirm)
 *  - Layout split: lista à esquerda, formulário à direita
 *  - Botão de excluir visível ao hover no item
 *  - Validação: nome é obrigatório
 *  - Loading state e mensagens de erro
 *
 * Nota: não há PUT /responsaveis/:id no backend — edição não implementada.
 */

const SEARCH_DELAY = 280; // ms — igual ao legado

export default function Responsaveis() {
  // ── Lista ─────────────────────────────────────────────────────────────────
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [listErr,  setListErr]  = useState('');
  const [searchQ,  setSearchQ]  = useState('');
  const searchTimer = useRef(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [nome,      setNome]      = useState('');
  const [cargo,     setCargo]     = useState('');
  const [telefone,  setTelefone]  = useState('');
  const [nomeErr,   setNomeErr]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [toast,   setToast]   = useState({ message: '', type: 'success' });
  const [confirm, setConfirm] = useState(null); // { id, nome }

  // ── Hover para botão de excluir ───────────────────────────────────────────
  const [hoveredId, setHoveredId] = useState(null);

  // ── Carregar lista ────────────────────────────────────────────────────────
  const loadList = useCallback(async (q = '') => {
    setLoading(true);
    setListErr('');
    try {
      const data = q ? await searchResponsaveis(q) : await listResponsaveis();
      setItems(data);
    } catch {
      setListErr('Erro ao carregar responsáveis.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Busca com debounce ────────────────────────────────────────────────────
  function handleSearch(e) {
    const q = e.target.value;
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadList(q.trim()), SEARCH_DELAY);
  }

  // ── Excluir ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm) return;
    const { id, nome: nomeResp } = confirm;
    setConfirm(null);
    try {
      await deleteResponsavel(id);
      setItems(prev => prev.filter(r => r.id !== id));
      setToast({ message: `Responsável "${nomeResp}" excluído com sucesso.`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Erro ao excluir responsável.', type: 'error' });
    }
  }

  // ── Criar ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setNomeErr(false);

    if (!nome.trim()) {
      setNomeErr(true);
      return;
    }

    setSubmitting(true);
    try {
      await createResponsavel({
        nome:     nome.trim()     || null,
        cargo:    cargo.trim()    || null,
        telefone: telefone.trim() || null,
      });
      setNome('');
      setCargo('');
      setTelefone('');
      setToast({ message: 'Responsável criado com sucesso.', type: 'success' });
      loadList(searchQ.trim());
    } catch (err) {
      setToast({ message: err.message || 'Erro ao criar responsável.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Page bar */}
      <div className="page-bar">
        <div>
          <h1>Responsáveis</h1>
          <span>Cadastro de responsáveis comerciais pelas propostas</span>
        </div>
      </div>

      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'clamp(280px, 360px, 100%) 1fr',
          gap: '20px',
          alignItems: 'start',
        }}>

          {/* ── LISTA ─────────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Responsáveis cadastrados
              <button
                className="btn-new"
                onClick={() => document.getElementById('f_nome')?.focus()}
                style={{
                  padding: '5px 12px', fontSize: '12px',
                  background: 'var(--green-bg)', color: 'var(--green)',
                  border: '1px dashed var(--green-light)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                + Novo
              </button>
            </div>

            {/* Busca */}
            <div className="search-wrap" style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Buscar por nome ou cargo..."
                value={searchQ}
                onChange={handleSearch}
                autoComplete="off"
              />
            </div>

            {/* Estado de carregamento */}
            {loading && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '20px 0', fontSize: '13px' }}>
                Carregando...
              </div>
            )}
            {listErr && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--color-danger)', padding: '20px 0', fontSize: '13px' }}>
                {listErr}
                <br />
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }} onClick={() => loadList(searchQ.trim())}>
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Lista */}
            {!loading && !listErr && (
              <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                {items.length === 0
                  ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '24px 0', fontSize: '13px' }}>
                      Nenhum responsável encontrado.
                    </div>
                  )
                  : items.map(r => {
                    const sub = [r.cargo, r.telefone].filter(Boolean).join(' · ');
                    const isHovered = hoveredId === r.id;
                    return (
                      <div
                        key={r.id}
                        onMouseEnter={() => setHoveredId(r.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${isHovered ? 'var(--border)' : 'transparent'}`,
                          background: isHovered ? 'var(--green-bg)' : 'transparent',
                          marginBottom: '4px',
                          transition: 'all 0.12s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{r.nome}</div>
                          {sub && (
                            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                              {sub}
                            </div>
                          )}
                        </div>
                        {isHovered && (
                          <button
                            className="btn btn-sm"
                            title="Excluir responsável"
                            onClick={() => setConfirm({ id: r.id, nome: r.nome })}
                            style={{
                              padding: '3px 8px', fontSize: '11px', fontWeight: 700,
                              border: '1px solid #ef9a9a', borderRadius: 'var(--radius)',
                              background: '#fff', color: 'var(--color-danger)', cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* ── FORMULÁRIO ────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title">Novo Responsável</div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Nome — full width */}
              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Nome *</label>
                <input
                  id="f_nome"
                  type="text"
                  placeholder="Nome completo do responsável"
                  value={nome}
                  onChange={e => { setNome(e.target.value); setNomeErr(false); }}
                  className={nomeErr ? 'error' : ''}
                  disabled={submitting}
                />
                {nomeErr && (
                  <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '4px' }}>
                    O campo Nome é obrigatório.
                  </div>
                )}
              </div>

              {/* Cargo + Telefone — 2 colunas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="field">
                  <label>Cargo</label>
                  <input
                    type="text"
                    placeholder="Engenheiro Comercial"
                    value={cargo}
                    onChange={e => setCargo(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Criar responsável'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

      {/* Modal de confirmação */}
      {confirm && (
        <ConfirmModal
          title="Excluir responsável"
          message={`Deseja excluir <strong>${confirm.nome}</strong>? Esta ação não pode ser desfeita.`}
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
