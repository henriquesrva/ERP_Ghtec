import { useState, useEffect, useMemo } from 'react';
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
  listParts, getPart, createPart, updatePart, deletePart,
  getPriceHistoryByClient, getPriceComparison,
  getClientPriceRefs, upsertClientPriceRef,
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../api/parts';
import { listClients } from '../api/clients';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import useAuth      from '../hooks/useAuth';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ── Utilitários ────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  if (val === null || val === undefined) return '—';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(raw) {
  if (!raw) return null;
  const str = String(raw).trim().replace(/[R$\s]/g, '');
  if (!str) return null;
  const num = str.includes(',')
    ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
    : parseFloat(str);
  return isNaN(num) ? null : num;
}

// ── Defaults ───────────────────────────────────────────────────────────────────
const PART_DEFAULTS = {
  nome: '', category_id: '', identity_code: '',
  preco_compra: '', ncm: '', descricao: '', observacoes: '',
};
const CAT_DEFAULTS = { name: '', code: '' };

// ══════════════════════════════════════════════════════════════════════════════
export default function Parts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── Navegação ────────────────────────────────────────────────────────────────
  // 'home' | 'partsMenu' | 'partForm' | 'partList' | 'catsMenu' | 'catForm' | 'catList'
  const [view, setView] = useState('home');

  // ── Dados ────────────────────────────────────────────────────────────────────
  const [parts,      setParts]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients,    setClients]    = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [catsLoading,  setCatsLoading]  = useState(false);

  // ── Formulário de peça ───────────────────────────────────────────────────────
  const [editingPart,   setEditingPart]   = useState(null);
  const [partForm,      setPartForm]      = useState({ ...PART_DEFAULTS });
  const [partErrors,    setPartErrors]    = useState({});
  const [partMsg,       setPartMsg]       = useState(null);
  const [partSubmitting, setPartSubmitting] = useState(false);

  // ── Formulário de categoria ──────────────────────────────────────────────────
  const [editingCat,    setEditingCat]    = useState(null);
  const [catForm,       setCatForm]       = useState({ ...CAT_DEFAULTS });
  const [catErrors,     setCatErrors]     = useState({});
  const [catMsg,        setCatMsg]        = useState(null);
  const [catSubmitting, setCatSubmitting] = useState(false);

  // ── Filtros da lista ─────────────────────────────────────────────────────────
  const [partSearch,    setPartSearch]    = useState('');
  const [partCatFilter, setPartCatFilter] = useState('');

  // ── Histórico de preços (seção no form de edição) ────────────────────────────
  const [selectedClient, setSelectedClient] = useState('');
  const [priceHistory,   setPriceHistory]   = useState([]);
  const [phLoading,      setPhLoading]      = useState(false);

  // ── Modal: referências de preço por cliente ──────────────────────────────────
  const [priceRefModal,   setPriceRefModal]   = useState(false);
  const [priceRefPart,    setPriceRefPart]    = useState(null);
  const [priceRefs,       setPriceRefs]       = useState([]);
  const [priceRefsLoading, setPriceRefsLoading] = useState(false);
  const [refForm,         setRefForm]         = useState({ client_id: '', price: '', notes: '' });
  const [refMsg,          setRefMsg]          = useState(null);
  const [refSubmitting,   setRefSubmitting]   = useState(false);

  // ── Modal: comparação de preços ──────────────────────────────────────────────
  const [compareModal,   setCompareModal]   = useState(false);
  const [compareData,    setCompareData]    = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // ── Toast + ConfirmModal ─────────────────────────────────────────────────────
  const [toast,   setToast]   = useState({ message: '' });
  const [confirm, setConfirm] = useState(null);

  // ── Código interno gerado (reactivo) ────────────────────────────────────────
  const generatedCode = useMemo(() => {
    const cat = categories.find(c => String(c.id) === String(partForm.category_id));
    if (cat && partForm.identity_code.trim()) {
      return `${cat.code}-${partForm.identity_code.trim()}`;
    }
    return null;
  }, [categories, partForm.category_id, partForm.identity_code]);

  // ── Peças filtradas ──────────────────────────────────────────────────────────
  const filteredParts = useMemo(() => {
    let r = parts;
    if (partCatFilter) {
      r = r.filter(p => String(p.category_id) === partCatFilter);
    }
    if (partSearch.trim()) {
      const q = partSearch.toLowerCase();
      r = r.filter(p =>
        (p.nome           || '').toLowerCase().includes(q) ||
        (p.codigo_interno || '').toLowerCase().includes(q) ||
        (p.identity_code  || '').toLowerCase().includes(q) ||
        (p.category_name  || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [parts, partSearch, partCatFilter]);

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([listCategories(), listClients()])
      .then(([cats, cls]) => {
        setCategories(Array.isArray(cats) ? cats : []);
        setClients(Array.isArray(cls) ? cls : []);
      })
      .catch(() => {});
  }, []);

  // ── Carga ao mudar de view ───────────────────────────────────────────────────
  useEffect(() => {
    if (view === 'partList') loadParts();
    if (view === 'catList')  reloadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Funções de carga ─────────────────────────────────────────────────────────

  async function loadParts() {
    setPartsLoading(true);
    try {
      const data = await listParts();
      setParts(Array.isArray(data) ? data : []);
    } catch {
      setToast({ message: 'Erro ao carregar peças.', type: 'error' });
    } finally {
      setPartsLoading(false);
    }
  }

  async function reloadCategories() {
    setCatsLoading(true);
    try {
      const data = await listCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setToast({ message: 'Erro ao carregar categorias.', type: 'error' });
    } finally {
      setCatsLoading(false);
    }
  }

  // ── Peça: helpers de navegação ───────────────────────────────────────────────

  function startCreatePart() {
    setEditingPart(null);
    setPartForm({ ...PART_DEFAULTS });
    setPartErrors({});
    setPartMsg(null);
    setSelectedClient('');
    setPriceHistory([]);
    setView('partForm');
  }

  async function startEditPart(id) {
    try {
      const part = await getPart(id);
      setEditingPart(part);
      setPartForm({
        nome:          part.nome || '',
        category_id:   String(part.category_id ?? ''),
        identity_code: part.identity_code || '',
        preco_compra:  part.preco_compra != null
          ? Number(part.preco_compra).toLocaleString('pt-BR', {
              minimumFractionDigits: 2, maximumFractionDigits: 2,
            })
          : '',
        ncm:        part.ncm || '',
        descricao:  part.descricao || '',
        observacoes: part.observacoes || '',
      });
      setPartErrors({});
      setPartMsg(null);
      setSelectedClient('');
      setPriceHistory([]);
      setView('partForm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setToast({ message: 'Erro ao carregar peça.', type: 'error' });
    }
  }

  // ── Peça: submissão ──────────────────────────────────────────────────────────

  async function submitPartForm(e) {
    e.preventDefault();
    setPartMsg(null);

    const errors = {};
    if (!partForm.nome.trim())                errors.nome          = true;
    if (!partForm.category_id)                errors.category_id   = true;
    if (!partForm.identity_code.trim())       errors.identity_code = true;
    if (parseBRL(partForm.preco_compra) === null) errors.preco_compra = true;
    if (Object.keys(errors).length) {
      setPartErrors(errors);
      setPartMsg({
        type: 'error',
        text: 'Preencha os campos obrigatórios: Nome, Categoria, Código identitário e Preço de compra.',
      });
      return;
    }
    setPartErrors({});

    const payload = {
      nome:           partForm.nome.trim(),
      category_id:    Number(partForm.category_id),
      identity_code:  partForm.identity_code.trim(),
      codigo_interno: generatedCode,
      preco_compra:   parseBRL(partForm.preco_compra),
      ncm:            partForm.ncm.trim()         || null,
      descricao:      partForm.descricao.trim()   || null,
      observacoes:    partForm.observacoes.trim()  || null,
    };

    setPartSubmitting(true);
    try {
      if (editingPart) {
        const data = await updatePart(editingPart.id, payload);
        setEditingPart(data.part);
        setPartMsg({ type: 'success', text: 'Peça atualizada com sucesso.' });
      } else {
        const data = await createPart(payload);
        setEditingPart(data.part);
        setPartMsg({ type: 'success', text: 'Peça criada com sucesso.' });
      }
      loadParts();
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Erro ao salvar.';
      setPartMsg({ type: err?.status === 409 ? 'warn' : 'error', text: msg });
    } finally {
      setPartSubmitting(false);
    }
  }

  function confirmDeletePart(part) {
    setConfirm({
      title: 'Excluir peça',
      message: `Deseja excluir a peça <strong>${part.nome}</strong>? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deletePart(part.id);
          if (editingPart?.id === part.id) {
            setEditingPart(null);
            setPartForm({ ...PART_DEFAULTS });
          }
          await loadParts();
          setToast({ message: 'Peça excluída com sucesso.', type: 'success' });
        } catch (err) {
          setToast({ message: err?.data?.message || 'Erro ao excluir peça.', type: 'error' });
        }
      },
    });
  }

  // ── Histórico de preços ──────────────────────────────────────────────────────

  async function handleClientChange(clientId) {
    setSelectedClient(clientId);
    if (!clientId || !editingPart) { setPriceHistory([]); return; }
    setPhLoading(true);
    try {
      const data = await getPriceHistoryByClient(editingPart.id, clientId);
      setPriceHistory(Array.isArray(data) ? data : []);
    } catch {
      setPriceHistory([]);
    } finally {
      setPhLoading(false);
    }
  }

  // ── Modal: referências de preço ──────────────────────────────────────────────

  async function openPriceRefModal(id, nome) {
    setPriceRefPart({ id, nome });
    setPriceRefs([]);
    setRefForm({ client_id: '', price: '', notes: '' });
    setRefMsg(null);
    setPriceRefsLoading(true);
    setPriceRefModal(true);
    try {
      const data = await getClientPriceRefs(id);
      setPriceRefs(Array.isArray(data) ? data : []);
    } catch {
      setPriceRefs([]);
    } finally {
      setPriceRefsLoading(false);
    }
  }

  async function submitPriceRef() {
    if (!refForm.client_id) {
      setRefMsg({ type: 'error', text: 'Selecione um cliente.' });
      return;
    }
    const price = parseBRL(refForm.price);
    if (price === null || price < 0) {
      setRefMsg({ type: 'error', text: 'Preço de referência inválido.' });
      return;
    }
    setRefSubmitting(true);
    setRefMsg(null);
    try {
      await upsertClientPriceRef(priceRefPart.id, {
        client_id:       Number(refForm.client_id),
        reference_price: price,
        notes:           refForm.notes.trim() || null,
      });
      setRefMsg({ type: 'success', text: 'Referência salva com sucesso.' });
      setRefForm({ client_id: '', price: '', notes: '' });
      const updated = await getClientPriceRefs(priceRefPart.id);
      setPriceRefs(Array.isArray(updated) ? updated : []);
    } catch (err) {
      setRefMsg({ type: 'error', text: err?.data?.message || 'Erro ao salvar.' });
    } finally {
      setRefSubmitting(false);
    }
  }

  function editRefRow(ref) {
    setRefForm({
      client_id: String(ref.client_id),
      price:     Number(ref.reference_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      notes:     ref.notes || '',
    });
    setRefMsg(null);
  }

  // ── Modal: comparação de preços ──────────────────────────────────────────────

  async function openCompareModal(id) {
    setCompareData(null);
    setCompareLoading(true);
    setCompareModal(true);
    try {
      const data = await getPriceComparison(id);
      setCompareData(Array.isArray(data) ? data : []);
    } catch {
      setCompareData([]);
    } finally {
      setCompareLoading(false);
    }
  }

  function buildCompareChartData(rows) {
    if (!rows.length) return null;
    return {
      labels:     rows.map(r => r.cliente_nome),
      values:     rows.map(r => r.valor_unitario),
      dates:      rows.map(r => r.data_proposta),
      horizontal: rows.length > 5,
    };
  }

  // ── Categoria: helpers ───────────────────────────────────────────────────────

  function startCreateCat() {
    setEditingCat(null);
    setCatForm({ ...CAT_DEFAULTS });
    setCatErrors({});
    setCatMsg(null);
    setView('catForm');
  }

  function startEditCat(cat) {
    setEditingCat(cat);
    setCatForm({ name: cat.name, code: cat.code });
    setCatErrors({});
    setCatMsg(null);
    setView('catForm');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitCatForm(e) {
    e.preventDefault();
    setCatMsg(null);
    const errors = {};
    if (!catForm.name.trim()) errors.name = true;
    if (!catForm.code.trim()) errors.code = true;
    if (Object.keys(errors).length) {
      setCatErrors(errors);
      setCatMsg({ type: 'error', text: 'Nome e código são obrigatórios.' });
      return;
    }
    setCatErrors({});
    setCatSubmitting(true);
    try {
      if (editingCat) {
        const data = await updateCategory(editingCat.id, catForm);
        setEditingCat(data.category);
        setCatMsg({ type: 'success', text: 'Categoria atualizada.' });
      } else {
        const data = await createCategory(catForm);
        setEditingCat(data.category);
        setCatMsg({ type: 'success', text: 'Categoria criada com sucesso.' });
      }
      const cats = await listCategories();
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Erro ao salvar.';
      setCatMsg({ type: err?.status === 409 ? 'warn' : 'error', text: msg });
    } finally {
      setCatSubmitting(false);
    }
  }

  function confirmDeleteCat(cat) {
    setConfirm({
      title: 'Excluir categoria',
      message: `Deseja excluir a categoria <strong>${cat.name} (${cat.code})</strong>? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deleteCategory(cat.id);
          if (editingCat?.id === cat.id) {
            setEditingCat(null);
            setCatForm({ ...CAT_DEFAULTS });
          }
          const cats = await listCategories();
          setCategories(Array.isArray(cats) ? cats : []);
          setToast({ message: 'Categoria excluída.', type: 'success' });
        } catch (err) {
          setToast({ message: err?.data?.message || 'Erro ao excluir categoria.', type: 'error' });
        }
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '' })} />

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Excluir"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="page-bar">
        <div>
          <h1>Peças</h1>
          <div>Cadastro de peças e categorias</div>
        </div>
      </div>

      <div className="container">

        {/* ══ HOME ══════════════════════════════════════════════════════ */}
        {view === 'home' && (
          <div className="home-grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 580 }}>
            <div className="home-card" onClick={() => setView('partsMenu')}>
              <div className="home-card-icon">⚙</div>
              <div className="home-card-label">Lista de Peças</div>
              <div className="home-card-desc">Cadastro e edição do catálogo de peças</div>
            </div>
            <div className="home-card" onClick={() => setView('catsMenu')}>
              <div className="home-card-icon">☰</div>
              <div className="home-card-label">Categorias</div>
              <div className="home-card-desc">Gerenciar categorias e seus códigos</div>
            </div>
          </div>
        )}

        {/* ══ MENU PEÇAS ════════════════════════════════════════════════ */}
        {view === 'partsMenu' && (
          <div>
            <div className="view-topbar">
              <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
              <span className="view-topbar-title">Lista de Peças</span>
            </div>
            <div className="home-grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 580 }}>
              <div className="home-card" onClick={startCreatePart}>
                <div className="home-card-icon">+</div>
                <div className="home-card-label">Cadastrar nova peça</div>
                <div className="home-card-desc">Preencher formulário e criar peça no catálogo</div>
              </div>
              <div className="home-card" onClick={() => setView('partList')}>
                <div className="home-card-icon">📋</div>
                <div className="home-card-label">Ver peças cadastradas</div>
                <div className="home-card-desc">Visualizar, editar e buscar peças existentes</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ FORMULÁRIO DE PEÇA ════════════════════════════════════════ */}
        {view === 'partForm' && (
          <div>
            <div className="view-topbar">
              <button className="btn-back" onClick={() => setView('partsMenu')}>← Voltar</button>
              <span className="view-topbar-title">
                {editingPart ? `Editando: ${editingPart.nome}` : 'Nova Peça'}
              </span>
              {editingPart && <span className="edit-badge">Editando</span>}
            </div>

            <div className="card" style={{ maxWidth: 760 }}>
              <form onSubmit={submitPartForm} noValidate>

                {/* Nome */}
                <div className="grid-2">
                  <div className="field col-span-2">
                    <label>Nome técnico da peça *</label>
                    <input
                      type="text"
                      placeholder="Ex: Filtro de 3 micras"
                      value={partForm.nome}
                      onChange={e => setPartForm(f => ({ ...f, nome: e.target.value }))}
                      className={partErrors.nome ? 'error' : ''}
                    />
                  </div>
                </div>

                {/* Categoria + Código identitário */}
                <div className="grid-2">
                  <div className="field">
                    <label>Categoria *</label>
                    <select
                      value={partForm.category_id}
                      onChange={e => setPartForm(f => ({ ...f, category_id: e.target.value }))}
                      className={partErrors.category_id ? 'error' : ''}
                    >
                      <option value="">— Selecione —</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}  ({c.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Código identitário *</label>
                    <input
                      type="text"
                      placeholder="Ex: 1, 12, A3"
                      autoComplete="off"
                      value={partForm.identity_code}
                      onChange={e => setPartForm(f => ({ ...f, identity_code: e.target.value }))}
                      className={partErrors.identity_code ? 'error' : ''}
                    />
                    <span className="field-note">Número ou ID da peça dentro da categoria</span>
                  </div>
                </div>

                {/* Código interno (display only) */}
                <div className="grid-2">
                  <div className="field col-span-2">
                    <label>
                      Código interno{' '}
                      <span style={{ textTransform: 'none', fontWeight: 400, fontSize: 10 }}>
                        (gerado automaticamente)
                      </span>
                    </label>
                    <div className={`internal-code-display${generatedCode ? '' : ' empty'}`}>
                      {generatedCode || '— selecione a categoria e preencha o código identitário —'}
                    </div>
                  </div>
                </div>

                {/* Preço + NCM */}
                <div className="grid-2">
                  <div className="field">
                    <label>Preço de Compra (R$) *</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      inputMode="decimal"
                      value={partForm.preco_compra}
                      onChange={e => setPartForm(f => ({ ...f, preco_compra: e.target.value }))}
                      className={partErrors.preco_compra ? 'error' : ''}
                    />
                  </div>
                  <div className="field">
                    <label>NCM</label>
                    <input
                      type="text"
                      placeholder="0000.00.00"
                      value={partForm.ncm}
                      onChange={e => setPartForm(f => ({ ...f, ncm: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Descrição */}
                <div className="grid-2">
                  <div className="field col-span-2">
                    <label>Descrição</label>
                    <textarea
                      placeholder="Descrição técnica, características, aplicação..."
                      value={partForm.descricao}
                      onChange={e => setPartForm(f => ({ ...f, descricao: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Observações */}
                <div className="grid-2">
                  <div className="field col-span-2">
                    <label>Observações</label>
                    <textarea
                      placeholder="Observações internas"
                      value={partForm.observacoes}
                      onChange={e => setPartForm(f => ({ ...f, observacoes: e.target.value }))}
                    />
                  </div>
                </div>

                {partMsg && (
                  <div className={`msg ${partMsg.type}`} style={{ marginBottom: 10 }}>
                    {partMsg.text}
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={partSubmitting}>
                    {partSubmitting
                      ? 'Salvando...'
                      : editingPart ? 'Salvar alterações' : 'Criar peça'}
                  </button>
                  {editingPart && (
                    <button type="button" className="btn btn-ghost" onClick={startCreatePart}>
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              {/* ── Histórico de preços (somente ao editar) ── */}
              {editingPart && (
                <div className="ph-card">
                  <div className="ph-title">Histórico de preços por cliente</div>
                  <div className="ph-client-row">
                    <label>Cliente:</label>
                    <select
                      value={selectedClient}
                      onChange={e => handleClientChange(e.target.value)}
                    >
                      <option value="">— Selecione um cliente —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-compare"
                      onClick={() => openCompareModal(editingPart.id)}
                    >▶ Comparar preços</button>
                  </div>

                  {phLoading && <div className="ph-hint">Carregando...</div>}

                  {!phLoading && !selectedClient && (
                    <div className="ph-hint">
                      Selecione um cliente para visualizar o histórico de preços desta peça.
                    </div>
                  )}

                  {!phLoading && selectedClient && priceHistory.length === 0 && (
                    <div className="ph-empty">
                      Nenhum histórico registrado para esta peça com este cliente.
                    </div>
                  )}

                  {!phLoading && priceHistory.length > 0 && (
                    <table className="ph-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Qtd</th>
                          <th>Valor unit.</th>
                          <th>Proposta</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceHistory.map((r, i) => (
                          <tr key={i}>
                            <td>{r.cliente_nome}</td>
                            <td style={{ textAlign: 'center' }}>{r.quantidade}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {fmtBRL(r.valor_unitario)}
                            </td>
                            <td style={{ color: 'var(--color-muted)' }}>{r.numero_proposta}</td>
                            <td style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                              {r.data_proposta}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ LISTA DE PEÇAS ════════════════════════════════════════════ */}
        {view === 'partList' && (
          <div>
            <div className="view-topbar">
              <button className="btn-back" onClick={() => setView('partsMenu')}>← Voltar</button>
              <span className="view-topbar-title">Peças cadastradas</span>
              <button className="btn btn-primary btn-sm" onClick={startCreatePart}>
                + Nova peça
              </button>
            </div>
            <div className="card">
              {/* Filtros */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={partCatFilter}
                  onChange={e => setPartCatFilter(e.target.value)}
                  style={{
                    padding: '8px 10px', border: '1px solid #ccc',
                    borderRadius: 'var(--radius)', fontSize: 13,
                    fontFamily: 'inherit', background: '#fff',
                    flexShrink: 0, minWidth: 180, color: 'var(--color-text)',
                  }}
                >
                  <option value="">Todas as categorias</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}  ({c.code})</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Buscar por nome, código..."
                  value={partSearch}
                  onChange={e => setPartSearch(e.target.value)}
                  autoComplete="off"
                  style={{
                    flex: 1, minWidth: 160, padding: '8px 12px',
                    border: '1px solid #ccc', borderRadius: 'var(--radius)',
                    fontSize: 13, fontFamily: 'inherit',
                  }}
                />
              </div>

              {partsLoading && <div className="empty-list">Carregando...</div>}

              {!partsLoading && (
                <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                  {filteredParts.length === 0 ? (
                    <div className="empty-list">Nenhuma peça encontrada.</div>
                  ) : filteredParts.map(p => (
                    <div
                      key={p.id}
                      className={`part-item${editingPart?.id === p.id ? ' selected' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                      onClick={() => startEditPart(p.id)}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="pi-name">
                          {p.nome}
                          {p.codigo_interno && (
                            <span className="pi-code">{p.codigo_interno}</span>
                          )}
                        </div>
                        {(p.category_name || p.categoria) && (
                          <div className="pi-sub">{p.category_name || p.categoria}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                          title="Ver referências de preço por cliente"
                          onClick={e => { e.stopPropagation(); openPriceRefModal(p.id, p.nome); }}
                        >Preços</button>
                        <button
                          className="btn btn-danger-outline btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                          title="Excluir peça"
                          onClick={e => { e.stopPropagation(); confirmDeletePart(p); }}
                        >&times;</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ MENU CATEGORIAS ══════════════════════════════════════════ */}
        {view === 'catsMenu' && (
          <div>
            <div className="view-topbar">
              <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
              <span className="view-topbar-title">Categorias</span>
            </div>
            <div className="home-grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 580 }}>
              <div className="home-card" onClick={startCreateCat}>
                <div className="home-card-icon">+</div>
                <div className="home-card-label">Cadastrar nova categoria</div>
                <div className="home-card-desc">Criar categoria com nome e código</div>
              </div>
              <div className="home-card" onClick={() => setView('catList')}>
                <div className="home-card-icon">📋</div>
                <div className="home-card-label">Ver categorias cadastradas</div>
                <div className="home-card-desc">Visualizar, editar e excluir categorias</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ FORMULÁRIO DE CATEGORIA ══════════════════════════════════ */}
        {view === 'catForm' && (
          <div>
            <div className="view-topbar">
              <button className="btn-back" onClick={() => setView('catsMenu')}>← Voltar</button>
              <span className="view-topbar-title">
                {editingCat ? `Editando: ${editingCat.name}` : 'Nova Categoria'}
              </span>
              {editingCat && <span className="edit-badge">Editando</span>}
            </div>
            <div className="card" style={{ maxWidth: 520 }}>
              <form onSubmit={submitCatForm} noValidate>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Nome da categoria *</label>
                  <input
                    type="text"
                    placeholder="Ex: Filtro, Resistência, Válvula"
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    className={catErrors.name ? 'error' : ''}
                  />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Código da categoria *</label>
                  <input
                    type="text"
                    placeholder="Ex: F, R, V"
                    maxLength={10}
                    autoComplete="off"
                    style={{ textTransform: 'uppercase' }}
                    value={catForm.code}
                    onChange={e => setCatForm(f => ({
                      ...f, code: e.target.value.toUpperCase().replace(/\s/g, ''),
                    }))}
                    className={catErrors.code ? 'error' : ''}
                  />
                  <span className="field-note">
                    Código único, sem espaços, em maiúsculo.{' '}
                    Exemplo: código <strong>F</strong> + identitário <strong>1</strong> = código interno <strong>F-1</strong>
                  </span>
                </div>

                {catMsg && (
                  <div className={`msg ${catMsg.type}`} style={{ marginBottom: 10 }}>
                    {catMsg.text}
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={catSubmitting}>
                    {catSubmitting
                      ? 'Salvando...'
                      : editingCat ? 'Salvar alterações' : 'Criar categoria'}
                  </button>
                  {editingCat && (
                    <button type="button" className="btn btn-ghost" onClick={startCreateCat}>
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ LISTA DE CATEGORIAS ══════════════════════════════════════ */}
        {view === 'catList' && (
          <div>
            <div className="view-topbar">
              <button className="btn-back" onClick={() => setView('catsMenu')}>← Voltar</button>
              <span className="view-topbar-title">Categorias cadastradas</span>
              <button className="btn btn-primary btn-sm" onClick={startCreateCat}>
                + Nova categoria
              </button>
            </div>
            <div className="card">
              {catsLoading && <div className="empty-list">Carregando...</div>}
              {!catsLoading && (
                <div className="cat-list">
                  {categories.length === 0 ? (
                    <div className="empty-list">Nenhuma categoria cadastrada.</div>
                  ) : categories.map(c => (
                    <div
                      key={c.id}
                      className={`cat-item${editingCat?.id === c.id ? ' selected' : ''}`}
                      onClick={() => startEditCat(c)}
                    >
                      <div>
                        <span className="cat-name">{c.name}</span>
                        <span className="cat-code">{c.code}</span>
                      </div>
                      <button
                        className="cat-del"
                        title="Excluir"
                        onClick={e => { e.stopPropagation(); confirmDeleteCat(c); }}
                      >&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>{/* /container */}

      {/* ═══════════════════════════════════════════════════════════════════
          Modal: Referências de Preço por Cliente
      ═══════════════════════════════════════════════════════════════════ */}
      {priceRefModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) setPriceRefModal(false); }}
        >
          <div
            className="modal"
            style={{ maxWidth: 800, width: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4, paddingBottom: 12,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>
                Referências de preço por cliente
              </span>
              <button className="modal-close" onClick={() => setPriceRefModal(false)}>&times;</button>
            </div>
            <p className="modal-subtitle" style={{ marginBottom: 16 }}>
              Peça: {priceRefPart?.nome}
            </p>

            {priceRefsLoading && <div className="compare-empty">Carregando...</div>}

            {!priceRefsLoading && priceRefs.length === 0 && (
              <div className="compare-empty">Nenhuma referência de preço cadastrada para esta peça.</div>
            )}

            {!priceRefsLoading && priceRefs.length > 0 && (
              <table className="ph-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>CNPJ</th>
                    <th style={{ textAlign: 'right' }}>Preço de referência</th>
                    <th>Origem</th>
                    <th>Atualizado em</th>
                    {isAdmin && <th style={{ width: 80 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {priceRefs.map(r => (
                    <tr key={r.client_id}>
                      <td style={{ fontWeight: 600 }}>{r.client_nome}</td>
                      <td style={{ color: 'var(--color-muted)', fontSize: 12 }}>{r.cnpj || '—'}</td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}>
                        {fmtBRL(r.reference_price)}
                      </td>
                      <td>
                        {r.source === 'manual'
                          ? <span className="tag tag-info">Manual</span>
                          : <span className="tag tag-muted">Última proposta</span>}
                      </td>
                      <td style={{ color: 'var(--color-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {r.updated_at || '—'}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '3px 9px' }}
                            onClick={() => editRefRow(r)}
                          >Editar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Seção admin: adicionar / editar referência */}
            {isAdmin && (
              <div className="ref-admin-section">
                <div className="ref-admin-title">Adicionar / editar referência manual</div>
                <div className="ref-form-row">
                  <div className="field" style={{ flex: 2, minWidth: 200 }}>
                    <label>Cliente *</label>
                    <select
                      value={refForm.client_id}
                      onChange={e => setRefForm(f => ({ ...f, client_id: e.target.value }))}
                    >
                      <option value="">— Selecione —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 140 }}>
                    <label>Preço de referência (R$) *</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      autoComplete="off"
                      value={refForm.price}
                      onChange={e => setRefForm(f => ({ ...f, price: e.target.value }))}
                    />
                  </div>
                  <div className="field" style={{ flex: 2, minWidth: 180 }}>
                    <label>Observações</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={refForm.notes}
                      onChange={e => setRefForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <div style={{ flexShrink: 0, paddingBottom: 2 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={refSubmitting}
                      onClick={submitPriceRef}
                    >{refSubmitting ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </div>
                {refMsg && (
                  <div className={`msg ${refMsg.type}`} style={{ marginTop: 8 }}>
                    {refMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Modal: Comparação de Preços por Cliente
      ═══════════════════════════════════════════════════════════════════ */}
      {compareModal && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) setCompareModal(false); }}
        >
          <div
            className="modal"
            style={{ maxWidth: 680, width: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4, paddingBottom: 12,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>
                Comparação de preços por cliente
              </span>
              <button className="modal-close" onClick={() => setCompareModal(false)}>&times;</button>
            </div>

            {compareLoading && <div className="compare-empty">Carregando...</div>}

            {!compareLoading && compareData !== null && (() => {
              if (!compareData.length) {
                return <div className="compare-empty">Nenhuma venda registrada para esta peça.</div>;
              }
              const chart = buildCompareChartData(compareData);
              if (!chart) return null;
              return (
                <>
                  <p className="modal-subtitle" style={{ marginBottom: 12 }}>
                    Último preço cobrado por cliente — {compareData.length} cliente(s)
                  </p>
                  <div className="chart-wrap">
                    <Bar
                      data={{
                        labels: chart.labels,
                        datasets: [{
                          label: 'Último preço (R$)',
                          data:  chart.values,
                          backgroundColor: 'rgba(46,125,50,0.7)',
                          borderColor:     '#2e7d32',
                          borderWidth: 1,
                          borderRadius: 4,
                        }],
                      }}
                      options={{
                        indexAxis: chart.horizontal ? 'y' : 'x',
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: ctx => [
                                `Preço: ${fmtBRL(chart.values[ctx.dataIndex])}`,
                                `Ref: ${chart.dates[ctx.dataIndex]}`,
                              ],
                            },
                          },
                        },
                        scales: {
                          x: { ticks: { font: { size: 11 } } },
                          y: { ticks: { font: { size: 11 } }, beginAtZero: true },
                        },
                      }}
                      height={300}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
