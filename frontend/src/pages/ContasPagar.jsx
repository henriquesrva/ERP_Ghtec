import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listContas,
  createConta,
  baixarConta,
  cancelarConta,
} from '../api/contasPagar';
import { listFornecedores }     from '../api/fornecedores';
import { listCategoriasDespesa } from '../api/categoriasDespesa';
import useAuth                  from '../hooks/useAuth';
import Toast                    from '../components/shared/Toast';

// ── Utilitários ────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}

function fmtMoeda(v) {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function tagStatus(status, atrasado) {
  if (atrasado) return 'tag-danger';
  if (status === 'pago')      return 'tag-ok';
  if (status === 'cancelado') return 'tag-muted';
  return 'tag-warn';
}

function labelStatus(status, atrasado) {
  if (atrasado) return 'atrasado';
  const map = { em_aberto: 'em aberto', pago: 'pago', cancelado: 'cancelado' };
  return map[status] || status;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const FORMAS = [
  { value: 'pix',           label: 'PIX' },
  { value: 'boleto',        label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao',        label: 'Cartão' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'outro',         label: 'Outro' },
];

const NOVA_EMPTY = {
  fornecedor_id: '', descricao: '', valor: '',
  categoria_despesa_id: '', data_emissao: '', data_vencimento: '',
  forma_pagamento: '', observacoes: '',
};

const BAIXA_EMPTY = {
  data_pagamento: '', valor_pago: '', forma_pagamento: '', observacoes: '',
};

// ── Componente principal ────────────────────────────────────────────────────────

export default function ContasPagar() {
  const { user } = useAuth();
  const podeCancel = user?.role === 'admin' || user?.role === 'financeiro';

  // ── Dados auxiliares ──────────────────────────────────────────────────────────
  const [fornecedores, setFornecedores] = useState([]);
  const [categorias,   setCategorias]   = useState([]);

  // ── Lista ─────────────────────────────────────────────────────────────────────
  const [contas,       setContas]       = useState([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [filtros,      setFiltros]      = useState({
    status: '', fornecedor_id: '', categoria_id: '', forma_pagamento: '',
  });

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const showToast = (message, type = 'success') => setToast({ message, type });

  // ── Modal: Dar baixa ──────────────────────────────────────────────────────────
  const [baixaModal,   setBaixaModal]   = useState({ open: false, conta: null });
  const [baixaForm,    setBaixaForm]    = useState(BAIXA_EMPTY);
  const [baixaFile,    setBaixaFile]    = useState(null);
  const [baixaError,   setBaixaError]   = useState('');
  const [baixaLoading, setBaixaLoading] = useState(false);

  // ── Modal: Cancelar ───────────────────────────────────────────────────────────
  const [cancelModal,   setCancelModal]   = useState({ open: false, conta: null });
  const [cancelMotivo,  setCancelMotivo]  = useState('');
  const [cancelError,   setCancelError]   = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Modal: Nova conta ─────────────────────────────────────────────────────────
  const [novaModal,   setNovaModal]   = useState(false);
  const [novaForm,    setNovaForm]    = useState({ ...NOVA_EMPTY, data_emissao: todayISO() });
  const [novaError,   setNovaError]   = useState('');
  const [novaLoading, setNovaLoading] = useState(false);

  // ── Carrega fornecedores e categorias (uma vez) ───────────────────────────────
  useEffect(() => {
    Promise.all([listFornecedores(), listCategoriasDespesa()])
      .then(([f, c]) => { setFornecedores(f); setCategorias(c); })
      .catch(() => {});
  }, []);

  // ── Carrega lista sempre que os filtros mudam ─────────────────────────────────
  const loadList = useCallback(() => {
    setListLoading(true);
    listContas(filtros)
      .then(data => setContas(data))
      .catch(() => setContas([]))
      .finally(() => setListLoading(false));
  }, [filtros]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Helpers de filtro ─────────────────────────────────────────────────────────
  function updateFiltro(field, value) {
    setFiltros(f => ({ ...f, [field]: value }));
  }
  function clearFilters() {
    setFiltros({ status: '', fornecedor_id: '', categoria_id: '', forma_pagamento: '' });
  }

  // ── Baixa ─────────────────────────────────────────────────────────────────────
  function openBaixa(conta) {
    setBaixaForm({
      ...BAIXA_EMPTY,
      data_pagamento: todayISO(),
      valor_pago:     String(conta.valor),
    });
    setBaixaFile(null);
    setBaixaError('');
    setBaixaModal({ open: true, conta });
  }

  async function handleBaixaSubmit(e) {
    e.preventDefault();
    setBaixaLoading(true);
    setBaixaError('');

    const fd = new FormData();
    fd.append('data_pagamento', baixaForm.data_pagamento);
    fd.append('valor_pago',     baixaForm.valor_pago);
    if (baixaForm.forma_pagamento) fd.append('forma_pagamento', baixaForm.forma_pagamento);
    if (baixaForm.observacoes)     fd.append('observacoes',     baixaForm.observacoes);
    if (baixaFile)                 fd.append('comprovante_pagamento', baixaFile);

    try {
      await baixarConta(baixaModal.conta.id, fd);
      setBaixaModal({ open: false, conta: null });
      showToast('Baixa registrada com sucesso.');
      loadList();
    } catch (err) {
      setBaixaError(err.message || 'Erro ao dar baixa.');
    } finally {
      setBaixaLoading(false);
    }
  }

  // ── Cancelamento ──────────────────────────────────────────────────────────────
  function openCancelamento(conta) {
    setCancelMotivo('');
    setCancelError('');
    setCancelModal({ open: true, conta });
  }

  async function handleCancelSubmit() {
    setCancelLoading(true);
    setCancelError('');
    try {
      await cancelarConta(cancelModal.conta.id, { motivo: cancelMotivo });
      setCancelModal({ open: false, conta: null });
      showToast('Conta cancelada.');
      loadList();
    } catch (err) {
      setCancelError(err.message || 'Erro ao cancelar.');
    } finally {
      setCancelLoading(false);
    }
  }

  // ── Nova conta ────────────────────────────────────────────────────────────────
  function openNovaConta() {
    setNovaForm({ ...NOVA_EMPTY, data_emissao: todayISO() });
    setNovaError('');
    setNovaModal(true);
  }

  async function handleNovaSubmit(e) {
    e.preventDefault();
    setNovaLoading(true);
    setNovaError('');
    try {
      await createConta({
        ...novaForm,
        fornecedor_id:        novaForm.fornecedor_id        || undefined,
        categoria_despesa_id: novaForm.categoria_despesa_id || undefined,
      });
      setNovaModal(false);
      showToast('Conta criada com sucesso.');
      loadList();
    } catch (err) {
      setNovaError(err.message || 'Erro ao criar conta.');
    } finally {
      setNovaLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── page-bar ──────────────────────────────────────────────────────────── */}
      <div className="page-bar">
        <div>
          <h1>Contas a Pagar</h1>
          <div>Gestão de pagamentos e obrigações financeiras</div>
        </div>
        <Link
          to="/financeiro"
          className="btn btn-sm"
          style={{
            background: 'rgba(255,255,255,0.15)',
            color:      '#fff',
            border:     '1px solid rgba(255,255,255,0.3)',
          }}
        >
          ← Painel Financeiro
        </Link>
      </div>

      <div className="container">
        <div className="card">
          <div className="card-header">
            <span className="section-title">Contas a pagar</span>
            <button className="btn btn-primary" onClick={openNovaConta}>
              + Nova conta
            </button>
          </div>

          {/* Filtros */}
          <div className="filters">
            <select
              value={filtros.status}
              onChange={e => updateFiltro('status', e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="em_aberto">Em aberto</option>
              <option value="atrasado">Atrasado</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>

            <select
              value={filtros.fornecedor_id}
              onChange={e => updateFiltro('fornecedor_id', e.target.value)}
            >
              <option value="">Todos os fornecedores</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.razao_social}</option>
              ))}
            </select>

            <select
              value={filtros.categoria_id}
              onChange={e => updateFiltro('categoria_id', e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            <select
              value={filtros.forma_pagamento}
              onChange={e => updateFiltro('forma_pagamento', e.target.value)}
            >
              <option value="">Todas as formas</option>
              {FORMAS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Limpar
            </button>
          </div>

          {/* Tabela */}
          {listLoading ? (
            <div className="empty-state">Carregando...</div>
          ) : contas.length === 0 ? (
            <div className="empty-state">Nenhuma conta encontrada.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Fornecedor</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Parcela</th>
                    <th>Forma pgto</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map(c => (
                    <tr key={c.id} className={c.atrasado ? 'row-atrasado' : ''}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{c.descricao}</div>
                        {c.nota_recebida_id && (
                          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                            NF {c.numero_nota || 's/n'}
                          </div>
                        )}
                      </td>
                      <td>{c.fornecedor_nome}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {fmtDate(c.data_vencimento)}
                      </td>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {fmtMoeda(c.valor)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.parcela_numero ? `${c.parcela_numero}/${c.parcela_total}` : '—'}
                      </td>
                      <td>{c.forma_pagamento || '—'}</td>
                      <td>
                        <span className={`tag ${tagStatus(c.status, c.atrasado)}`}>
                          {labelStatus(c.status, c.atrasado)}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {(c.status === 'em_aberto' || c.atrasado) && (
                          <button
                            className="btn btn-amber btn-sm"
                            onClick={() => openBaixa(c)}
                          >
                            Dar baixa
                          </button>
                        )}
                        {c.status === 'pago' && c.comprovante_pagamento && (
                          <a
                            className="btn btn-ghost btn-sm"
                            href={`/files/${c.comprovante_pagamento}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginLeft: 4 }}
                          >
                            Comprovante
                          </a>
                        )}
                        {c.status !== 'cancelado' && c.status !== 'pago' && podeCancel && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 4 }}
                            onClick={() => openCancelamento(c)}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Dar baixa ───────────────────────────────────────────────────── */}
      {baixaModal.open && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={() => setBaixaModal({ open: false, conta: null })}
        >
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Dar baixa na conta</div>

            <div className="info-box">
              <strong>Descrição</strong>{baixaModal.conta.descricao}<br />
              <strong>Fornecedor</strong>{baixaModal.conta.fornecedor_nome}<br />
              <strong>Vencimento</strong>{fmtDate(baixaModal.conta.data_vencimento)}<br />
              <strong>Valor</strong>{fmtMoeda(baixaModal.conta.valor)}
            </div>

            {baixaError && <div className="msg error">{baixaError}</div>}

            <form onSubmit={handleBaixaSubmit}>
              <div className="grid-2">
                <div className="field">
                  <label>Data do pagamento *</label>
                  <input
                    type="date"
                    required
                    value={baixaForm.data_pagamento}
                    onChange={e => setBaixaForm(f => ({ ...f, data_pagamento: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Valor pago (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={baixaForm.valor_pago}
                    onChange={e => setBaixaForm(f => ({ ...f, valor_pago: e.target.value }))}
                  />
                </div>
                <div className="field col-span-2">
                  <label>Forma de pagamento</label>
                  <select
                    value={baixaForm.forma_pagamento}
                    onChange={e => setBaixaForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                  >
                    <option value="">— Selecione —</option>
                    {FORMAS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field col-span-2">
                  <label>Comprovante (imagem ou PDF)</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.webp"
                    onChange={e => setBaixaFile(e.target.files[0] || null)}
                  />
                </div>
                <div className="field col-span-2">
                  <label>Observações</label>
                  <input
                    type="text"
                    value={baixaForm.observacoes}
                    onChange={e => setBaixaForm(f => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={baixaLoading}
                >
                  {baixaLoading ? 'Salvando...' : 'Confirmar pagamento'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setBaixaModal({ open: false, conta: null })}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cancelar conta ──────────────────────────────────────────────── */}
      {cancelModal.open && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={() => setCancelModal({ open: false, conta: null })}
        >
          <div
            className="modal"
            style={{ width: 420 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-title">Cancelar conta a pagar</div>

            <div className="info-box">
              <strong>Descrição</strong>{cancelModal.conta.descricao}<br />
              <strong>Fornecedor</strong>{cancelModal.conta.fornecedor_nome}<br />
              <strong>Valor</strong>{fmtMoeda(cancelModal.conta.valor)}
            </div>

            {cancelError && <div className="msg error">{cancelError}</div>}

            <div className="field" style={{ marginBottom: 16 }}>
              <label>Motivo do cancelamento</label>
              <input
                type="text"
                placeholder="Opcional"
                value={cancelMotivo}
                onChange={e => setCancelMotivo(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button
                className="btn btn-danger"
                onClick={handleCancelSubmit}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setCancelModal({ open: false, conta: null })}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nova conta ──────────────────────────────────────────────────── */}
      {novaModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={() => setNovaModal(false)}
        >
          <div
            className="modal"
            style={{ width: 620 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-title">Nova Conta a Pagar</div>

            {novaError && <div className="msg error">{novaError}</div>}

            <form onSubmit={handleNovaSubmit}>
              <div className="grid-2">
                <div className="field col-span-2">
                  <label>Fornecedor *</label>
                  <select
                    required
                    value={novaForm.fornecedor_id}
                    onChange={e => setNovaForm(f => ({ ...f, fornecedor_id: e.target.value }))}
                  >
                    <option value="">— Selecione —</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.razao_social}</option>
                    ))}
                  </select>
                </div>
                <div className="field col-span-2">
                  <label>Descrição *</label>
                  <input
                    type="text"
                    required
                    value={novaForm.descricao}
                    onChange={e => setNovaForm(f => ({ ...f, descricao: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={novaForm.valor}
                    onChange={e => setNovaForm(f => ({ ...f, valor: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Categoria</label>
                  <select
                    value={novaForm.categoria_despesa_id}
                    onChange={e => setNovaForm(f => ({ ...f, categoria_despesa_id: e.target.value }))}
                  >
                    <option value="">— Selecione —</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Data de emissão *</label>
                  <input
                    type="date"
                    required
                    value={novaForm.data_emissao}
                    onChange={e => setNovaForm(f => ({ ...f, data_emissao: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Data de vencimento *</label>
                  <input
                    type="date"
                    required
                    value={novaForm.data_vencimento}
                    onChange={e => setNovaForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  />
                </div>
                <div className="field col-span-2">
                  <label>Forma de pagamento</label>
                  <select
                    value={novaForm.forma_pagamento}
                    onChange={e => setNovaForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                  >
                    <option value="">— Selecione —</option>
                    {FORMAS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field col-span-2">
                  <label>Observações</label>
                  <input
                    type="text"
                    value={novaForm.observacoes}
                    onChange={e => setNovaForm(f => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={novaLoading}
                >
                  {novaLoading ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setNovaModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '' })}
      />
    </>
  );
}
