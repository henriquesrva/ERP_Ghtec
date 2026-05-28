import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  listClients, searchClients, getClient,
  createClient, updateClient, deleteClient, getProfitAnalysis,
} from '../api/clients';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';

/**
 * Clients.jsx
 *
 * Endpoints:
 *   GET  /clients
 *   GET  /clients/search?q=
 *   GET  /clients/profit-analysis
 *   GET  /clients/:id
 *   POST /clients           → { success, client }
 *   PUT  /clients/:id       → { success, client }
 *   DELETE /clients/:id     → { success, message }
 *
 * Comportamentos preservados:
 *   - Split layout: lista esquerda, formulário direita
 *   - Busca com debounce 280ms
 *   - CRUD completo com validação (nome obrigatório)
 *   - 409 DUPLICATE_CNPJ → aviso (não bloqueia fatal)
 *   - 409 HAS_PROPOSALS  → aviso ao tentar excluir
 *   - Após CREATE: troca para modo edição com dados salvos
 *   - Query params: ?id=X abre edição, ?new=1 foca no formulário
 *   - Análise de lucro em modal com gráfico de barras (Chart.js) + tabela
 *   - Botão Excluir aparece ao hover na lista
 *   - Flag "Possui contrato de peças"
 */

// ── Registra apenas os componentes Chart.js que usamos ──────────────────────
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(num, den) {
  if (num === null || !den || den === 0) return '—';
  return (num / den * 100).toFixed(1) + '%';
}

const EMPTY_FORM = {
  nome: '', nome_fantasia: '', razao_social: '', cnpj: '', inscricao_estadual: '',
  email: '', telefone: '', contato_responsavel: '', endereco: '',
  cidade: '', estado: '', cep: '', observacoes: '', has_parts_contract: false,
};

