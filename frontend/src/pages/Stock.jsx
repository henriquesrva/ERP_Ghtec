import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import {
  getStockParts,
  getMovements,
  getContractSpend,
  getMovsByDate,
  createMovement,
  inventoryCount,
  getPartCategories,
} from '../api/stock';
import { listProposals } from '../api/proposals';
import { listClients }   from '../api/clients';
import { searchParts }   from '../api/parts';
import Toast             from '../components/shared/Toast';

// ── Registrar Chart.js ─────────────────────────────────────────────────────────
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ── Utilitários ────────────────────────────────────────────────────────────────

function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt.replace(' ', 'T'));
  if (isNaN(d)) return dt;
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtBRL(val) {
  if (val === null || val === undefined) return '—';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ENTRY_LABELS = {
  compra_nova:        'Compra nova',
  devolucao_tecnicos: 'Dev. técnicos',
  devolucao_conserto: 'Dev. conserto',
  guardar_alguem:     'Guardar p/ alguém',
};

// ── Estado default para o form de movimentação ─────────────────────────────────
const MOV_DEFAULTS = {
  movType:        null,
  entryType:      null,
  returnsToStock: null,
  ePartSearch: '', ePartId: null, ePartDropdown: [],
  eQty: '', eNotes: '',
  sPartSearch: '', sPartId: null, sPartDropdown: [], sStockInfo: null,
  sQty: '', sProposalId: '', sClientId: '', sNotes: '',
  errors: {},
  msg: null,
  submitting: false,
};

// ── Componente principal ───────────────────────────────────────────────────────
export default function Stock() {

  // ── Views ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState('home'); // 'home' | 'stock' | 'movements' | 'charts'

  // ── Dados globais ──────────────────────────────────────────────────────────
  const [stockParts,   setStockParts]   = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [movements,    setMovements]    = useState([]);
  const [allProposals, setAllProposals] = useState([]);
  const [allClients,   setAllClients]   = useState([]);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [stockSearch,    setStockSearch]    = useState('');
  const [stockCatFilter, setStockCatFilter] = useState('');
  const [histPartFilter, setHistPartFilter] = useState('');

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ message: '' });

  // ── Modal: nova movimentação ───────────────────────────────────────────────
  const [movModal, setMovModal] = useState(false);
  const [movStep,  setMovStep]  = useState(1);
  const [mov,      setMov]      = useState({ ...MOV_DEFAULTS });

  // ── Modal: gastos com contratos ────────────────────────────────────────────
  const [spendModal,   setSpendModal]   = useState(false);
  const [spendData,    setSpendData]    = useState(null);
  const [spendLoading, setSpendLoading] = useState(false);

  // ── Modal: contagem de estoque ─────────────────────────────────────────────
  const [countModal,      setCountModal]      = useState(false);
  const [countParts,      setCountParts]      = useState([]);
  const [countValues,     setCountValues]     = useState({});
  const [countNotes,      setCountNotes]      = useState('');
  const [countMsg,        setCountMsg]        = useState(null);
  const [countSubmitting, setCountSubmitting] = useState(false);

  // ── Modal: movimentações por data ──────────────────────────────────────────
  const [movDateModal,   setMovDateModal]   = useState(false);
  const [movDateDays,    setMovDateDays]    = useState(60);
  const [movDateData,    setMovDateData]    = useState(null);
  const [movDateLoading, setMovDateLoading] = useState(false);

  // ── Refs para debounce de busca de peças ───────────────────────────────────
  const ePartTimerRef = useRef(null);
  const sPartTimerRef = useRef(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([listProposals(), listClients(), getPartCategories()])
      .then(([proposals, clients, cats]) => {
        setAllProposals(Array.isArray(proposals) ? proposals : []);
        setAllClients(Array.isArray(clients) ? clients : []);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {});
  }, []);

  // ── Carga ao mudar de view ─────────────────────────────────────────────────
  useEffect(() => {
    if (view === 'stock' || view === 'movements') {
      loadStock();
    }
    if (view === 'movements') {
      loadMovements(histPartFilter || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Recarregar movimentações ao mudar filtro ───────────────────────────────
  useEffect(() => {
    if (view === 'movements') {
      loadMovements(histPartFilter || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histPartFilter]);

  // ── Funções de carga ───────────────────────────────────────────────────────

  async function loadStock() {
    try {
      const parts = await getStockParts();
      setStockParts(Array.isArray(parts) ? parts : []);
    } catch {
      setToast({ message: 'Erro ao carregar estoque.', type: 'error' });
    }
  }

  async function loadMovements(partId) {
    try {
      const rows = await getMovements(partId ? Number(partId) : null);
      setMovements(Array.isArray(rows) ? rows : []);
    } catch {
      setToast({ message: 'Erro ao carregar movimentações.', type: 'error' });
    }
  }

  // ── Filtro de estoque ──────────────────────────────────────────────────────
  const filteredStock = stockParts.filter(p => {
    const q = stockSearch.toLowerCase();
    const matchSearch = !q
      || (p.nome          || '').toLowerCase().includes(q)
      || (p.codigo_interno || '').toLowerCase().includes(q);
    const matchCat = !stockCatFilter || p.category_id === Number(stockCatFilter);
    return matchSearch && matchCat;
  });

  // ── Ir para movimentações filtrado por peça ────────────────────────────────
  function goToMovementsFiltered(partId) {
    setHistPartFilter(String(partId));
    setView('movements');
  }

  // ── Modal: nova movimentação ───────────────────────────────────────────────

  function openMovModal() {
    setMov({ ...MOV_DEFAULTS });
    setMovStep(1);
    setMovModal(true);
  }

  function closeMovModal() {
    setMovModal(false);
  }

  function goToStep2() {
    setMovStep(2);
  }

  function goToStep1() {
    setMovStep(1);
    setMov(m => ({ ...m, msg: null }));
  }

  // Busca de peças — entrada
  function handleEPartInput(val) {
    setMov(m => ({ ...m, ePartSearch: val, ePartId: null, ePartDropdown: [] }));
    clearTimeout(ePartTimerRef.current);
    if (!val.trim()) return;
    ePartTimerRef.current = setTimeout(async () => {
      try {
        const list     = await searchParts(val);
        const eligible = (Array.isArray(list) ? list : [])
          .filter(p => p.codigo_interno && p.codigo_interno.trim());
        setMov(m => ({ ...m, ePartDropdown: eligible }));
      } catch {
        setMov(m => ({ ...m, ePartDropdown: [] }));
      }
    }, 250);
  }

  function selectEPart(part) {
    setMov(m => ({
      ...m,
      ePartSearch:  `${part.codigo_interno} — ${part.nome}`,
      ePartId:      part.id,
      ePartDropdown: [],
      errors: { ...m.errors, ePartId: false },
    }));
  }

  // Busca de peças — saída
  function handleSPartInput(val) {
    setMov(m => ({ ...m, sPartSearch: val, sPartId: null, sPartDropdown: [], sStockInfo: null }));
    clearTimeout(sPartTimerRef.current);
    if (!val.trim()) return;
    sPartTimerRef.current = setTimeout(async () => {
      try {
        const list     = await searchParts(val);
        const eligible = (Array.isArray(list) ? list : [])
          .filter(p => p.codigo_interno && p.codigo_interno.trim());
        setMov(m => ({ ...m, sPartDropdown: eligible }));
      } catch {
        setMov(m => ({ ...m, sPartDropdown: [] }));
      }
    }, 250);
  }

  function selectSPart(part) {
    const stockPart = stockParts.find(p => p.id === part.id);
    const qty = stockPart ? (stockPart.stock_quantity || 0) : 0;
    setMov(m => ({
      ...m,
      sPartSearch:  `${part.codigo_interno} — ${part.nome}`,
      sPartId:      part.id,
      sPartDropdown: [],
      sStockInfo:   { qty, low: qty <= 0, warn: qty > 0 && qty <= 2 },
      errors: { ...m.errors, sPartId: false },
    }));
  }

  // Proposta → auto-preencher cliente
  function handleProposalChange(proposalId) {
    setMov(m => {
      let clientId = m.sClientId;
      if (proposalId) {
        const p = allProposals.find(p => String(p.id) === proposalId);
        if (p && p.cliente_id) clientId = String(p.cliente_id);
      }
      return { ...m, sProposalId: proposalId, sClientId: clientId };
    });
  }

  // Validar e submeter movimentação
  async function submitMovement() {
    const errors = {};

    if (mov.movType === 'entrada') {
      if (!mov.entryType) errors.entryType = true;
      if (!mov.ePartId)   errors.ePartId   = true;
      const qty = parseInt(mov.eQty, 10);
      if (!qty || qty <= 0) errors.eQty = true;
      if (Object.keys(errors).length) { setMov(m => ({ ...m, errors })); return; }

      setMov(m => ({ ...m, submitting: true, msg: null }));
      try {
        await createMovement({
          movement_type: 'entrada',
          entry_type:    mov.entryType,
          part_id:       mov.ePartId,
          quantity:      qty,
          notes:         mov.eNotes.trim() || null,
        });
        setMov(m => ({ ...m, submitting: false, msg: { type: 'success', text: 'Movimentação registrada com sucesso!' } }));
        await loadStock();
        if (view === 'movements') await loadMovements(histPartFilter || null);
        setTimeout(() => closeMovModal(), 1200);
      } catch (err) {
        const text = err?.data?.message || err?.message || 'Erro ao registrar movimentação.';
        setMov(m => ({ ...m, submitting: false, msg: { type: 'error', text } }));
      }

    } else {
      if (!mov.sPartId)              errors.sPartId       = true;
      const qty = parseInt(mov.sQty, 10);
      if (!qty || qty <= 0)          errors.sQty          = true;
      if (mov.returnsToStock === null) errors.returnsToStock = true;
      if (Object.keys(errors).length) { setMov(m => ({ ...m, errors })); return; }

      setMov(m => ({ ...m, submitting: true, msg: null }));
      try {
        await createMovement({
          movement_type:    'saida',
          part_id:          mov.sPartId,
          quantity:         qty,
          proposal_id:      mov.sProposalId ? Number(mov.sProposalId) : null,
          client_id:        mov.sClientId   ? Number(mov.sClientId)   : null,
          returns_to_stock: mov.returnsToStock,
          notes:            mov.sNotes.trim() || null,
        });
        setMov(m => ({ ...m, submitting: false, msg: { type: 'success', text: 'Movimentação registrada com sucesso!' } }));
        await loadStock();
        if (view === 'movements') await loadMovements(histPartFilter || null);
        setTimeout(() => closeMovModal(), 1200);
      } catch (err) {
        const text = err?.data?.message || err?.message || 'Erro ao registrar movimentação.';
        setMov(m => ({ ...m, submitting: false, msg: { type: 'error', text } }));
      }
    }
  }

  // ── Modal: gastos com contratos ────────────────────────────────────────────

  async function openSpendModal() {
    setSpendLoading(true);
    setSpendData(null);
    setSpendModal(true);
    try {
      const data = await getContractSpend();
      setSpendData(Array.isArray(data) ? data : []);
    } catch {
      setSpendData([]);
    } finally {
      setSpendLoading(false);
    }
  }

  function closeSpendModal() {
    setSpendModal(false);
    setSpendData(null);
  }

  // ── Modal: contagem de estoque ─────────────────────────────────────────────

  async function openCountModal() {
    setCountNotes('');
    setCountMsg(null);
    setCountSubmitting(false);
    setCountValues({});
    setCountModal(true);
    try {
      const parts = await getStockParts();
      setCountParts(Array.isArray(parts) ? parts : []);
    } catch {
      setCountParts([]);
    }
  }

  function closeCountModal() {
    setCountModal(false);
  }

  async function submitCount() {
    const adjustments = [];
    for (const [partIdStr, val] of Object.entries(countValues)) {
      if (val === '' || val === null || val === undefined) continue;
      const newQty     = parseInt(String(val), 10);
      const part       = countParts.find(p => p.id === Number(partIdStr));
      const currentQty = part ? (part.stock_quantity || 0) : 0;
      if (isNaN(newQty) || newQty < 0) continue;
      if (newQty === currentQty) continue;
      adjustments.push({
        part_id:      Number(partIdStr),
        new_quantity: newQty,
        notes:        countNotes.trim() || null,
      });
    }

    if (!adjustments.length) {
      setCountMsg({ type: 'warn', text: 'Nenhuma quantidade foi alterada.' });
      return;
    }

    setCountSubmitting(true);
    try {
      const data = await inventoryCount(adjustments);
      setCountMsg({ type: 'success', text: `${data.count} peça(s) atualizada(s) com sucesso!` });
      await loadStock();
      setTimeout(() => closeCountModal(), 1500);
    } catch (err) {
      setCountMsg({ type: 'error', text: err?.data?.message || err?.message || 'Erro ao salvar contagem.' });
      setCountSubmitting(false);
    }
  }

  // ── Modal: movimentações por data ──────────────────────────────────────────

  async function openMovDateModal(days) {
    const d = days || 60;
    setMovDateDays(d);
    setMovDateLoading(true);
    setMovDateData(null);
    setMovDateModal(true);
    try {
      const rows = await getMovsByDate(d);
      setMovDateData(Array.isArray(rows) ? rows : []);
    } catch {
      setMovDateData([]);
    } finally {
      setMovDateLoading(false);
    }
  }

  async function changeMovDatePeriod(days) {
    setMovDateDays(days);
    setMovDateLoading(true);
    setMovDateData(null);
    try {
      const rows = await getMovsByDate(days);
      setMovDateData(Array.isArray(rows) ? rows : []);
    } catch {
      setMovDateData([]);
    } finally {
      setMovDateLoading(false);
    }
  }

  function closeMovDateModal() {
    setMovDateModal(false);
    setMovDateData(null);
  }

  // ── Dados para gráficos ────────────────────────────────────────────────────

  function buildSpendChartData(rows) {
    const withSpend = rows.filter(r => r.total_movements > 0);
    if (!withSpend.length) return null;
    return {
      labels:     withSpend.map(r => r.client_nome),
      values:     withSpend.map(r => r.total_spend),
      horizontal: withSpend.length > 4,
    };
  }

  function buildMovDateChartData(rows) {
    if (!rows.length) return null;
    const dateMap = {};
    rows.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { entrada: 0, saida: 0 };
      dateMap[r.date][r.movement_type] = r.total_qty;
    });
    const dates   = Object.keys(dateMap).sort();
    const labels  = dates.map(d => { const [, m, day] = d.split('-'); return `${day}/${m}`; });
    return {
      labels,
      entradas: dates.map(d => dateMap[d].entrada || 0),
      saidas:   dates.map(d => dateMap[d].saida   || 0),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '' })}
      />

      <div className="page-bar">
        <div>
          <h1>Estoque</h1>
          <div>Peças com código interno · movimentações de entrada e saída</div>
        </div>
      </div>

      <div className="container">

        {/* ── View: Home ──────────────────────────────────────────────────── */}
        {view === 'home' && (
          <div className="home-grid">
            <div className="home-card" onClick={() => setView('stock')}>
              <div className="home-card-icon">📦</div>
              <div className="home-card-label">Estoque</div>
              <div className="home-card-desc">Visualizar peças, quantidades e contagem</div>
            </div>
            <div className="home-card" onClick={() => setView('movements')}>
              <div className="home-card-icon">📋</div>
              <div className="home-card-label">Movimentações</div>
              <div className="home-card-desc">Histórico e registro de entradas e saídas</div>
            </div>
            <div className="home-card" onClick={() => setView('charts')}>
              <div className="home-card-icon">📊</div>
              <div className="home-card-label">Gráficos</div>
              <div className="home-card-desc">Análises visuais de gastos e movimentações</div>
            </div>
          </div>
        )}

        {/* ── View: Estoque ────────────────────────────────────────────────── */}
        {view === 'stock' && (
          <div>
            <div className="subview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
                <span className="subview-title">Estoque</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openCountModal}>
                ✎ Contagem de estoque
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="section-title">Peças em estoque</span>
                <div className="filters">
                  <input
                    type="text"
                    placeholder="Buscar por código ou nome..."
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <select value={stockCatFilter} onChange={e => setStockCatFilter(e.target.value)}>
                    <option value="">Todas as categorias</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Código Interno</th>
                      <th>Nome</th>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'center' }}>Qtd. Estoque</th>
                      <th style={{ textAlign: 'center' }}>Histórico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="tbl-empty">
                          {stockParts.length === 0
                            ? 'Carregando...'
                            : 'Nenhuma peça encontrada.'}
                        </td>
                      </tr>
                    ) : filteredStock.map(p => {
                      const qty = p.stock_quantity || 0;
                      const cls = qty <= 0 ? 'qty-zero' : qty <= 2 ? 'qty-low' : 'qty-ok';
                      const catLabel = p.category_name || p.categoria || '—';
                      return (
                        <tr key={p.id}>
                          <td>
                            <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                              {p.codigo_interno}
                            </code>
                          </td>
                          <td style={{ fontWeight: 600 }}>{p.nome}</td>
                          <td style={{ color: 'var(--color-muted)', fontSize: 12 }}>{catLabel}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`qty-badge ${cls}`}>{qty}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn-hist"
                              onClick={() => goToMovementsFiltered(p.id)}
                            >Ver</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── View: Movimentações ──────────────────────────────────────────── */}
        {view === 'movements' && (
          <div>
            <div className="subview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
                <span className="subview-title">Movimentações</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openMovModal}>
                + Nova movimentação
              </button>
            </div>

            <div className="card">
              <div className="hist-filter">
                <label>Peça:</label>
                <select
                  value={histPartFilter}
                  onChange={e => setHistPartFilter(e.target.value)}
                >
                  <option value="">— Todas as peças —</option>
                  {stockParts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo_interno} — {p.nome}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-hist"
                  onClick={() => setHistPartFilter('')}
                  style={{ padding: '5px 10px' }}
                >Limpar filtro</button>
              </div>

              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Tipo</th>
                      <th>Peça</th>
                      <th>Cód. Interno</th>
                      <th style={{ textAlign: 'center' }}>Qtd.</th>
                      <th style={{ textAlign: 'center' }}>Antes → Depois</th>
                      <th>Detalhe</th>
                      <th>Proposta</th>
                      <th>Cliente</th>
                      <th>Usuário</th>
                      <th>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="tbl-empty">
                          Nenhuma movimentação registrada.
                        </td>
                      </tr>
                    ) : movements.map(r => {
                      let badge, detalhe;
                      if (r.movement_type === 'entrada') {
                        badge   = <span className="badge-entrada">Entrada</span>;
                        detalhe = ENTRY_LABELS[r.entry_type] || r.entry_type || '—';
                      } else if (r.movement_type === 'contagem') {
                        badge   = <span className="badge-contagem">Contagem</span>;
                        detalhe = 'Contagem de estoque';
                      } else {
                        badge   = <span className="badge-saida">Saída</span>;
                        detalhe = r.returns_to_stock ? 'Volta ao estoque' : 'Saída definitiva';
                      }

                      const hasPrevNew =
                        r.previous_quantity !== null && r.previous_quantity !== undefined &&
                        r.new_quantity      !== null && r.new_quantity      !== undefined;

                      return (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--color-muted)' }}>
                            {fmtDateTime(r.created_at)}
                          </td>
                          <td>{badge}</td>
                          <td style={{ fontWeight: 600 }}>{r.part_nome}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                            <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 }}>
                              {r.codigo_interno || '—'}
                            </code>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.quantity}</td>
                          <td style={{ textAlign: 'center', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {hasPrevNew
                              ? <>{r.previous_quantity} → <strong>{r.new_quantity}</strong></>
                              : '—'}
                          </td>
                          <td style={{ fontSize: 12 }}>{detalhe}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>{r.numero_proposta || '—'}</td>
                          <td style={{ fontSize: 12 }}>{r.client_nome || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>{r.created_by_nome}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>{r.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── View: Gráficos ───────────────────────────────────────────────── */}
        {view === 'charts' && (
          <div>
            <div className="subview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
                <span className="subview-title">Gráficos</span>
              </div>
            </div>
            <div className="home-grid">
              <div className="home-card" onClick={() => openSpendModal()}>
                <div className="home-card-icon">📈</div>
                <div className="home-card-label">Gastos com Contratos</div>
                <div className="home-card-desc">Gasto por cliente com contrato de peças</div>
              </div>
              <div className="home-card" onClick={() => openMovDateModal(60)}>
                <div className="home-card-icon">📊</div>
                <div className="home-card-label">Movimentações por Data</div>
                <div className="home-card-desc">Entradas e saídas ao longo do tempo</div>
              </div>
            </div>
          </div>
        )}

      </div>{/* /container */}

      {/* ═══════════════════════════════════════════════════════════════════
          Modal: Nova Movimentação (2 passos)
      ═══════════════════════════════════════════════════════════════════ */}
      {movModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) closeMovModal(); }}
        >
          <div className="modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20, paddingBottom: 12,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>
                {movStep === 1
                  ? 'Nova Movimentação'
                  : mov.movType === 'entrada'
                    ? 'Movimentação · Entrada'
                    : 'Movimentação · Saída'}
              </span>
              <button className="modal-close" onClick={closeMovModal}>&times;</button>
            </div>

            {/* Passo 1: escolher tipo */}
            {movStep === 1 && (
              <>
                <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 16px' }}>
                  Selecione o tipo de movimentação:
                </p>
                <div className="type-grid">
                  <div
                    className={`type-card entrada${mov.movType === 'entrada' ? ' selected' : ''}`}
                    onClick={() => setMov(m => ({ ...m, movType: 'entrada' }))}
                  >
                    <div className="type-card-icon">⬇</div>
                    <div className="type-card-label">Entrada</div>
                    <div className="type-card-desc">Compra, devolução ou guarda</div>
                  </div>
                  <div
                    className={`type-card saida${mov.movType === 'saida' ? ' selected' : ''}`}
                    onClick={() => setMov(m => ({ ...m, movType: 'saida' }))}
                  >
                    <div className="type-card-icon">⬆</div>
                    <div className="type-card-label">Saída</div>
                    <div className="type-card-desc">Uso em proposta, empréstimo, técnico...</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    className="btn btn-primary"
                    disabled={!mov.movType}
                    onClick={goToStep2}
                  >Continuar</button>
                  <button className="btn btn-ghost" onClick={closeMovModal}>Cancelar</button>
                </div>
              </>
            )}

            {/* Passo 2: ENTRADA */}
            {movStep === 2 && mov.movType === 'entrada' && (
              <>
                {/* Tipo de entrada */}
                <div className="mfield">
                  <label>Tipo de entrada *</label>
                  <div className="entry-type-grid">
                    {[
                      { val: 'compra_nova',       label: 'Compra nova' },
                      { val: 'devolucao_tecnicos', label: 'Devolução de técnicos' },
                      { val: 'devolucao_conserto', label: 'Devolução conserto' },
                      { val: 'guardar_alguem',     label: 'Guardar para alguém' },
                    ].map(({ val, label }) => (
                      <div
                        key={val}
                        className={[
                          'entry-type-opt',
                          mov.entryType === val ? 'selected' : '',
                          mov.errors.entryType  ? 'err'      : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setMov(m => ({
                          ...m, entryType: val,
                          errors: { ...m.errors, entryType: false },
                        }))}
                      >{label}</div>
                    ))}
                  </div>
                  {mov.errors.entryType && (
                    <span className="mfield-hint err">Selecione o tipo de entrada.</span>
                  )}
                </div>

                {/* Peça */}
                <div className="mfield">
                  <label>Peça *</label>
                  <div className="part-search-wrap">
                    <input
                      type="text"
                      placeholder="Buscar por nome ou código interno..."
                      value={mov.ePartSearch}
                      onChange={e => handleEPartInput(e.target.value)}
                      autoComplete="off"
                      className={mov.errors.ePartId ? 'err' : ''}
                    />
                    {mov.ePartDropdown.length > 0 && (
                      <div className="part-dropdown">
                        {mov.ePartDropdown.map(p => (
                          <div
                            key={p.id}
                            className="part-opt"
                            onMouseDown={e => { e.preventDefault(); selectEPart(p); }}
                          >
                            <div className="popt-name">{p.codigo_interno} — {p.nome}</div>
                            {(p.category_name || p.categoria) && (
                              <div className="popt-sub">{p.category_name || p.categoria}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {mov.ePartSearch.length > 1 && mov.ePartDropdown.length === 0 && !mov.ePartId && (
                      <div className="part-dropdown">
                        <div className="part-opt no-result">Nenhuma peça encontrada com código interno.</div>
                      </div>
                    )}
                  </div>
                  {mov.errors.ePartId && (
                    <span className="mfield-hint err">Selecione uma peça.</span>
                  )}
                </div>

                {/* Quantidade */}
                <div className="mfield">
                  <label>Quantidade *</label>
                  <input
                    type="number" min="1" step="1" placeholder="Ex: 2"
                    value={mov.eQty}
                    onChange={e => setMov(m => ({ ...m, eQty: e.target.value, errors: { ...m.errors, eQty: false } }))}
                    className={mov.errors.eQty ? 'err' : ''}
                  />
                  {mov.errors.eQty && (
                    <span className="mfield-hint err">Informe a quantidade.</span>
                  )}
                </div>

                {/* Observações */}
                <div className="mfield">
                  <label>Observações</label>
                  <textarea
                    placeholder="Informações adicionais..."
                    value={mov.eNotes}
                    onChange={e => setMov(m => ({ ...m, eNotes: e.target.value }))}
                  />
                </div>

                {mov.msg && (
                  <div className={`msg ${mov.msg.type}`} style={{ marginBottom: 10 }}>
                    {mov.msg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    disabled={mov.submitting}
                    onClick={submitMovement}
                  >{mov.submitting ? 'Salvando...' : 'Registrar movimentação'}</button>
                  <button className="btn btn-ghost" onClick={goToStep1}>Voltar</button>
                  <button className="btn btn-ghost" onClick={closeMovModal}>Cancelar</button>
                </div>
              </>
            )}

            {/* Passo 2: SAÍDA */}
            {movStep === 2 && mov.movType === 'saida' && (
              <>
                {/* Peça */}
                <div className="mfield">
                  <label>Peça *</label>
                  <div className="part-search-wrap">
                    <input
                      type="text"
                      placeholder="Buscar por nome ou código interno..."
                      value={mov.sPartSearch}
                      onChange={e => handleSPartInput(e.target.value)}
                      autoComplete="off"
                      className={mov.errors.sPartId ? 'err' : ''}
                    />
                    {mov.sPartDropdown.length > 0 && (
                      <div className="part-dropdown">
                        {mov.sPartDropdown.map(p => (
                          <div
                            key={p.id}
                            className="part-opt"
                            onMouseDown={e => { e.preventDefault(); selectSPart(p); }}
                          >
                            <div className="popt-name">{p.codigo_interno} — {p.nome}</div>
                            {(p.category_name || p.categoria) && (
                              <div className="popt-sub">{p.category_name || p.categoria}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {mov.sPartSearch.length > 1 && mov.sPartDropdown.length === 0 && !mov.sPartId && (
                      <div className="part-dropdown">
                        <div className="part-opt no-result">Nenhuma peça encontrada com código interno.</div>
                      </div>
                    )}
                  </div>
                  {mov.errors.sPartId && (
                    <span className="mfield-hint err">Selecione uma peça.</span>
                  )}
                  {mov.sStockInfo && (
                    <span
                      className="mfield-hint"
                      style={{
                        color: mov.sStockInfo.low
                          ? 'var(--color-danger)'
                          : mov.sStockInfo.warn
                            ? 'var(--color-amber)'
                            : 'var(--color-primary)',
                      }}
                    >
                      Estoque disponível: {mov.sStockInfo.qty} unidade(s)
                    </span>
                  )}
                </div>

                {/* Quantidade */}
                <div className="mfield">
                  <label>Quantidade *</label>
                  <input
                    type="number" min="1" step="1" placeholder="Ex: 1"
                    value={mov.sQty}
                    onChange={e => setMov(m => ({ ...m, sQty: e.target.value, errors: { ...m.errors, sQty: false } }))}
                    className={mov.errors.sQty ? 'err' : ''}
                  />
                  {mov.errors.sQty && (
                    <span className="mfield-hint err">Informe a quantidade.</span>
                  )}
                </div>

                {/* Proposta */}
                <div className="mfield">
                  <label>
                    Proposta associada{' '}
                    <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
                  </label>
                  <select value={mov.sProposalId} onChange={e => handleProposalChange(e.target.value)}>
                    <option value="">— Nenhuma —</option>
                    {[...allProposals].reverse().map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero_proposta} — {p.cliente_nome || ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cliente */}
                <div className="mfield">
                  <label>
                    Cliente associado{' '}
                    <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
                  </label>
                  <select
                    value={mov.sClientId}
                    onChange={e => setMov(m => ({ ...m, sClientId: e.target.value }))}
                  >
                    <option value="">— Nenhum —</option>
                    {allClients.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Volta ao estoque */}
                <div className="mfield">
                  <label>A peça volta para o estoque? *</label>
                  <div className="returns-row">
                    <div
                      className={[
                        'returns-opt',
                        mov.returnsToStock === true  ? 'sel-yes' : '',
                        mov.errors.returnsToStock    ? 'err'     : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setMov(m => ({
                        ...m, returnsToStock: true,
                        errors: { ...m.errors, returnsToStock: false },
                      }))}
                    >Sim — volta</div>
                    <div
                      className={[
                        'returns-opt',
                        mov.returnsToStock === false ? 'sel-no' : '',
                        mov.errors.returnsToStock   ? 'err'    : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setMov(m => ({
                        ...m, returnsToStock: false,
                        errors: { ...m.errors, returnsToStock: false },
                      }))}
                    >Não — saída definitiva</div>
                  </div>
                  {mov.errors.returnsToStock && (
                    <span className="mfield-hint err">
                      Informe se a peça volta ao estoque.
                    </span>
                  )}
                </div>

                {/* Observações */}
                <div className="mfield">
                  <label>Observações</label>
                  <textarea
                    placeholder="Ex: Saída para técnico João, retorno previsto..."
                    value={mov.sNotes}
                    onChange={e => setMov(m => ({ ...m, sNotes: e.target.value }))}
                  />
                </div>

                {mov.msg && (
                  <div className={`msg ${mov.msg.type}`} style={{ marginBottom: 10 }}>
                    {mov.msg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    disabled={mov.submitting}
                    onClick={submitMovement}
                  >{mov.submitting ? 'Salvando...' : 'Registrar movimentação'}</button>
                  <button className="btn btn-ghost" onClick={goToStep1}>Voltar</button>
                  <button className="btn btn-ghost" onClick={closeMovModal}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Modal: Gastos com Contratos
      ═══════════════════════════════════════════════════════════════════ */}
      {spendModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) closeSpendModal(); }}
        >
          <div
            className="modal"
            style={{ width: 820, maxWidth: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4, paddingBottom: 12,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>
                Gastos com Contratos de Peças
              </span>
              <button className="modal-close" onClick={closeSpendModal}>&times;</button>
            </div>
            <p className="modal-subtitle">
              Clientes com contrato de peças · gasto calculado por saídas × preço de compra das peças.
            </p>

            {spendLoading && <div className="spend-empty">Carregando...</div>}

            {!spendLoading && spendData !== null && (() => {
              if (!spendData.length) {
                return (
                  <div className="spend-empty">
                    Nenhum cliente com contrato de peças cadastrado. Marque clientes como &quot;Possui contrato de peças&quot; na tela de Clientes.
                  </div>
                );
              }
              const withMissing = spendData.filter(r => r.items_without_price > 0);
              const chartInfo   = buildSpendChartData(spendData);
              return (
                <>
                  {withMissing.length > 0 && (
                    <div className="msg warn" style={{ marginBottom: 14 }}>
                      ⚠ Alguns itens não têm preço de compra cadastrado e foram excluídos do cálculo.
                      Clientes afetados: {withMissing.map(r => r.client_nome).join(', ')}.
                    </div>
                  )}

                  {chartInfo ? (
                    <div className="chart-wrap">
                      <Bar
                        data={{
                          labels: chartInfo.labels,
                          datasets: [{
                            label: 'Gasto total (R$)',
                            data:  chartInfo.values,
                            backgroundColor: 'rgba(46,125,50,0.75)',
                            borderColor:     '#2e7d32',
                            borderWidth: 1,
                            borderRadius: 4,
                          }],
                        }}
                        options={{
                          indexAxis:  chartInfo.horizontal ? 'y' : 'x',
                          responsive: true,
                          plugins: {
                            legend:  { display: false },
                            tooltip: { callbacks: { label: ctx => `Gasto: ${fmtBRL(ctx.raw)}` } },
                          },
                          scales: {
                            x: { ticks: { font: { size: 11 } } },
                            y: { ticks: { font: { size: 11 } }, beginAtZero: true },
                          },
                        }}
                        height={Math.max(200, chartInfo.values.length * 42)}
                      />
                    </div>
                  ) : (
                    <div className="spend-empty">
                      Nenhuma saída registrada ainda para clientes com contrato.
                    </div>
                  )}

                  <p className="spend-section-title">Detalhamento por cliente</p>
                  <table className="spend-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Movimentações</th>
                        <th>Gasto calculado</th>
                        <th>Itens s/ preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spendData.map(r => (
                        <tr key={r.client_id ?? r.client_nome}>
                          <td>{r.client_nome}</td>
                          <td className="num">{r.total_movements}</td>
                          <td className="num" style={{ fontWeight: 700 }}>
                            {r.total_spend > 0
                              ? fmtBRL(r.total_spend)
                              : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                          </td>
                          <td
                            className="num"
                            style={r.items_without_price > 0
                              ? { color: 'var(--color-amber)', fontStyle: 'italic' }
                              : {}}
                          >
                            {r.items_without_price > 0 ? r.items_without_price : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Modal: Contagem de Estoque
      ═══════════════════════════════════════════════════════════════════ */}
      {countModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) closeCountModal(); }}
        >
          <div
            className="modal"
            style={{ width: 820, maxWidth: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4, paddingBottom: 12,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>
                Contagem de Estoque
              </span>
              <button className="modal-close" onClick={closeCountModal}>&times;</button>
            </div>
            <p className="modal-subtitle">
              Informe a quantidade contada de cada peça. Apenas as peças com valor alterado serão registradas no histórico.
            </p>

            <div className="mfield">
              <label>
                Observação geral{' '}
                <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Contagem mensal — maio/2026"
                value={countNotes}
                onChange={e => setCountNotes(e.target.value)}
              />
            </div>

            <div className="tbl-wrap" style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Código Interno</th>
                    <th>Nome</th>
                    <th style={{ textAlign: 'center' }}>Qtd. Sistema</th>
                    <th style={{ textAlign: 'center' }}>Qtd. Contada</th>
                  </tr>
                </thead>
                <tbody>
                  {countParts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="tbl-empty">
                        Nenhuma peça com código interno cadastrada.
                      </td>
                    </tr>
                  ) : countParts.map(p => {
                    const currentQty = p.stock_quantity || 0;
                    const val        = countValues[p.id] ?? '';
                    const changed    = val !== '' && parseInt(String(val), 10) !== currentQty;
                    return (
                      <tr key={p.id}>
                        <td>
                          <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                            {p.codigo_interno}
                          </code>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.nome}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`qty-badge ${currentQty <= 0 ? 'qty-zero' : 'qty-ok'}`}>
                            {currentQty}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number" min="0" step="1" placeholder="—"
                            className={`count-input${changed ? ' changed' : ''}`}
                            value={val}
                            onChange={e => setCountValues(v => ({ ...v, [p.id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {countMsg && (
              <div className={`msg ${countMsg.type}`} style={{ marginBottom: 10 }}>
                {countMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                disabled={countSubmitting}
                onClick={submitCount}
              >{countSubmitting ? 'Salvando...' : 'Salvar contagem'}</button>
              <button className="btn btn-ghost" onClick={closeCountModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Modal: Movimentações por Data
      ═══════════════════════════════════════════════════════════════════ */}
      {movDateModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) closeMovDateModal(); }}
        >
          <div
            className="modal"
            style={{ width: 820, maxWidth: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4, paddingBottom: 12,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>
                Movimentações por Data
              </span>
              <button className="modal-close" onClick={closeMovDateModal}>&times;</button>
            </div>
            <p className="modal-subtitle">Comparação de entradas e saídas por data.</p>

            <div className="period-btns">
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  className={`btn btn-sm${movDateDays === d ? ' btn-primary' : ' btn-ghost'}`}
                  onClick={() => changeMovDatePeriod(d)}
                >
                  Últimos {d} dias
                </button>
              ))}
            </div>

            {movDateLoading && <div className="spend-empty">Carregando...</div>}

            {!movDateLoading && movDateData !== null && (() => {
              const chartInfo = buildMovDateChartData(movDateData);
              if (!chartInfo) {
                return (
                  <div className="spend-empty">
                    Nenhuma movimentação nos últimos {movDateDays} dias.
                  </div>
                );
              }
              return (
                <div className="chart-wrap">
                  <Bar
                    data={{
                      labels: chartInfo.labels,
                      datasets: [
                        {
                          label: 'Entradas',
                          data:  chartInfo.entradas,
                          backgroundColor: 'rgba(46,125,50,0.75)',
                          borderColor:     '#2e7d32',
                          borderWidth: 1,
                          borderRadius: 3,
                        },
                        {
                          label: 'Saídas',
                          data:  chartInfo.saidas,
                          backgroundColor: 'rgba(198,40,40,0.7)',
                          borderColor:     '#c62828',
                          borderWidth: 1,
                          borderRadius: 3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend:  { display: true, position: 'top' },
                        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} pç` } },
                      },
                      scales: {
                        x: { ticks: { font: { size: 11 } } },
                        y: { beginAtZero: true, ticks: { font: { size: 11 }, stepSize: 1 } },
                      },
                    }}
                    height={200}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
