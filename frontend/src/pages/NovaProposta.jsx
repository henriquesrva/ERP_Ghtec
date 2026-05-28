import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Toast from '../components/shared/Toast';
import { listClients, getClient }      from '../api/clients';
import { listObjetos, getObjeto }      from '../api/objetos';
import { listConditions, getCondition, createCondition } from '../api/conditions';
import { listParts }                   from '../api/parts';
import { createProposal, getLastItemPrice } from '../api/proposals';
import './NovaProposta.css';

// ─── Utilities ────────────────────────────────────────────────────────────
function parseNumber(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[^\d,\.]/g, '');
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  return parseFloat(normalized) || 0;
}

function formatBRL(value) {
  const n = typeof value === 'string' ? parseNumber(value) : Number(value);
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

let _itemIdCounter = 0;
function newItem() {
  return {
    id: ++_itemIdCounter,
    quantidade: '1',
    descricao: '',
    partId: null,
    partNome: '',
    valorUnitario: '',
    ncm: '',
    priceHint: null,
  };
}

function hasMeaningfulContent(draft) {
  if (!draft) return false;
  if (draft.clientId)    return true;
  if (draft.objetoId)    return true;
  if (draft.conditionId) return true;
  if (draft.numeroProposta) return true;
  if (draft.items && draft.items.some(it => it.partId || it.descricao)) return true;
  return false;
}

// ─── EntityPickerModal ────────────────────────────────────────────────────
function EntityPickerModal({ title, fetchFn, filterFn, renderItem, onSelect, onClose, searchPlaceholder }) {
  const [allItems, setAllItems] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchFn()
      .then(data => { setAllItems(Array.isArray(data) ? data : []); setLoadState('ok'); })
      .catch(() => setLoadState('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(item => filterFn(item, q));
  }, [allItems, query, filterFn]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-search-wrap">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder || 'Buscar...'}
            autoFocus
            autoComplete="off"
          />
        </div>
        <div className="modal-list">
          {loadState === 'loading' && <div className="modal-empty">Carregando...</div>}
          {loadState === 'error'   && <div className="modal-empty">Erro ao carregar. Tente novamente.</div>}
          {loadState === 'ok' && filtered.length === 0 && <div className="modal-empty">Nenhum resultado encontrado.</div>}
          {loadState === 'ok' && filtered.map((item, i) => (
            <div key={i} className="modal-item" onClick={() => { onClose(); onSelect(item); }}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildPreviewRows(rows) {
  if (!rows || !rows.length) return null;
  return (
    <div className="entity-preview">
      {rows.map(([l, v], i) => (
        <span key={`r${i}`} style={{ display: 'contents' }}>
          <span className="ep-label">{l}</span>
          <span className="ep-value">{v}</span>
        </span>
      ))}
    </div>
  );
}

function buildPreviewBlock(text) {
  if (!text) return null;
  return <div className="entity-preview"><span className="ep-block">{text}</span></div>;
}

// ─── ItemRow ───────────────────────────────────────────────────────────────
function ItemRow({ item, index, clientId, onChange, onRemove, onPickPart }) {
  function handleQtyChange(e) {
    onChange(item.id, { quantidade: e.target.value });
  }
  function handlePriceChange(e) {
    onChange(item.id, { valorUnitario: e.target.value });
  }
  function handleClearPart() {
    onChange(item.id, { partId: null, partNome: '', descricao: '', ncm: '', priceHint: null });
  }

  const qty   = parseFloat(item.quantidade) || 0;
  const price = parseNumber(item.valorUnitario);
  const rowTotal = (qty > 0 && price > 0) ? formatBRL(qty * price) : '—';

  return (
    <tr>
      <td className="col-num">{String(index + 1).padStart(2, '0')}</td>
      <td className="col-qty">
        <input
          type="number" min="1" step="1"
          value={item.quantidade}
          onChange={handleQtyChange}
        />
      </td>
      <td className="col-desc">
        <div className="np-desc-cell">
          {item.partId ? (
            <>
              <span className="np-part-display" title={item.partNome}>{item.partNome}</span>
              <button type="button" className="btn-trocar-peca" onClick={handleClearPart}>Trocar</button>
            </>
          ) : (
            <button
              type="button"
              className="btn-procurar"
              style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
              onClick={() => onPickPart(item.id)}
            >
              Procurar peça
            </button>
          )}
        </div>
      </td>
      <td className="col-price">
        <input
          type="text"
          placeholder="0,00"
          value={item.valorUnitario}
          onChange={handlePriceChange}
        />
        {item.priceHint && (
          <div
            className="price-hint"
            onClick={() => onChange(item.id, { valorUnitario: item.priceHint.rawValue })}
          >
            {item.priceHint.label}
          </div>
        )}
      </td>
      <td className="col-total">{rowTotal}</td>
      <td className="col-ncm">
        <input type="text" value={item.ncm} readOnly placeholder="—" />
      </td>
      <td className="col-del">
        <button type="button" className="btn-del-row" title="Remover item" onClick={() => onRemove(item.id)}>
          ×
        </button>
      </td>
    </tr>
  );
}

// ─── NovaProposta ──────────────────────────────────────────────────────────
export default function NovaProposta() {
  const { user } = useAuth();

  // Form
  const [numeroProposta, setNumeroProposta] = useState('');
  const [observacoes,    setObservacoes]    = useState('');
  const obsRef = useRef(null);

  // Client
  const [clientId,   setClientId]   = useState(null);
  const [clientData, setClientData] = useState(null);

  // Objeto
  const [objetoId,   setObjetoId]   = useState(null);
  const [objetoData, setObjetoData] = useState(null);

  // Items
  const [items, setItems] = useState([newItem()]);

  // Conditions
  const [condMode,     setCondModeState] = useState(null); // 'catalog' | 'new' | 'manual' | null
  const [conditionId,   setConditionId]   = useState(null);
  const [conditionData, setConditionData] = useState(null);
  const [condManual, setCondManual] = useState({
    forma_pagamento: '', prazo_pagamento: '', prazo_entrega: '', garantia: '', validade: ''
  });
  const [condNew, setCondNew] = useState({
    name: '', forma_pagamento: '', prazo_pagamento: '', prazo_entrega: '', garantia: '', validade: ''
  });
  const [condNewLoading, setCondNewLoading] = useState(false);
  const [condNewError,   setCondNewError]   = useState('');

  // User/signature
  const userState = !user ? 'loading'
    : (user.signature_cargo || user.signature_telefone) ? 'loaded'
    : 'nosig';

  // UI
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState(null); // { type, html }
  const [modal,       setModal]       = useState(null); // various modal types
  const [draftModal,  setDraftModal]  = useState(false);
  const [toast,       setToast]       = useState({ message: '', type: 'success' });
  const [partPickTarget, setPartPickTarget] = useState(null); // item id

  const showToast = useCallback((msg, type = 'error') => setToast({ message: msg, type }), []);

  // Draft
  const draftKey = user ? `draft_new_proposal_user_${user.id}` : null;
  const draftRestoringRef = useRef(false);
  const draftTimerRef     = useRef(null);

  // Ref sempre atualizado com o estado mais recente (evita stale closure no timer)
  const latestStateRef = useRef({});
  latestStateRef.current = {
    numeroProposta, observacoes, clientId, clientData,
    objetoId, objetoData, condMode, conditionId, conditionData, condManual, items,
  };

  // ── On user load: check draft ──────────────────────────────────────────
  useEffect(() => {
    if (!draftKey) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (hasMeaningfulContent(draft)) setDraftModal(true);
      else localStorage.removeItem(draftKey);
    } catch { localStorage.removeItem(draftKey); }
  }, [draftKey]);

  // ── Auto-save (debounced) ──────────────────────────────────────────────
  function scheduleSave() {
    if (draftRestoringRef.current || !draftKey) return;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const s = latestStateRef.current;
      const draft = {
        numeroProposta: s.numeroProposta,
        observacoes:    s.observacoes,
        clientId:       s.clientId,
        clientData:     s.clientData,
        objetoId:       s.objetoId,
        objetoData:     s.objetoData,
        condMode:       s.condMode,
        conditionId:    s.conditionId,
        conditionData:  s.conditionData,
        condManual:     s.condManual,
        items: (s.items || []).map(it => ({
          quantidade: it.quantidade, descricao: it.descricao,
          partId: it.partId, partNome: it.partNome,
          valorUnitario: it.valorUnitario, ncm: it.ncm,
        })),
        savedAt: Date.now(),
      };
      if (hasMeaningfulContent(draft)) {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      }
    }, 800);
  }

  function collectDraft() {
    const s = latestStateRef.current;
    return {
      numeroProposta: s.numeroProposta,
      observacoes:    s.observacoes,
      clientId:       s.clientId,
      clientData:     s.clientData,
      objetoId:       s.objetoId,
      objetoData:     s.objetoData,
      condMode:       s.condMode,
      conditionId:    s.conditionId,
      conditionData:  s.conditionData,
      condManual:     s.condManual,
      items: (s.items || []).map(it => ({
        quantidade: it.quantidade, descricao: it.descricao,
        partId: it.partId, partNome: it.partNome,
        valorUnitario: it.valorUnitario, ncm: it.ncm,
      })),
      savedAt: Date.now(),
    };
  }

  function clearDraft() {
    if (draftKey) localStorage.removeItem(draftKey);
  }

  // ── Draft: watch state changes ────────────────────────────────────────
  useEffect(() => {
    scheduleSave();
  }, [numeroProposta, observacoes, clientId, objetoId, condMode, conditionId, condManual, condNew, items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft: restore ────────────────────────────────────────────────────
  async function restoreDraft() {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    let draft;
    try { draft = JSON.parse(raw); } catch { clearDraft(); return; }

    draftRestoringRef.current = true;
    const warnings = [];

    if (draft.numeroProposta) setNumeroProposta(draft.numeroProposta);
    if (draft.observacoes)    setObservacoes(draft.observacoes);

    if (draft.clientId) {
      try {
        const c = await getClient(draft.clientId);
        doSelectClient(c);
      } catch { warnings.push('Cliente do rascunho não existe mais — campo limpo.'); }
    }

    if (draft.objetoId) {
      try {
        const o = await getObjeto(draft.objetoId);
        doSelectObjeto(o);
      } catch { warnings.push('Objeto do rascunho não existe mais — campo limpo.'); }
    }

    if (draft.condMode === 'catalog' && draft.conditionId) {
      try {
        const c = await getCondition(draft.conditionId);
        setCondModeState('catalog');
        doSelectCondition(c);
      } catch { warnings.push('Condição do rascunho não existe mais — campo limpo.'); setCondModeState('catalog'); }
    } else if (draft.condMode === 'manual') {
      setCondModeState('manual');
      if (draft.condManual) setCondManual(draft.condManual);
    } else if (draft.condMode) {
      setCondModeState(draft.condMode);
    }

    if (draft.items && draft.items.length) {
      const restored = draft.items
        .filter(it => it.partId || it.descricao)
        .map(it => ({
          id: ++_itemIdCounter,
          quantidade:    it.quantidade || '1',
          descricao:     it.descricao  || '',
          partId:        it.partId     || null,
          partNome:      it.partNome   || '',
          valorUnitario: it.valorUnitario || '',
          ncm:           it.ncm        || '',
          priceHint:     null,
        }));
      if (restored.length) setItems(restored);
    }

    draftRestoringRef.current = false;

    if (warnings.length) {
      setResult({ type: 'warn', html: 'Rascunho restaurado com avisos:<br>• ' + warnings.join('<br>• ') });
    }
  }

  // ── Client ─────────────────────────────────────────────────────────────
  function doSelectClient(c) {
    setClientId(c.id);
    setClientData(c);
  }
  function clearClient() {
    setClientId(null); setClientData(null);
  }

  // ── Objeto ─────────────────────────────────────────────────────────────
  function doSelectObjeto(o) {
    setObjetoId(o.id);
    setObjetoData(o);
  }
  function clearObjeto() {
    setObjetoId(null); setObjetoData(null);
  }

  // ── Condition ──────────────────────────────────────────────────────────
  function doSelectCondition(c) {
    setConditionId(c.id);
    setConditionData(c);
  }
  function clearCondition() {
    setConditionId(null); setConditionData(null);
  }
  function setCondMode(mode) {
    setCondModeState(mode);
    if (mode !== 'catalog') { setConditionId(null); setConditionData(null); }
  }

  // ── Create new condition inline ────────────────────────────────────────
  async function handleCreateCondition() {
    const { name, forma_pagamento, prazo_pagamento, prazo_entrega, validade, garantia } = condNew;
    if (!name.trim())            { setCondNewError('Nome da condição é obrigatório.');    return; }
    if (!forma_pagamento.trim()) { setCondNewError('Forma de pagamento é obrigatória.');  return; }
    if (!prazo_pagamento.trim()) { setCondNewError('Prazo de pagamento é obrigatório.'); return; }
    if (!prazo_entrega.trim())   { setCondNewError('Prazo de entrega é obrigatório.');   return; }
    if (!validade.trim())        { setCondNewError('Validade é obrigatória.');            return; }
    setCondNewError('');
    setCondNewLoading(true);
    try {
      const created = await createCondition({
        name: name.trim(),
        forma_pagamento: forma_pagamento.trim(),
        prazo_pagamento: prazo_pagamento.trim(),
        prazo_entrega:   prazo_entrega.trim(),
        validade:        validade.trim(),
        garantia:        garantia.trim() || null,
      });
      const full = await getCondition(created.id || created.condition?.id || created.data?.id);
      setCondNew({ name: '', forma_pagamento: '', prazo_pagamento: '', prazo_entrega: '', garantia: '', validade: '' });
      setCondModeState('catalog');
      doSelectCondition(full);
    } catch (err) {
      setCondNewError(err.message || 'Erro ao criar condição.');
    } finally {
      setCondNewLoading(false);
    }
  }

  // ── Items ──────────────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, newItem()]);
  }

  function updateItem(id, patch) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
  }

  async function handlePickPart(itemId, part) {
    const valorFormatado = Number(part.valor_venda || 0) > 0
      ? Number(part.valor_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : '';

    updateItem(itemId, {
      partId:   part.id,
      partNome: part.nome,
      descricao: part.nome,
      ncm:      part.ncm || '',
    });

    // Fetch price hint after picking part
    if (clientId) {
      try {
        const data = await getLastItemPrice({ clientId, descricao: part.nome, partId: part.id });
        if (data && data.valor_unitario != null) {
          const rawValue = Number(data.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const formatted = formatBRL(data.valor_unitario);
          const label = data.numero_proposta
            ? `Último preço nesta proposta (Nº ${data.numero_proposta}): ${formatted} — clique para aplicar`
            : `Referência de preço para este cliente: ${formatted} — clique para aplicar`;

          setItems(prev => prev.map(it => {
            if (it.id !== itemId) return it;
            const updated = { ...it, priceHint: { rawValue, label } };
            if (!parseNumber(it.valorUnitario)) updated.valorUnitario = rawValue;
            return updated;
          }));
        }
      } catch { /* price hint is optional */ }
    }
  }

  // Re-fetch hints when client changes
  useEffect(() => {
    if (!clientId) {
      setItems(prev => prev.map(it => ({ ...it, priceHint: null })));
      return;
    }
    items.forEach(async it => {
      if (!it.partId || !it.descricao) return;
      try {
        const data = await getLastItemPrice({ clientId, descricao: it.descricao, partId: it.partId });
        if (data && data.valor_unitario != null) {
          const rawValue = Number(data.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const formatted = formatBRL(data.valor_unitario);
          const label = data.numero_proposta
            ? `Último preço nesta proposta (Nº ${data.numero_proposta}): ${formatted} — clique para aplicar`
            : `Referência de preço para este cliente: ${formatted} — clique para aplicar`;
          setItems(prev => prev.map(i => i.id === it.id ? { ...i, priceHint: { rawValue, label } } : i));
        }
      } catch { /* ignore */ }
    });
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Total ──────────────────────────────────────────────────────────────
  const total = useMemo(() => {
    return items.reduce((acc, it) => acc + (parseFloat(it.quantidade) || 0) * parseNumber(it.valorUnitario), 0);
  }, [items]);

  // ── Payload ────────────────────────────────────────────────────────────
  function buildCondPayload() {
    if (condMode === 'catalog' && conditionData) {
      return {
        condicoes: {
          forma_pagamento: conditionData.forma_pagamento,
          prazo_pagamento: conditionData.prazo_pagamento,
          prazo_entrega:   conditionData.prazo_entrega,
          garantia:        conditionData.garantia || '',
          validade:        conditionData.validade,
        },
        commercial_condition_id: conditionId,
      };
    }
    return {
      condicoes: {
        forma_pagamento: condManual.forma_pagamento,
        prazo_pagamento: condManual.prazo_pagamento,
        prazo_entrega:   condManual.prazo_entrega,
        garantia:        condManual.garantia,
        validade:        condManual.validade,
      },
      commercial_condition_id: null,
    };
  }

  function buildPayload() {
    const condPayload = buildCondPayload();
    const objetoProposta = objetoData ? (objetoData.descricao || objetoData.nome) : '';
    return {
      numero_proposta:         numeroProposta.trim(),
      observacoes:             observacoes.trim() || null,
      objeto_proposta:         objetoProposta,
      cliente_id:              clientId,
      items: items.map(it => ({
        quantidade:     parseFloat(it.quantidade) || 1,
        descricao:      it.descricao,
        part_id:        it.partId ? Number(it.partId) : null,
        valor_unitario: parseNumber(it.valorUnitario),
        ncm:            it.ncm || null,
      })),
      condicoes:               condPayload.condicoes,
      commercial_condition_id: condPayload.commercial_condition_id,
    };
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);

    if (!numeroProposta.trim()) {
      setResult({ type: 'error', html: 'Informe o número da proposta antes de gerar.' });
      return;
    }
    if (!clientId) {
      setResult({ type: 'error', html: 'Selecione um Hospital/Cliente cadastrado antes de gerar a proposta.' });
      return;
    }
    if (!objetoId) {
      setResult({ type: 'error', html: 'Selecione um Objeto da Proposta antes de gerar.' });
      return;
    }
    if (condMode === null) {
      setResult({ type: 'error', html: 'Selecione como deseja definir as condições comerciais desta proposta.' });
      return;
    }
    if (condMode === 'catalog' && !conditionId) {
      setResult({ type: 'error', html: 'Selecione uma condição comercial cadastrada ou escolha outra opção.' });
      return;
    }
    if (condMode === 'new') {
      setResult({ type: 'error', html: 'Preencha os campos da nova condição e clique em "Criar e usar esta condição" antes de gerar.' });
      return;
    }
    if (condMode === 'manual') {
      const { forma_pagamento, prazo_pagamento, prazo_entrega, validade } = condManual;
      if (!forma_pagamento || !prazo_pagamento || !prazo_entrega || !validade) {
        setResult({ type: 'error', html: 'Preencha todos os campos obrigatórios de Condições Comerciais (Forma de Pagamento, Prazo de Pagamento, Prazo de Entrega, Validade).' });
        return;
      }
    }
    if (userState !== 'loaded') {
      setResult({ type: 'error', html: 'Configure sua assinatura (cargo e telefone) antes de gerar propostas. <a href="/usuarios">Acessar Usuários</a>' });
      return;
    }

    if (!items.length) { setResult({ type: 'error', html: 'Adicione pelo menos um item à proposta.' }); return; }
    const bad = items.find(it => !it.descricao || parseNumber(it.valorUnitario) <= 0);
    if (bad) { setResult({ type: 'error', html: 'Preencha descrição e valor unitário em todos os itens.' }); return; }
    const semPeca = items.find(it => !it.partId);
    if (semPeca) { setResult({ type: 'error', html: 'Selecione cada peça a partir do catálogo usando "Procurar peça", ou clique em "+ Criar nova peça no catálogo" para cadastrar.' }); return; }

    setSubmitting(true);
    try {
      const data = await createProposal(buildPayload());
      clearDraft();
      const numero = numeroProposta.trim();
      const url = `/files/proposta-${numero}.pdf`;
      setResult({
        type: 'success',
        html: `Proposta gerada com sucesso!<br><br><a href="${url}" target="_blank">Abrir PDF: proposta-${numero}.pdf</a>`
      });
    } catch (err) {
      if (err.data?.code === 'CLIENT_DATA_CONFLICT') {
        let html = `<strong>Conflito de dados do cliente</strong><br>${err.message}`;
        if (err.data.existingClientId) {
          html += `<br><br><a href="/clients" target="_blank">Ver cliente cadastrado (id=${err.data.existingClientId})</a>`;
        }
        setResult({ type: 'error', html });
      } else {
        setResult({ type: 'error', html: err.message || 'Erro ao gerar proposta. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Observations textarea auto-resize ─────────────────────────────────
  function handleObsChange(e) {
    setObservacoes(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  // ── Sidebar values ─────────────────────────────────────────────────────
  const sbNumero  = numeroProposta.trim() || null;
  const sbCliente = clientData?.nome || null;
  const sbItens   = items.length;
  const sbResp    = user ? user.nome.split(' ')[0] : null;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Page Header */}
      <div className="np-pagebar">
        <div className="np-pagebar-inner">
          <nav className="np-breadcrumb" aria-label="Navegação">
            <Link to="/proposals" className="np-bread-link">Propostas</Link>
            <span className="np-bread-sep">/</span>
            <span className="np-bread-cur">Nova proposta</span>
          </nav>
          <h1 className="np-page-title">Nova Proposta Comercial</h1>
          <p className="np-page-sub">Monte uma proposta com cliente, objeto, itens, condições comerciais e responsável.</p>
        </div>
      </div>

      {/* Draft Modal */}
      {draftModal && (
        <div className="np-draft-overlay">
          <div className="np-draft-box">
            <div className="modal-header">
              <h3>Continuar de onde parou?</h3>
            </div>
            <div className="np-draft-body">
              <p>Existe um rascunho salvo desta proposta.<br />Deseja continuar de onde parou ou começar do zero?</p>
              <div className="np-draft-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setDraftModal(false); clearDraft(); }}
                >
                  Descartar rascunho
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => { setDraftModal(false); await restoreDraft(); }}
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Part picker modal */}
      {partPickTarget !== null && (
        <EntityPickerModal
          title="Selecionar Peça do Catálogo"
          fetchFn={listParts}
          filterFn={(p, q) =>
            (p.nome||'').toLowerCase().includes(q) ||
            (p.marca||'').toLowerCase().includes(q) ||
            (p.modelo||'').toLowerCase().includes(q)
          }
          renderItem={p => {
            const sub = [p.marca, p.modelo, p.ncm ? `NCM ${p.ncm}` : null].filter(Boolean).join(' · ');
            return <>
              <div className="mi-main">{p.nome}</div>
              {sub && <div className="mi-sub">{sub}</div>}
            </>;
          }}
          onSelect={part => { handlePickPart(partPickTarget, part); setPartPickTarget(null); }}
          onClose={() => setPartPickTarget(null)}
          searchPlaceholder="Buscar por nome, marca ou modelo..."
        />
      )}

      {/* Client picker modal */}
      {modal === 'client' && (
        <EntityPickerModal
          title="Selecionar Hospital / Cliente"
          fetchFn={listClients}
          filterFn={(c, q) =>
            (c.nome||'').toLowerCase().includes(q) ||
            (c.cnpj||'').includes(q) ||
            (c.cidade||'').toLowerCase().includes(q)
          }
          renderItem={c => {
            const sub = [c.cnpj, c.cidade && c.estado ? `${c.cidade} — ${c.estado}` : c.cidade || c.estado].filter(Boolean).join(' · ');
            return <>
              <div className="mi-main">{c.nome}</div>
              {sub && <div className="mi-sub">{sub}</div>}
            </>;
          }}
          onSelect={c => { doSelectClient(c); setModal(null); }}
          onClose={() => setModal(null)}
          searchPlaceholder="Buscar por nome, cidade ou CNPJ..."
        />
      )}

      {/* Objeto picker modal */}
      {modal === 'objeto' && (
        <EntityPickerModal
          title="Selecionar Objeto da Proposta"
          fetchFn={listObjetos}
          filterFn={(o, q) =>
            (o.nome||'').toLowerCase().includes(q) ||
            (o.descricao||'').toLowerCase().includes(q)
          }
          renderItem={o => {
            const desc = o.descricao ? (o.descricao.length > 80 ? o.descricao.substring(0,80) + '...' : o.descricao) : '';
            return <>
              <div className="mi-main">{o.nome}</div>
              {desc && <div className="mi-sub">{desc}</div>}
            </>;
          }}
          onSelect={o => { doSelectObjeto(o); setModal(null); }}
          onClose={() => setModal(null)}
          searchPlaceholder="Buscar por nome ou descrição..."
        />
      )}

      {/* Condition picker modal */}
      {modal === 'condition' && (
        <EntityPickerModal
          title="Selecionar Condição Comercial"
          fetchFn={listConditions}
          filterFn={(c, q) =>
            (c.name||'').toLowerCase().includes(q) ||
            (c.forma_pagamento||'').toLowerCase().includes(q)
          }
          renderItem={c => {
            const sub = [c.forma_pagamento, c.prazo_pagamento].filter(Boolean).join(' · ');
            return <>
              <div className="mi-main">{c.name}</div>
              {sub && <div className="mi-sub">{sub}</div>}
            </>;
          }}
          onSelect={c => { doSelectCondition(c); setModal(null); }}
          onClose={() => setModal(null)}
          searchPlaceholder="Buscar por nome ou forma de pagamento..."
        />
      )}

      {/* Main Form */}
      <div className="np-container">
        <form className="np-layout" onSubmit={handleSubmit}>

          {/* ═══ LEFT: Form Column ══════════════════════════════════════ */}
          <div className="np-form-col">

            {/* 1. Identificação */}
            <div className="card np-card">
              <div className="np-card-title">Identificação da proposta</div>
              <div className="field" style={{ maxWidth: 220 }}>
                <label>Nº da Proposta *</label>
                <input
                  type="text"
                  value={numeroProposta}
                  onChange={e => setNumeroProposta(e.target.value)}
                  placeholder="Ex: 2026-001"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            {/* 2. Cliente */}
            <div className="card np-card">
              <div className="np-card-title">Hospital / Cliente</div>
              {!clientId ? (
                <div className="np-select-btns">
                  <button type="button" className="btn-procurar" onClick={() => setModal('client')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Procurar cliente
                  </button>
                  <a className="btn-criar-link" href="/clients" target="_blank">+ Criar novo cliente</a>
                </div>
              ) : (
                <div className="np-entity-card">
                  <div className="np-entity-header">
                    <div className="np-entity-name">{clientData.nome}</div>
                    <button type="button" className="np-entity-change" onClick={clearClient}>Alterar cliente</button>
                  </div>
                  {buildPreviewRows([
                    clientData.razao_social        && ['Razão Social', clientData.razao_social],
                    clientData.cnpj                && ['CNPJ', clientData.cnpj],
                    clientData.inscricao_estadual  && ['Insc. Estadual', clientData.inscricao_estadual],
                    clientData.endereco            && ['Endereço', clientData.endereco],
                    (clientData.cidade || clientData.estado) && ['Cidade / UF', [clientData.cidade, clientData.estado].filter(Boolean).join(' — ')],
                    clientData.cep                 && ['CEP', clientData.cep],
                    clientData.telefone            && ['Telefone', clientData.telefone],
                    clientData.email               && ['E-mail', clientData.email],
                    clientData.contato_responsavel && ['Contato', clientData.contato_responsavel],
                  ].filter(Boolean))}
                </div>
              )}
            </div>

            {/* 3. Objeto */}
            <div className="card np-card">
              <div className="np-card-title">Objeto da proposta</div>
              {!objetoId ? (
                <div className="np-select-btns">
                  <button type="button" className="btn-procurar" onClick={() => setModal('objeto')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Procurar objeto
                  </button>
                  <a className="btn-criar-link" href="/objetos" target="_blank">+ Criar novo objeto</a>
                </div>
              ) : (
                <div className="np-entity-card">
                  <div className="np-entity-header">
                    <div className="np-entity-name">{objetoData.nome}</div>
                    <button type="button" className="np-entity-change" onClick={clearObjeto}>Alterar objeto</button>
                  </div>
                  {buildPreviewBlock(objetoData.descricao)}
                </div>
              )}
            </div>

            {/* 4. Itens */}
            <div className="card np-card">
              <div className="np-card-title">Itens da proposta</div>
              <div className="np-table-wrap">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th className="col-num">#</th>
                      <th className="col-qty">Qtd *</th>
                      <th className="col-desc">Peça / Descrição *</th>
                      <th className="col-price">Valor unitário (R$) *</th>
                      <th className="col-total">Total</th>
                      <th className="col-ncm">NCM</th>
                      <th className="col-del"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        index={index}
                        clientId={clientId}
                        onChange={updateItem}
                        onRemove={removeItem}
                        onPickPart={id => setPartPickTarget(id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="items-footer">
                <div className="np-item-actions">
                  <button type="button" className="btn-add-item" onClick={addItem}>
                    + Adicionar peça do catálogo
                  </button>
                  <a href="/parts" target="_blank" className="np-link-action">+ Criar nova peça no catálogo</a>
                </div>
                <div className="total-display">
                  <span>Total</span>
                  <span>{formatBRL(total)}</span>
                </div>
              </div>
            </div>

            {/* 5. Condições comerciais */}
            <div className="card np-card" id="condCard">
              <div className="np-card-title">Condições comerciais</div>
              <p className="np-card-hint">Como deseja definir as condições comerciais desta proposta?</p>

              <div className="np-cond-options">
                {[
                  { mode: 'catalog', title: 'Usar condição cadastrada',  desc: 'Selecionar de uma lista de condições já salvas' },
                  { mode: 'new',     title: 'Criar nova condição padrão', desc: 'Preencher campos e salvar para uso futuro' },
                  { mode: 'manual',  title: 'Condição específica',        desc: 'Usar somente nesta proposta, sem salvar' },
                ].map(opt => (
                  <button
                    key={opt.mode}
                    type="button"
                    className={`cond-mode-btn${condMode === opt.mode ? ' active' : ''}`}
                    onClick={() => setCondMode(opt.mode)}
                  >
                    <span className="cmo-title">{opt.title}</span>
                    <span className="cmo-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Mode: Catalog */}
              {condMode === 'catalog' && (
                <div>
                  {!conditionId ? (
                    <button type="button" className="btn-procurar" onClick={() => setModal('condition')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Procurar condição cadastrada
                    </button>
                  ) : (
                    <div className="np-cond-selected">
                      <div className="np-cond-sel-header">
                        <div className="np-cond-sel-name">{conditionData.name}</div>
                        <button type="button" className="np-entity-change" onClick={clearCondition}>Trocar</button>
                      </div>
                      {buildPreviewRows([
                        ['Forma de pagamento', conditionData.forma_pagamento],
                        ['Prazo de pagamento', conditionData.prazo_pagamento],
                        ['Prazo de entrega',   conditionData.prazo_entrega],
                        ['Validade',           conditionData.validade],
                        ...(conditionData.garantia ? [['Garantia', conditionData.garantia]] : []),
                      ])}
                    </div>
                  )}
                </div>
              )}

              {/* Mode: New */}
              {condMode === 'new' && (
                <div onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCondition(); } }}>
                  <div className="grid-2" style={{ marginBottom: 14 }}>
                    <div className="field">
                      <label>Nome da Condição *</label>
                      <input type="text" value={condNew.name} onChange={e => setCondNew(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Pagamento 30 dias" autoComplete="off" />
                    </div>
                    <div className="field">
                      <label>Forma de Pagamento *</label>
                      <input type="text" value={condNew.forma_pagamento} onChange={e => setCondNew(p => ({ ...p, forma_pagamento: e.target.value }))} placeholder="Boleto bancário" />
                    </div>
                  </div>
                  <div className="grid-2" style={{ marginBottom: 14 }}>
                    <div className="field">
                      <label>Prazo de Pagamento *</label>
                      <input type="text" value={condNew.prazo_pagamento} onChange={e => setCondNew(p => ({ ...p, prazo_pagamento: e.target.value }))} placeholder="30 dias após entrega" />
                    </div>
                    <div className="field">
                      <label>Prazo de Entrega *</label>
                      <input type="text" value={condNew.prazo_entrega} onChange={e => setCondNew(p => ({ ...p, prazo_entrega: e.target.value }))} placeholder="30 dias úteis" />
                    </div>
                  </div>
                  <div className="grid-2" style={{ marginBottom: 14 }}>
                    <div className="field">
                      <label>Validade da Proposta *</label>
                      <input type="text" value={condNew.validade} onChange={e => setCondNew(p => ({ ...p, validade: e.target.value }))} placeholder="30 dias" />
                    </div>
                    <div className="field">
                      <label>Garantia <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(opcional)</span></label>
                      <input type="text" value={condNew.garantia} onChange={e => setCondNew(p => ({ ...p, garantia: e.target.value }))} placeholder="12 meses (opcional)" />
                    </div>
                  </div>
                  {condNewError && <div className="np-cond-new-msg error">{condNewError}</div>}
                  <button
                    type="button"
                    className="btn-procurar"
                    style={{ borderColor: 'var(--color-primary)', background: 'var(--color-primary)', color: '#fff' }}
                    onClick={handleCreateCondition}
                    disabled={condNewLoading}
                  >
                    {condNewLoading ? 'Criando...' : 'Criar e usar esta condição'}
                  </button>
                </div>
              )}

              {/* Mode: Manual */}
              {condMode === 'manual' && (
                <div>
                  <div className="msg-warn" style={{ marginBottom: 12, fontSize: 12 }}>
                    Esta condição será usada apenas nesta proposta e não será salva como padrão.
                  </div>
                  <div className="grid-2" style={{ marginBottom: 14 }}>
                    <div className="field">
                      <label>Forma de Pagamento *</label>
                      <input type="text" value={condManual.forma_pagamento} onChange={e => setCondManual(p => ({ ...p, forma_pagamento: e.target.value }))} placeholder="Boleto bancário" />
                    </div>
                    <div className="field">
                      <label>Prazo de Pagamento *</label>
                      <input type="text" value={condManual.prazo_pagamento} onChange={e => setCondManual(p => ({ ...p, prazo_pagamento: e.target.value }))} placeholder="30 dias após entrega" />
                    </div>
                  </div>
                  <div className="grid-3">
                    <div className="field">
                      <label>Prazo de Entrega *</label>
                      <input type="text" value={condManual.prazo_entrega} onChange={e => setCondManual(p => ({ ...p, prazo_entrega: e.target.value }))} placeholder="30 dias úteis" />
                    </div>
                    <div className="field">
                      <label>Garantia <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(opcional)</span></label>
                      <input type="text" value={condManual.garantia} onChange={e => setCondManual(p => ({ ...p, garantia: e.target.value }))} placeholder="12 meses" />
                    </div>
                    <div className="field">
                      <label>Validade da Proposta *</label>
                      <input type="text" value={condManual.validade} onChange={e => setCondManual(p => ({ ...p, validade: e.target.value }))} placeholder="30 dias" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Observações */}
            <div className="card np-card">
              <div className="np-card-title">
                Observações
                <span className="np-optional">(opcional)</span>
              </div>
              <p className="np-card-hint">Use este campo para informações extras que devem aparecer no PDF.</p>
              <div className="field">
                <textarea
                  ref={obsRef}
                  value={observacoes}
                  onChange={handleObsChange}
                  className="np-textarea"
                  placeholder="Ex: Entrega prevista para o primeiro semestre. Verificar disponibilidade com o almoxarifado."
                />
              </div>
            </div>

            {/* 7. Responsável */}
            <div className="card np-card">
              <div className="np-card-title">Responsável pela proposta</div>
              <div className="np-resp-card">
                {userState === 'loading' && (
                  <>
                    <div className="np-skel np-skel-name" />
                    <div className="np-skel np-skel-sub" />
                  </>
                )}
                {userState === 'loaded' && (
                  <>
                    <div className="np-resp-name">{user.nome}</div>
                    <div className="np-resp-detail">
                      {[user.signature_cargo, user.signature_telefone].filter(Boolean).join(' · ')}
                    </div>
                    <div className="np-resp-note">
                      A proposta será gerada em seu nome. &nbsp;
                      <Link to="/usuarios">Alterar assinatura</Link>
                    </div>
                  </>
                )}
                {userState === 'nosig' && (
                  <>
                    <div className="np-resp-name" style={{ color: 'var(--color-text)' }}>{user.nome}</div>
                    <div className="np-resp-detail" style={{ marginTop: 4, color: 'var(--color-danger)' }}>
                      Assinatura não cadastrada — configure cargo e telefone antes de gerar propostas.
                    </div>
                    <div className="np-resp-note"><Link to="/usuarios">Criar assinatura</Link></div>
                  </>
                )}
              </div>
            </div>

            {/* Result */}
            {result && (
              <div
                className={`np-result ${result.type}`}
                dangerouslySetInnerHTML={{ __html: result.html }}
              />
            )}

          </div>{/* /.np-form-col */}

          {/* ═══ RIGHT: Sidebar ════════════════════════════════════════ */}
          <aside className="np-sidebar">
            <div className="np-sb-card">
              <div className="np-sb-head">
                <span className="np-sb-title">Resumo da proposta</span>
                <span className="np-sb-status">Rascunho</span>
              </div>
              <div className="np-sb-rows">
                <div className="np-sb-row">
                  <span className="np-sb-label">Proposta</span>
                  <span className={`np-sb-val${sbNumero ? '' : ' empty'}`}>{sbNumero || '—'}</span>
                </div>
                <div className="np-sb-row">
                  <span className="np-sb-label">Cliente</span>
                  <span className={`np-sb-val${sbCliente ? '' : ' empty'}`}>{sbCliente || 'Não selecionado'}</span>
                </div>
                <div className="np-sb-row">
                  <span className="np-sb-label">Itens</span>
                  <span className="np-sb-val">{sbItens}</span>
                </div>
                <div className="np-sb-row">
                  <span className="np-sb-label">Responsável</span>
                  <span className={`np-sb-val${sbResp ? '' : ' empty'}`}>{sbResp || '—'}</span>
                </div>
              </div>
              <div className="np-sb-total">
                <div className="np-sb-total-label">Total da proposta</div>
                <div className="np-sb-total-val">{formatBRL(total)}</div>
              </div>
              <div className="np-sb-actions">
                <button
                  type="submit"
                  className={`btn-submit${submitting ? ' loading' : ''}`}
                  disabled={submitting}
                  style={{ width: '100%' }}
                >
                  <span className="btn-text">Gerar Proposta PDF</span>
                  <span className="np-spinner" />
                </button>
                <p className="np-sb-note">
                  O PDF será gerado e disponibilizado para download imediato.
                </p>
              </div>
            </div>
          </aside>

        </form>
      </div>

      {/* Sticky Submit (mobile) */}
      <div className="np-sticky-footer">
        <button
          type="button"
          className={`btn-submit${submitting ? ' loading' : ''}`}
          style={{ width: '100%' }}
          disabled={submitting}
          onClick={handleSubmit}
        >
          <span className="btn-text">Gerar Proposta PDF</span>
          <span className="np-spinner" />
        </button>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '' })}
      />
    </>
  );
}