function clientToForm(c) {
  return {
    nome:                c.nome                || '',
    nome_fantasia:       c.nome_fantasia       || '',
    razao_social:        c.razao_social        || '',
    cnpj:                c.cnpj                || '',
    inscricao_estadual:  c.inscricao_estadual  || '',
    email:               c.email               || '',
    telefone:            c.telefone            || '',
    contato_responsavel: c.contato_responsavel || '',
    endereco:            c.endereco            || '',
    cidade:              c.cidade              || '',
    estado:              c.estado              || '',
    cep:                 c.cep                 || '',
    observacoes:         c.observacoes         || '',
    has_parts_contract:  !!c.has_parts_contract,
  };
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function Clients() {
  const [searchParams] = useSearchParams();

  // ── Lista ────────────────────────────────────────────────────────────────────
  const [clients,     setClients]     = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr,     setListErr]     = useState('');
  const [searchQ,     setSearchQ]     = useState('');
  const searchTimer = useRef(null);

  // ── Formulário ───────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState(null);
  const [editNome,   setEditNome]   = useState(''); // para título "Editando: X"
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [nomeErr,    setNomeErr]    = useState(false);
  const [formMsg,    setFormMsg]    = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // ── Excluir ───────────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, nome }

  // ── Modal de análise de lucro ─────────────────────────────────────────────────
  const [profitOpen,    setProfitOpen]    = useState(false);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitRows,    setProfitRows]    = useState(null);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // ── Carregar lista ───────────────────────────────────────────────────────────
  const loadList = useCallback(async (q = '') => {
    setListLoading(true);
    setListErr('');
    try {
      const data = q.trim() ? await searchClients(q.trim()) : await listClients();
      setClients(data);
    } catch {
      setListErr('Erro ao carregar clientes.');
      setClients([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  // ── Inicialização ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadList('').then(() => {
      const urlId = searchParams.get('id');
      if (urlId) loadForEdit(Number(urlId));
    });
  }, []); // eslint-disable-line

  // ── Abrir cliente para edição ─────────────────────────────────────────────────
  async function loadForEdit(id) {
    try {
      const client = await getClient(id);
      if (!client?.id) return;
      setEditingId(client.id);
      setEditNome(client.nome || '');
      setForm(clientToForm(client));
      setNomeErr(false);
      setFormMsg({ type: '', text: '' });
    } catch {
      setFormMsg({ type: 'error', text: 'Erro ao carregar cliente.' });
    }
  }

  // ── Modo criar ────────────────────────────────────────────────────────────────
  function setCreateMode() {
    setEditingId(null);
    setEditNome('');
    setForm(EMPTY_FORM);
    setNomeErr(false);
    setFormMsg({ type: '', text: '' });
  }

  // ── Busca ─────────────────────────────────────────────────────────────────────
  function handleSearch(e) {
    const q = e.target.value;
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadList(q), 280);
  }

  // ── Submit do formulário ──────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setNomeErr(false);
    setFormMsg({ type: '', text: '' });

    if (!form.nome.trim()) {
      setNomeErr(true);
      setFormMsg({ type: 'error', text: 'O campo Nome é obrigatório.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nome:                form.nome.trim()                || null,
        nome_fantasia:       form.nome_fantasia.trim()       || null,
        razao_social:        form.razao_social.trim()        || null,
        cnpj:                form.cnpj.trim()                || null,
        inscricao_estadual:  form.inscricao_estadual.trim()  || null,
        email:               form.email.trim()               || null,
        telefone:            form.telefone.trim()            || null,
        contato_responsavel: form.contato_responsavel.trim() || null,
        endereco:            form.endereco.trim()            || null,
        cidade:              form.cidade.trim()              || null,
        estado:              form.estado.trim()              || null,
        cep:                 form.cep.trim()                 || null,
        observacoes:         form.observacoes.trim()         || null,
        has_parts_contract:  form.has_parts_contract ? 1 : 0,
      };

      if (editingId) {
        const data  = await updateClient(editingId, payload);
        const saved = data.client ?? data;
        setEditNome(saved.nome || '');
        setFormMsg({ type: 'success', text: 'Cliente atualizado com sucesso.' });
        setToast({ message: 'Cliente atualizado.', type: 'success' });
        loadList(searchQ);
      } else {
        const data  = await createClient(payload);
        const saved = data.client ?? data;
        setFormMsg({ type: 'success', text: 'Cliente criado com sucesso.' });
        setToast({ message: 'Cliente criado.', type: 'success' });
        // Igual ao legado: troca para modo edição com o cliente recém criado
        setEditingId(saved.id);
        setEditNome(saved.nome || '');
        setForm(clientToForm(saved));
        loadList(searchQ);
      }
    } catch (err) {
      if (err.status === 409) {
        setFormMsg({ type: 'warn', text: err.message });
      } else {
        setFormMsg({ type: 'error', text: err.message || 'Erro ao salvar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Excluir cliente ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteConfirm) return;
    const { id, nome } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteClient(id);
      if (editingId === id) setCreateMode();
      setFormMsg({ type: 'success', text: `Cliente "${nome}" excluído com sucesso.` });
      setToast({ message: `Cliente "${nome}" excluído.`, type: 'success' });
      loadList(searchQ);
    } catch (err) {
      if (err.status === 409) {
        setFormMsg({ type: 'warn', text: err.message });
      } else {
        setFormMsg({ type: 'error', text: err.message || 'Erro ao excluir cliente.' });
      }
    }
  }

  // ── Análise de lucro ──────────────────────────────────────────────────────────
  async function openProfit() {
    setProfitOpen(true);
    setProfitRows(null);
    setProfitLoading(true);
    try {
      const rows = await getProfitAnalysis();
      setProfitRows(rows);
    } catch {
      setProfitRows([]);
    } finally {
      setProfitLoading(false);
    }
  }

  function closeProfit() {
    setProfitOpen(false);
    setProfitRows(null);
  }

  // ── Helpers de campo ─────────────────────────────────────────────────────────
  function sf(k) {
    return e => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-bar">
        <div>
          <h1>Clientes</h1>
          <span>Cadastro e edição de clientes</span>
        </div>
      </div>

      <div className="container">

        {/* ── Barra de análise de lucro ──────────────────────────────────────── */}
        <div style={{
          background: 'var(--green-bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px 18px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 700 }}>
              Análise de Lucro por Cliente
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              Comparativo de lucro total baseado nas propostas ativas e preço de compra das peças
            </div>
          </div>
          <button
            type="button"
            onClick={openProfit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
              background: 'var(--green)', color: '#fff', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            ▶ Comparar lucro dos clientes
          </button>
        </div>

        {/* ── Split: lista + formulário ──────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── LISTA ─────────────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Clientes cadastrados
              <button
                type="button"
                onClick={() => { setCreateMode(); }}
                style={{
                  padding: '5px 12px', fontSize: '12px', background: 'var(--green-bg)',
                  color: 'var(--green)', border: '1px dashed var(--green-light)',
                  borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700,
                  fontFamily: 'inherit',
                }}
              >
                + Novo
              </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type="text"
                value={searchQ}
                onChange={handleSearch}
                placeholder="Buscar por nome, CNPJ..."
                autoComplete="off"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', border: '1px solid #ccc',
                  borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Estado de lista */}
            {listLoading && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: '13px' }}>
                Carregando...
              </div>
            )}
            {listErr && !listLoading && (
              <div style={{ textAlign: 'center', color: 'var(--danger)', padding: '16px 0', fontSize: '13px' }}>
                {listErr}
              </div>
            )}

            {/* Lista */}
            {!listLoading && !listErr && (
              <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                {clients.length === 0
                  ? (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '13px' }}>
                      Nenhum cliente encontrado.
                    </div>
                  )
                  : clients.map(c => (
                    <ClientItem
                      key={c.id}
                      client={c}
                      selected={editingId === c.id}
                      onClick={() => loadForEdit(c.id)}
                      onDelete={() => setDeleteConfirm({ id: c.id, nome: c.nome })}
                    />
                  ))
                }
              </div>
            )}
          </div>

          {/* ── FORMULÁRIO ────────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {editingId
                ? `Editando: ${editNome}`
                : 'Novo Cliente'
              }
              {editingId && (
                <span style={{
                  background: '#fff8e1', color: 'var(--amber)',
                  border: '1px solid #ffe082', padding: '2px 8px',
                  borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                }}>
                  Editando
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} noValidate>

              {/* Nome / Razão Social — full width */}
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="field col-span-2">
                  <label>Nome / Razão Social *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => { sf('nome')(e); setNomeErr(false); }}
                    className={nomeErr ? 'error' : ''}
                    placeholder="Nome ou razão social completa"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Nome Fantasia + Razão Social formal */}
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="field">
                  <label>Nome Fantasia</label>
                  <input
                    type="text"
                    value={form.nome_fantasia}
                    onChange={sf('nome_fantasia')}
                    placeholder="Nome fantasia"
                    disabled={submitting}
                  />
                </div>
                <div className="field">
                  <label>Razão Social</label>
                  <input
                    type="text"
                    value={form.razao_social}
                    onChange={sf('razao_social')}
                    placeholder="Razão social completa"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* CNPJ + IE */}
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="field">
                  <label>CNPJ</label>
                  <input
                    type="text"
                    value={form.cnpj}
                    onChange={sf('cnpj')}
                    placeholder="00.000.000/0001-00"
                    disabled={submitting}
                  />
                </div>
                <div className="field">
                  <label>Inscrição Estadual</label>
                  <input
                    type="text"
                    value={form.inscricao_estadual}
                    onChange={sf('inscricao_estadual')}
                    placeholder="Inscrição estadual"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* E-mail + Telefone */}
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={sf('email')}
                    placeholder="contato@empresa.com"
                    disabled={submitting}
                  />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input
                    type="text"
                    value={form.telefone}
                    onChange={sf('telefone')}
                    placeholder="(11) 99999-9999"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Contato Responsável — full width */}
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="field col-span-2">
                  <label>Contato Responsável</label>
                  <input
                    type="text"
                    value={form.contato_responsavel}
                    onChange={sf('contato_responsavel')}
                    placeholder="Nome do responsável pelo contato"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Endereço — full width */}
              <div className="grid-3" style={{ marginBottom: '12px' }}>
                <div className="field col-span-3">
                  <label>Endereço</label>
                  <input
                    type="text"
                    value={form.endereco}
                    onChange={sf('endereco')}
                    placeholder="Rua, número, complemento"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Cidade + Estado + CEP */}
              <div className="grid-3" style={{ marginBottom: '12px' }}>
                <div className="field">
                  <label>Cidade</label>
                  <input
                    type="text"
                    value={form.cidade}
                    onChange={sf('cidade')}
                    placeholder="Cidade"
                    disabled={submitting}
                  />
                </div>
                <div className="field">
                  <label>Estado</label>
                  <input
                    type="text"
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))}
                    placeholder="SP"
                    maxLength={2}
                    disabled={submitting}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="field">
                  <label>CEP</label>
                  <input
                    type="text"
                    value={form.cep}
                    onChange={sf('cep')}
                    placeholder="00000-000"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Observações — full width */}
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="field col-span-2">
                  <label>Observações</label>
                  <textarea
                    value={form.observacoes}
                    onChange={sf('observacoes')}
                    placeholder="Observações internas sobre o cliente"
                    rows={3}
                    disabled={submitting}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Has parts contract */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text)',
                }}>
                  <input
                    type="checkbox"
                    checked={form.has_parts_contract}
                    onChange={e => setForm(f => ({ ...f, has_parts_contract: e.target.checked }))}
                    disabled={submitting}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--green)' }}
                  />
                  Possui contrato de peças
                </label>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', marginLeft: '24px' }}>
                  Marca este cliente para análise de gasto com contratos no Estoque
                </div>
              </div>

              {/* Mensagem de feedback */}
              {formMsg.text && (
                <div className={formMsg.type === 'warn' ? 'msg-warn' : `msg ${formMsg.type}`}
                  style={{ marginBottom: '12px' }}>
                  {formMsg.text}
                </div>
              )}

              {/* Ações */}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Salvando...' : (editingId ? 'Salvar alterações' : 'Criar cliente')}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={setCreateMode}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                )}
              </div>

            </form>
          </div>

        </div>
      </div>

      {/* ── Modal de análise de lucro ────────────────────────────────────────── */}
      {profitOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 300, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', overflowY: 'auto', padding: '32px 16px',
          }}
          onClick={closeProfit}
        >
          <div
            style={{
              background: '#fff', borderRadius: '8px', padding: '24px 28px',
              maxWidth: '820px', width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--green)' }}>
                Análise de Lucro por Cliente
              </span>
              <button
                type="button"
                onClick={closeProfit}
                style={{
                  background: 'none', border: 'none', fontSize: '22px',
                  cursor: 'pointer', color: 'var(--muted)', lineHeight: 1, padding: '0 4px',
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>
              Apenas propostas faturadas são consideradas. Itens sem preço de compra cadastrado são excluídos do cálculo.
            </div>

            {/* Corpo */}
            {profitLoading && (
              <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
                Carregando...
              </div>
            )}

            {!profitLoading && profitRows !== null && (
              <ProfitModalBody rows={profitRows} />
            )}
          </div>
        </div>
      )}

      {/* ── Confirm excluir ──────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <ConfirmModal
          title="Excluir cliente"
          message={`Deseja excluir <strong>${deleteConfirm.nome}</strong>? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(t => ({ ...t, message: '' }))}
      />
    </>
  );
}

// ── Sub-componente: item da lista ─────────────────────────────────────────────
function ClientItem({ client, selected, onClick, onDelete }) {
  const [hover, setHover] = useState(false);
  const sub = [
    client.cnpj,
    client.cidade && client.estado
      ? `${client.cidade}/${client.estado}`
      : client.cidade || client.estado,
  ].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
        border: `1px solid ${selected ? 'var(--green-light)' : hover ? 'var(--border)' : 'transparent'}`,
        background: selected || hover ? 'var(--green-bg)' : 'transparent',
        marginBottom: '4px', transition: 'all 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{client.nome}</div>
          {sub && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{sub}</div>}
        </div>
        {hover && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              border: '1px solid #ef9a9a', borderRadius: 'var(--radius)',
              background: '#fff', color: 'var(--danger)', flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente: corpo do modal de lucro ───────────────────────────────────
function ProfitModalBody({ rows }) {
  if (!rows.length) {
    return (
      <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
        Nenhuma proposta faturada encontrada.
      </div>
    );
  }

  const withProfit = rows.filter(r => r.lucro_calculavel !== null);
  const incomplete = rows.filter(r => r.itens_sem_custo > 0);

  return (
    <>
      {/* Aviso de itens sem custo */}
      {incomplete.length > 0 && (
        <div style={{
          fontSize: '12px', background: '#fff8e1', color: 'var(--amber)',
          border: '1px solid #ffe082', borderRadius: 'var(--radius)',
          padding: '8px 12px', marginBottom: '16px',
        }}>
          ⚠ Alguns itens não têm preço de compra cadastrado e foram excluídos do cálculo.
          Clientes afetados: {incomplete.map(r => r.cliente_nome).join(', ')}.
          Cadastre o preço de compra das peças para análise completa.
        </div>
      )}

      {/* Gráfico */}
      {withProfit.length > 0 ? (
        <ProfitChart rows={withProfit} />
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
          Nenhuma peça com preço de compra cadastrado. Edite as peças para ativar a análise de lucro.
        </div>
      )}

      {/* Tabela detalhada */}
      <p style={{
        fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px',
      }}>
        Detalhamento por cliente
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Cliente', 'Propostas', 'Valor faturado', 'Custo (itens c/ custo)', 'Lucro calculável', 'Margem', 'Itens s/ custo'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.client_id} style={{ background: i % 2 === 1 ? '#fafafa' : 'transparent' }}>
                <td style={{ padding: '7px 8px' }}>{r.cliente_nome}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.num_propostas}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.valor_total_venda)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {r.custo_total !== null ? fmtBRL(r.custo_total) : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td style={{
                  padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                  color: r.lucro_calculavel !== null && r.lucro_calculavel < 0 ? 'var(--danger)' : 'inherit',
                }}>
                  {r.lucro_calculavel !== null ? fmtBRL(r.lucro_calculavel) : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPct(r.lucro_calculavel, r.valor_venda_calculavel)}
                </td>
                <td style={{
                  padding: '7px 8px',
                  color: r.itens_sem_custo > 0 ? 'var(--amber)' : 'inherit',
                  fontStyle: r.itens_sem_custo > 0 ? 'italic' : 'normal',
                  fontSize: r.itens_sem_custo > 0 ? '11px' : '12px',
                }}>
                  {r.itens_sem_custo > 0 ? `${r.itens_sem_custo} de ${r.total_itens}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Sub-componente: gráfico de barras ─────────────────────────────────────────
function ProfitChart({ rows }) {
  const labels  = rows.map(r => r.cliente_nome);
  const values  = rows.map(r => r.lucro_calculavel);
  const bgColors = rows.map(r =>
    r.lucro_calculavel >= 0 ? 'rgba(46,125,50,0.75)' : 'rgba(198,40,40,0.75)'
  );
  const borderColors = rows.map(r =>
    r.lucro_calculavel >= 0 ? '#2e7d32' : '#c62828'
  );

  // Horizontal se > 4 clientes (igual ao legado)
  const isHorizontal = rows.length > 4;
  const chartHeight  = Math.max(240, rows.length * 40);

  const data = {
    labels,
    datasets: [{
      label: 'Lucro total (R$)',
      data: values,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const options = {
    indexAxis: isHorizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `Lucro: ${fmtBRL(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 11 } } },
      y: { ticks: { font: { size: 11 } }, beginAtZero: true },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: `${chartHeight}px`, marginBottom: '28px' }}>
      <Bar data={data} options={options} />
    </div>
  );
}
