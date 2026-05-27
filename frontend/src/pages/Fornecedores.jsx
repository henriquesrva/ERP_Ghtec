import { useState, useEffect, useCallback } from 'react';
import {
  listFornecedores,
  searchFornecedores,
  getFornecedor,
  getFornecedorDetalhes,
  createFornecedor,
  updateFornecedor,
  desativarFornecedor,
} from '../api/fornecedores';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import useAuth      from '../hooks/useAuth';

/**
 * Fornecedores.jsx — migrado de public/legacy/fornecedores.html
 *
 * Preserva:
 *  - GET /fornecedores?includeInactive=
 *  - GET /fornecedores/search?q=&includeInactive=
 *  - GET /fornecedores/:id/detalhes (notas + contas)
 *  - POST /fornecedores (criar)
 *  - PUT  /fornecedores/:id (editar)
 *  - POST /fornecedores/:id/desativar (admin only, com ConfirmModal)
 *  - Layout split: lista à esquerda, detalhe/form à direita
 *  - Checkbox "Mostrar inativos"
 *  - Validação: razao_social obrigatória, tratamento CNPJ duplicado
 *  - Detalhe: tabela de notas recebidas e contas a pagar
 */

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}

function fmtMoeda(v) {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function tagConta(status, atrasado) {
  if (atrasado)               return { label: 'atrasado',  bg: '#ffebee', color: '#c62828', border: '#ef9a9a' };
  if (status === 'pago')      return { label: 'pago',      bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' };
  if (status === 'cancelado') return { label: 'cancelado', bg: '#f5f5f5', color: '#757575', border: '#e0e0e0' };
  return { label: 'em aberto', bg: '#fff8e1', color: '#f57f17', border: '#ffe082' };
}

function tagNota(status) {
  if (status === 'lancada')    return { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' };
  if (status === 'cancelada')  return { bg: '#f5f5f5', color: '#757575', border: '#e0e0e0' };
  return { bg: '#fff8e1', color: '#f57f17', border: '#ffe082' };
}

const EMPTY_FORM = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
  telefone: '', email: '', endereco: '', cidade: '', estado: '', cep: '',
  observacoes: '',
};

// ── Componente ────────────────────────────────────────────────────────────────
export default function Fornecedores() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── Lista ───────────────────────────────────────────────────────────────────
  const [items,           setItems]           = useState([]);
  const [listLoading,     setListLoading]     = useState(true);
  const [listErr,         setListErr]         = useState('');
  const [searchQ,         setSearchQ]         = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  // ── Painel direito: 'placeholder' | 'form' | 'detail' ──────────────────────
  const [view,       setView]       = useState('placeholder');
  const [selectedId, setSelectedId] = useState(null);

  // ── Detalhe ─────────────────────────────────────────────────────────────────
  const [detail,        setDetail]        = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Formulário ──────────────────────────────────────────────────────────────
  const [formMode,   setFormMode]   = useState('new'); // 'new' | 'edit'
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [razaoErr,   setRazaoErr]   = useState(false);
  const [formErrMsg, setFormErrMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Feedback ────────────────────────────────────────────────────────────────
  const [toast,           setToast]           = useState({ message: '', type: 'success' });
  const [desativarConfirm, setDesativarConfirm] = useState(false);

  // ── Carregar lista ──────────────────────────────────────────────────────────
  const loadList = useCallback(async (q = searchQ, inactive = includeInactive) => {
    setListLoading(true);
    setListErr('');
    try {
      const data = q.trim()
        ? await searchFornecedores(q.trim(), inactive)
        : await listFornecedores(inactive);
      setItems(data);
    } catch {
      setListErr('Erro ao carregar fornecedores.');
    } finally {
      setListLoading(false);
    }
  }, [searchQ, includeInactive]);

  useEffect(() => { loadList(); }, []); // mount

  // Recarrega quando filtros mudam
  useEffect(() => { loadList(searchQ, includeInactive); }, [includeInactive]); // eslint-disable-line

  // ── Selecionar item → ver detalhe ───────────────────────────────────────────
  async function selectItem(id) {
    setSelectedId(id);
    setView('detail');
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await getFornecedorDetalhes(id);
      setDetail(data);
    } catch {
      setToast({ message: 'Erro ao carregar detalhes do fornecedor.', type: 'error' });
      setView('placeholder');
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Novo ────────────────────────────────────────────────────────────────────
  function openNewForm() {
    setEditingId(null);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setRazaoErr(false);
    setFormErrMsg('');
    setFormMode('new');
    setView('form');
  }

  // ── Editar ──────────────────────────────────────────────────────────────────
  async function openEditForm() {
    try {
      const f = await getFornecedor(selectedId);
      setEditingId(f.id);
      setForm({
        razao_social:      f.razao_social      || '',
        nome_fantasia:     f.nome_fantasia     || '',
        cnpj:              f.cnpj              || '',
        inscricao_estadual: f.inscricao_estadual || '',
        telefone:          f.telefone          || '',
        email:             f.email             || '',
        endereco:          f.endereco          || '',
        cidade:            f.cidade            || '',
        estado:            f.estado            || '',
        cep:               f.cep               || '',
        observacoes:       f.observacoes       || '',
      });
      setRazaoErr(false);
      setFormErrMsg('');
      setFormMode('edit');
      setView('form');
    } catch {
      setToast({ message: 'Erro ao carregar dados do fornecedor.', type: 'error' });
    }
  }

  // ── Cancelar form ───────────────────────────────────────────────────────────
  function cancelForm() {
    if (selectedId) {
      selectItem(selectedId);
    } else {
      setView('placeholder');
    }
  }

  // ── Submeter form ───────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setRazaoErr(false);
    setFormErrMsg('');

    if (!form.razao_social.trim()) {
      setRazaoErr(true);
      setFormErrMsg('O campo Razão Social é obrigatório.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        estado: form.estado.toUpperCase(),
      };
      let saved;
      if (formMode === 'edit') {
        saved = await updateFornecedor(editingId, payload);
      } else {
        saved = await createFornecedor(payload);
      }
      const savedFornecedor = saved.fornecedor ?? saved;
      setToast({ message: 'Fornecedor salvo com sucesso.', type: 'success' });
      setSelectedId(savedFornecedor.id);
      loadList(searchQ, includeInactive);
      // Mostra detalhe do fornecedor salvo
      setView('detail');
      setDetail(null);
      setDetailLoading(true);
      try {
        const det = await getFornecedorDetalhes(savedFornecedor.id);
        setDetail(det);
      } finally {
        setDetailLoading(false);
      }
    } catch (err) {
      setFormErrMsg(err.message || 'Erro ao salvar fornecedor.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Desativar ───────────────────────────────────────────────────────────────
  async function handleDesativar() {
    setDesativarConfirm(false);
    try {
      await desativarFornecedor(editingId);
      setToast({ message: 'Fornecedor desativado com sucesso.', type: 'success' });
      setSelectedId(null);
      setEditingId(null);
      setView('placeholder');
      loadList(searchQ, includeInactive);
    } catch (err) {
      setFormErrMsg(err.message || 'Erro ao desativar fornecedor.');
    }
  }

  // ── Field helper ─────────────────────────────────────────────────────────────
  function setField(k) {
    return (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-bar">
        <div>
          <h1>Fornecedores</h1>
          <span>Cadastro e histórico de compras por fornecedor</span>
        </div>
      </div>

      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'clamp(280px, 360px, 100%) 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── LISTA ────────────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Fornecedores
              <label style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={e => setIncludeInactive(e.target.checked)}
                />
                Mostrar inativos
              </label>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Buscar por nome, CNPJ..."
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); loadList(e.target.value, includeInactive); }}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit' }}
              />
              <button className="btn btn-primary" onClick={openNewForm}>+ Novo</button>
            </div>

            {listLoading && <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '20px 0', fontSize: '13px' }}>Carregando...</div>}
            {listErr && !listLoading && (
              <div style={{ textAlign: 'center', color: 'var(--color-danger)', padding: '16px 0', fontSize: '13px' }}>
                {listErr}
                <br />
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }} onClick={() => loadList()}>Tentar novamente</button>
              </div>
            )}

            {!listLoading && !listErr && (
              <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                {items.length === 0
                  ? <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '24px 0', fontSize: '13px' }}>Nenhum fornecedor encontrado.</div>
                  : items.map(f => {
                    const isSelected = selectedId === f.id;
                    const loc = [f.cidade, f.estado].filter(Boolean).join('/');
                    const sub = [f.cnpj, loc].filter(Boolean).join(' · ');
                    return (
                      <div
                        key={f.id}
                        onClick={() => selectItem(f.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                          border: `1px solid ${isSelected ? 'var(--color-primary-light, #81c784)' : 'transparent'}`,
                          background: isSelected ? 'var(--color-primary-bg, #f1f8e9)' : 'transparent',
                          marginBottom: '3px', transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--color-primary-bg, #f1f8e9)'; e.currentTarget.style.borderColor = 'var(--color-border, #e0e0e0)'; } }}
                        onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{f.razao_social}</span>
                          {!f.ativo && (
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: '#f5f5f5', color: '#757575', border: '1px solid #e0e0e0', fontWeight: 600 }}>
                              inativo
                            </span>
                          )}
                        </div>
                        {sub && <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>{sub}</div>}
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* ── PAINEL DIREITO ──────────────────────────────────────────── */}
          <div>

            {/* Placeholder */}
            {view === 'placeholder' && (
              <div className="card">
                <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '40px 0', fontSize: '13px' }}>
                  Selecione um fornecedor ou clique em <strong>+ Novo</strong>
                </div>
              </div>
            )}

            {/* Formulário */}
            {view === 'form' && (
              <div className="card">
                <div className="card-title">{formMode === 'edit' ? 'Editar Fornecedor' : 'Novo Fornecedor'}</div>

                {formErrMsg && (
                  <div className="msg error" style={{ marginBottom: '14px' }}>{formErrMsg}</div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* Razão Social — full width */}
                  <div className="field" style={{ marginBottom: '12px', gridColumn: '1 / -1' }}>
                    <label>Razão Social *</label>
                    <input
                      type="text"
                      value={form.razao_social}
                      onChange={e => { setField('razao_social')(e); setRazaoErr(false); setFormErrMsg(''); }}
                      className={razaoErr ? 'error' : ''}
                      disabled={submitting}
                      placeholder="Razão social do fornecedor"
                    />
                  </div>

                  {/* Nome Fantasia + CNPJ */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="field">
                      <label>Nome Fantasia</label>
                      <input type="text" value={form.nome_fantasia} onChange={setField('nome_fantasia')} disabled={submitting} />
                    </div>
                    <div className="field">
                      <label>CNPJ</label>
                      <input type="text" value={form.cnpj} onChange={setField('cnpj')} placeholder="00.000.000/0001-00" disabled={submitting} />
                    </div>
                  </div>

                  {/* IE + Telefone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="field">
                      <label>Inscrição Estadual</label>
                      <input type="text" value={form.inscricao_estadual} onChange={setField('inscricao_estadual')} disabled={submitting} />
                    </div>
                    <div className="field">
                      <label>Telefone</label>
                      <input type="text" value={form.telefone} onChange={setField('telefone')} disabled={submitting} />
                    </div>
                  </div>

                  {/* E-mail — full width */}
                  <div className="field" style={{ marginBottom: '12px' }}>
                    <label>E-mail</label>
                    <input type="email" value={form.email} onChange={setField('email')} disabled={submitting} />
                  </div>

                  {/* Endereço — full width */}
                  <div className="field" style={{ marginBottom: '12px' }}>
                    <label>Endereço</label>
                    <input type="text" value={form.endereco} onChange={setField('endereco')} disabled={submitting} />
                  </div>

                  {/* Cidade + Estado + CEP */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: '12px', marginBottom: '12px' }}>
                    <div className="field">
                      <label>Cidade</label>
                      <input type="text" value={form.cidade} onChange={setField('cidade')} disabled={submitting} />
                    </div>
                    <div className="field">
                      <label>Estado</label>
                      <input
                        type="text" value={form.estado} maxLength={2} placeholder="SP"
                        onChange={e => setForm(prev => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                        disabled={submitting}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                    <div className="field">
                      <label>CEP</label>
                      <input type="text" value={form.cep} onChange={setField('cep')} placeholder="00000-000" disabled={submitting} />
                    </div>
                  </div>

                  {/* Observações — full width */}
                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label>Observações</label>
                    <textarea value={form.observacoes} onChange={setField('observacoes')} rows={2} disabled={submitting} style={{ resize: 'vertical' }} />
                  </div>

                  <div className="form-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={cancelForm} disabled={submitting}>
                      Cancelar
                    </button>
                    {formMode === 'edit' && isAdmin && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDesativarConfirm(true)}
                        disabled={submitting}
                        style={{ marginLeft: 'auto' }}
                      >
                        Desativar fornecedor
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Detalhe */}
            {view === 'detail' && (
              <div className="card">
                {detailLoading && (
                  <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '32px 0', fontSize: '13px' }}>
                    Carregando...
                  </div>
                )}

                {!detailLoading && detail && (() => {
                  const f = detail.fornecedor;
                  const notas  = detail.notas  || [];
                  const contas = detail.contas  || [];
                  const locParts = [f.endereco, f.cidade, f.estado, f.cep].filter(Boolean);

                  return (
                    <>
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>
                          {f.razao_social}
                          {f.nome_fantasia ? ` / ${f.nome_fantasia}` : ''}
                        </span>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                          onClick={openEditForm}
                        >
                          Editar
                        </button>
                      </div>

                      {/* Dados básicos */}
                      <div style={{ marginBottom: '4px' }}>
                        {[
                          { label: 'CNPJ',      val: f.cnpj              || '—' },
                          { label: 'IE',        val: f.inscricao_estadual || '—' },
                          { label: 'Telefone',  val: f.telefone           || '—' },
                          { label: 'E-mail',    val: f.email              || '—' },
                          { label: 'Endereço',  val: locParts.join(', ')  || '—' },
                          ...(f.observacoes ? [{ label: 'Obs.', val: f.observacoes }] : []),
                        ].map(({ label, val }) => (
                          <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '5px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: 700, minWidth: '90px', paddingTop: '1px' }}>{label}</span>
                            <span style={{ fontSize: '13px' }}>{val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Notas recebidas */}
                      <SectionHeader title="Notas recebidas" count={notas.length} />
                      {notas.length === 0
                        ? <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '12px 0', fontSize: '13px' }}>Nenhuma nota.</div>
                        : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '4px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Nota', 'Data entrada', 'Valor', 'Status'].map(h => (
                                  <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', color: 'var(--color-muted)', fontWeight: 700 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {notas.map(n => {
                                const tag = tagNota(n.status);
                                return (
                                  <tr key={n.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '5px 6px' }}>
                                      <a href={`/legacy/notas-recebidas.html?id=${n.id}`} style={{ color: 'var(--color-primary)' }}>
                                        {n.numero_nota || 's/n'}{n.serie ? `/${n.serie}` : ''}
                                      </a>
                                    </td>
                                    <td style={{ padding: '5px 6px' }}>{fmtDate(n.data_entrada)}</td>
                                    <td style={{ padding: '5px 6px' }}>{fmtMoeda(n.valor_total)}</td>
                                    <td style={{ padding: '5px 6px' }}>
                                      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '3px', background: tag.bg, color: tag.color, border: `1px solid ${tag.border}` }}>
                                        {n.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )
                      }

                      {/* Contas a pagar */}
                      <SectionHeader title="Contas a pagar" count={contas.length} />
                      {contas.length === 0
                        ? <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '12px 0', fontSize: '13px' }}>Nenhuma conta.</div>
                        : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Descrição', 'Vencimento', 'Valor', 'Status'].map(h => (
                                  <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontSize: '11px', color: 'var(--color-muted)', fontWeight: 700 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {contas.map(c => {
                                const tag = tagConta(c.status, c.atrasado);
                                return (
                                  <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '5px 6px' }}>{c.descricao}</td>
                                    <td style={{ padding: '5px 6px' }}>{fmtDate(c.data_vencimento)}</td>
                                    <td style={{ padding: '5px 6px' }}>{fmtMoeda(c.valor)}</td>
                                    <td style={{ padding: '5px 6px' }}>
                                      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '3px', background: tag.bg, color: tag.color, border: `1px solid ${tag.border}` }}>
                                        {tag.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )
                      }
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm desativar */}
      {desativarConfirm && (
        <ConfirmModal
          title="Desativar fornecedor"
          message="Desativar este fornecedor? Ele não aparecerá mais nas listas, mas os registros serão mantidos."
          onConfirm={handleDesativar}
          onCancel={() => setDesativarConfirm(false)}
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

// ── Sub-componente: cabeçalho de seção ────────────────────────────────────────
function SectionHeader({ title, count }) {
  return (
    <div style={{ marginTop: '18px', marginBottom: '10px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px',
        color: 'var(--color-primary)', textTransform: 'uppercase',
        paddingBottom: '8px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        {title}
        <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>({count})</span>
      </div>
    </div>
  );
}
