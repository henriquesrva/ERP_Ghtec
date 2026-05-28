import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listObjetos, searchObjetos, createObjeto, updateObjeto, deleteObjeto,
} from '../api/objetos';
import {
  listConditions, searchConditions, createCondition, updateCondition, deleteCondition,
} from '../api/conditions';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';

/**
 * Objetos.jsx
 *
 * Cobre dois módulos no mesmo componente:
 *
 * ─ Objetos (templates de escopo de proposta)
 *   GET  /objetos
 *   GET  /objetos/search?q=
 *   POST /objetos
 *   PUT  /objetos/:id
 *   DELETE /objetos/:id
 *
 * ─ Condições Comerciais
 *   GET  /commercial-conditions
 *   GET  /commercial-conditions/search?q=
 *   POST /commercial-conditions
 *   PUT  /commercial-conditions/:id
 *   DELETE /commercial-conditions/:id
 *
 * Navegação interna via estado local `view`:
 *   'home' | 'objMenu' | 'objCreate' | 'objList'
 *   | 'condMenu' | 'condCreate' | 'condList'
 *
 * Suporta query params herdados do legado:
 *   ?new=1                   → abre form de novo objeto
 *   ?section=conditions      → abre menu de condições
 *   ?section=conditions&new=1 → abre form de nova condição
 */

const EMPTY_OBJ  = { nome: '', descricao: '' };
const EMPTY_COND = {
  name: '', forma_pagamento: '', prazo_pagamento: '',
  prazo_entrega: '', validade: '', garantia: '',
};

export default function Objetos() {
  const [searchParams] = useSearchParams();

  // ── Navegação interna ────────────────────────────────────────────────────────
  const [view, setView] = useState('home');

  // ── Objetos ──────────────────────────────────────────────────────────────────
  const [objList,          setObjList]          = useState([]);
  const [objLoading,       setObjLoading]       = useState(false);
  const [objSearchQ,       setObjSearchQ]       = useState('');
  const [objEditingId,     setObjEditingId]     = useState(null);
  const [objForm,          setObjForm]          = useState(EMPTY_OBJ);
  const [objNomeErr,       setObjNomeErr]       = useState(false);
  const [objFormMsg,       setObjFormMsg]       = useState({ type: '', text: '' });
  const [objSubmitting,    setObjSubmitting]    = useState(false);
  const [deleteObjConfirm, setDeleteObjConfirm] = useState(null); // { id, nome }

  // ── Condições ────────────────────────────────────────────────────────────────
  const [condList,          setCondList]          = useState([]);
  const [condLoading,       setCondLoading]       = useState(false);
  const [condSearchQ,       setCondSearchQ]       = useState('');
  const [condEditingId,     setCondEditingId]     = useState(null);
  const [condForm,          setCondForm]          = useState(EMPTY_COND);
  const [condErrors,        setCondErrors]        = useState({});
  const [condFormMsg,       setCondFormMsg]       = useState({ type: '', text: '' });
  const [condSubmitting,    setCondSubmitting]    = useState(false);
  const [deleteCondConfirm, setDeleteCondConfirm] = useState(null); // { id, name }

  // ── Feedback global ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // ── Timers de debounce ────────────────────────────────────────────────────────
  const objSearchTimer  = useRef(null);
  const condSearchTimer = useRef(null);

  // ── Inicialização por query params (compatibilidade com legado) ───────────────
  useEffect(() => {
    const section = searchParams.get('section');
    const isNew   = searchParams.get('new') === '1';
    if (section === 'conditions') {
      isNew ? goToCondCreate() : setView('condMenu');
    } else if (isNew) {
      goToObjCreate();
    }
  }, []); // eslint-disable-line

  // ── Carregar lista ao entrar na view ─────────────────────────────────────────
  useEffect(() => {
    if (view === 'objList')  loadObjList(objSearchQ);
    if (view === 'condList') loadCondList(condSearchQ);
  }, [view]); // eslint-disable-line

  // ════════════════════════════════════════════════════════════════════════════
  // OBJETOS — API helpers
  // ════════════════════════════════════════════════════════════════════════════

  async function loadObjList(q = objSearchQ) {
    setObjLoading(true);
    try {
      const data = q.trim() ? await searchObjetos(q.trim()) : await listObjetos();
      setObjList(data);
    } catch {
      setObjList([]);
    } finally {
      setObjLoading(false);
    }
  }

  function goToObjCreate() {
    setObjEditingId(null);
    setObjForm(EMPTY_OBJ);
    setObjNomeErr(false);
    setObjFormMsg({ type: '', text: '' });
    setView('objCreate');
  }

  function goToObjEdit(obj) {
    setObjEditingId(obj.id);
    setObjForm({ nome: obj.nome || '', descricao: obj.descricao || '' });
    setObjNomeErr(false);
    setObjFormMsg({ type: '', text: '' });
    setView('objCreate');
  }

  async function handleObjSubmit(e) {
    e.preventDefault();
    setObjNomeErr(false);
    setObjFormMsg({ type: '', text: '' });

    if (!objForm.nome.trim()) {
      setObjNomeErr(true);
      setObjFormMsg({ type: 'error', text: 'O campo Nome é obrigatório.' });
      return;
    }

    setObjSubmitting(true);
    try {
      const payload = {
        nome:      objForm.nome.trim(),
        descricao: objForm.descricao.trim() || null,
      };
      if (objEditingId) {
        await updateObjeto(objEditingId, payload);
        setToast({ message: 'Objeto atualizado com sucesso.', type: 'success' });
        setObjFormMsg({ type: 'success', text: 'Objeto atualizado com sucesso.' });
      } else {
        await createObjeto(payload);
        setToast({ message: 'Objeto criado com sucesso.', type: 'success' });
        setObjFormMsg({ type: 'success', text: 'Objeto criado com sucesso.' });
      }
      // Volta para o modo de criação após salvar
      setObjEditingId(null);
      setObjForm(EMPTY_OBJ);
    } catch (err) {
      setObjFormMsg({ type: 'error', text: err.message || 'Erro ao salvar. Tente novamente.' });
    } finally {
      setObjSubmitting(false);
    }
  }

  async function handleObjDelete() {
    if (!deleteObjConfirm) return;
    const { id } = deleteObjConfirm;
    setDeleteObjConfirm(null);
    try {
      await deleteObjeto(id);
      setToast({ message: 'Objeto excluído.', type: 'success' });
      loadObjList(objSearchQ);
    } catch (err) {
      setToast({ message: err.message || 'Erro ao excluir objeto.', type: 'error' });
    }
  }

  function handleObjSearch(e) {
    const q = e.target.value;
    setObjSearchQ(q);
    clearTimeout(objSearchTimer.current);
    objSearchTimer.current = setTimeout(() => loadObjList(q), 280);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONDIÇÕES — API helpers
  // ════════════════════════════════════════════════════════════════════════════

  async function loadCondList(q = condSearchQ) {
    setCondLoading(true);
    try {
      const data = q.trim() ? await searchConditions(q.trim()) : await listConditions();
      setCondList(data);
    } catch {
      setCondList([]);
    } finally {
      setCondLoading(false);
    }
  }

  function goToCondCreate() {
    setCondEditingId(null);
    setCondForm(EMPTY_COND);
    setCondErrors({});
    setCondFormMsg({ type: '', text: '' });
    setView('condCreate');
  }

  function goToCondEdit(cond) {
    setCondEditingId(cond.id);
    setCondForm({
      name:            cond.name            || '',
      forma_pagamento: cond.forma_pagamento || '',
      prazo_pagamento: cond.prazo_pagamento || '',
      prazo_entrega:   cond.prazo_entrega   || '',
      validade:        cond.validade        || '',
      garantia:        cond.garantia        || '',
    });
    setCondErrors({});
    setCondFormMsg({ type: '', text: '' });
    setView('condCreate');
  }

  async function handleCondSubmit(e) {
    e.preventDefault();
    setCondErrors({});
    setCondFormMsg({ type: '', text: '' });

    const required = [
      ['name',            'Nome é obrigatório.'],
      ['forma_pagamento', 'Forma de pagamento é obrigatória.'],
      ['prazo_pagamento', 'Prazo de pagamento é obrigatório.'],
      ['prazo_entrega',   'Prazo de entrega é obrigatório.'],
      ['validade',        'Validade é obrigatória.'],
    ];
    const errs = {};
    let firstMsg = '';
    for (const [field, msg] of required) {
      if (!condForm[field].trim()) {
        errs[field] = true;
        if (!firstMsg) firstMsg = msg;
      }
    }
    if (Object.keys(errs).length) {
      setCondErrors(errs);
      setCondFormMsg({ type: 'error', text: firstMsg });
      return;
    }

    setCondSubmitting(true);
    try {
      const payload = {
        name:            condForm.name.trim(),
        forma_pagamento: condForm.forma_pagamento.trim(),
        prazo_pagamento: condForm.prazo_pagamento.trim(),
        prazo_entrega:   condForm.prazo_entrega.trim(),
        validade:        condForm.validade.trim(),
        garantia:        condForm.garantia.trim() || null,
      };
      if (condEditingId) {
        await updateCondition(condEditingId, payload);
        setToast({ message: 'Condição atualizada com sucesso.', type: 'success' });
        setCondFormMsg({ type: 'success', text: 'Condição atualizada com sucesso.' });
      } else {
        await createCondition(payload);
        setToast({ message: 'Condição criada com sucesso.', type: 'success' });
        setCondFormMsg({ type: 'success', text: 'Condição criada com sucesso.' });
      }
      setCondEditingId(null);
      setCondForm(EMPTY_COND);
    } catch (err) {
      setCondFormMsg({ type: 'error', text: err.message || 'Erro ao salvar. Tente novamente.' });
    } finally {
      setCondSubmitting(false);
    }
  }

  async function handleCondDelete() {
    if (!deleteCondConfirm) return;
    const { id } = deleteCondConfirm;
    setDeleteCondConfirm(null);
    try {
      await deleteCondition(id);
      setToast({ message: 'Condição excluída.', type: 'success' });
      loadCondList(condSearchQ);
    } catch (err) {
      setToast({ message: err.message || 'Erro ao excluir condição.', type: 'error' });
    }
  }

  function handleCondSearch(e) {
    const q = e.target.value;
    setCondSearchQ(q);
    clearTimeout(condSearchTimer.current);
    condSearchTimer.current = setTimeout(() => loadCondList(q), 280);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-bar">
        <div>
          <h1>Objetos e Condições</h1>
          <span>Cadastro de objetos e condições comerciais reutilizáveis</span>
        </div>
      </div>

      <div className="container">

        {/* ══ HOME ══════════════════════════════════════════════════════════════ */}
        {view === 'home' && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '20px', maxWidth: '700px', margin: '0 auto',
          }}>
            <SectionCard
              icon="📦"
              title="Objetos"
              desc="Cadastre e gerencie objetos de proposta reutilizáveis"
              onClick={() => setView('objMenu')}
            />
            <SectionCard
              icon="📋"
              title="Condições"
              desc="Cadastre e gerencie condições comerciais reutilizáveis"
              onClick={() => setView('condMenu')}
            />
          </div>
        )}

        {/* ══ OBJETOS MENU ══════════════════════════════════════════════════════ */}
        {view === 'objMenu' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px' }}>
              <SectionCard icon="➕" title="Cadastrar novo objeto" desc="Adicione um novo objeto ao cadastro" onClick={goToObjCreate} />
              <SectionCard icon="📋" title="Ver objetos cadastrados" desc="Visualize e gerencie os objetos existentes" onClick={() => setView('objList')} />
            </div>
          </div>
        )}

        {/* ══ OBJETO FORM (criar / editar) ══════════════════════════════════════ */}
        {view === 'objCreate' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn-back" onClick={() => setView('objMenu')}>← Voltar</button>
            </div>
            <div className="card" style={{ maxWidth: '680px' }}>
              <div className="card-title">{objEditingId ? 'Editar Objeto' : 'Novo Objeto'}</div>
              <form onSubmit={handleObjSubmit} noValidate>
                <div className="field">
                  <label>Nome do Objeto *</label>
                  <input
                    type="text"
                    value={objForm.nome}
                    onChange={e => {
                      setObjForm(f => ({ ...f, nome: e.target.value }));
                      setObjNomeErr(false);
                    }}
                    className={objNomeErr ? 'error' : ''}
                    placeholder="Ex: Fornecimento de Equipamentos de UTI"
                    disabled={objSubmitting}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Descrição</label>
                  <textarea
                    value={objForm.descricao}
                    onChange={e => setObjForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Texto completo que será inserido na proposta..."
                    disabled={objSubmitting}
                    rows={4}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                {objFormMsg.text && (
                  <div className={`msg ${objFormMsg.type}`}>{objFormMsg.text}</div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={objSubmitting}>
                    {objSubmitting ? 'Salvando...' : (objEditingId ? 'Salvar alterações' : 'Criar objeto')}
                  </button>
                  {objEditingId && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={objSubmitting}
                      onClick={() => {
                        setObjEditingId(null);
                        setObjForm(EMPTY_OBJ);
                        setObjNomeErr(false);
                        setObjFormMsg({ type: '', text: '' });
                        setView('objMenu');
                      }}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ OBJETOS LISTA ═════════════════════════════════════════════════════ */}
        {view === 'objList' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '18px', gap: '12px', flexWrap: 'wrap',
            }}>
              <button className="btn-back" onClick={() => setView('objMenu')}>← Voltar</button>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                Objetos cadastrados
              </h2>
              <button
                onClick={goToObjCreate}
                style={{
                  padding: '5px 12px', fontSize: '12px', fontWeight: 700,
                  background: 'var(--green-bg)', color: 'var(--green)',
                  border: '1px dashed var(--green-light)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                + Novo objeto
              </button>
            </div>
            <div className="card">
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  value={objSearchQ}
                  onChange={handleObjSearch}
                  placeholder="Buscar por nome ou descrição..."
                  autoComplete="off"
                  style={{
                    width: '100%', padding: '8px 12px', boxSizing: 'border-box',
                    border: '1px solid #ccc', borderRadius: 'var(--radius)',
                    fontSize: '13px', fontFamily: 'inherit',
                  }}
                />
              </div>
              {objLoading && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: '13px' }}>
                  Carregando...
                </div>
              )}
              {!objLoading && (
                <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                  {objList.length === 0
                    ? (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '13px' }}>
                        Nenhum objeto encontrado.
                      </div>
                    )
                    : objList.map(o => (
                      <ObjItem
                        key={o.id}
                        item={o}
                        onEdit={() => goToObjEdit(o)}
                        onDelete={() => setDeleteObjConfirm({ id: o.id, nome: o.nome })}
                      />
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ CONDIÇÕES MENU ════════════════════════════════════════════════════ */}
        {view === 'condMenu' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn-back" onClick={() => setView('home')}>← Voltar</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px' }}>
              <SectionCard icon="➕" title="Criar nova condição" desc="Cadastre uma nova condição comercial reutilizável" onClick={goToCondCreate} />
              <SectionCard icon="📋" title="Lista de condições" desc="Visualize e edite as condições cadastradas" onClick={() => setView('condList')} />
            </div>
          </div>
        )}

        {/* ══ CONDIÇÃO FORM (criar / editar) ════════════════════════════════════ */}
        {view === 'condCreate' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn-back" onClick={() => setView('condMenu')}>← Voltar</button>
            </div>
            <div className="card" style={{ maxWidth: '680px' }}>
              <div className="card-title">{condEditingId ? 'Editar Condição' : 'Nova Condição Comercial'}</div>
              <form onSubmit={handleCondSubmit} noValidate>
                <div className="field">
                  <label>Nome da Condição *</label>
                  <input
                    type="text"
                    value={condForm.name}
                    onChange={e => {
                      setCondForm(f => ({ ...f, name: e.target.value }));
                      setCondErrors(err => ({ ...err, name: false }));
                    }}
                    className={condErrors.name ? 'error' : ''}
                    placeholder="Ex: Pagamento 30 dias"
                    disabled={condSubmitting}
                    autoFocus
                  />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Forma de Pagamento *</label>
                    <input
                      type="text"
                      value={condForm.forma_pagamento}
                      onChange={e => {
                        setCondForm(f => ({ ...f, forma_pagamento: e.target.value }));
                        setCondErrors(err => ({ ...err, forma_pagamento: false }));
                      }}
                      className={condErrors.forma_pagamento ? 'error' : ''}
                      placeholder="Boleto bancário"
                      disabled={condSubmitting}
                    />
                  </div>
                  <div className="field">
                    <label>Prazo de Pagamento *</label>
                    <input
                      type="text"
                      value={condForm.prazo_pagamento}
                      onChange={e => {
                        setCondForm(f => ({ ...f, prazo_pagamento: e.target.value }));
                        setCondErrors(err => ({ ...err, prazo_pagamento: false }));
                      }}
                      className={condErrors.prazo_pagamento ? 'error' : ''}
                      placeholder="30 dias após entrega"
                      disabled={condSubmitting}
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Prazo de Entrega *</label>
                    <input
                      type="text"
                      value={condForm.prazo_entrega}
                      onChange={e => {
                        setCondForm(f => ({ ...f, prazo_entrega: e.target.value }));
                        setCondErrors(err => ({ ...err, prazo_entrega: false }));
                      }}
                      className={condErrors.prazo_entrega ? 'error' : ''}
                      placeholder="30 dias úteis"
                      disabled={condSubmitting}
                    />
                  </div>
                  <div className="field">
                    <label>Validade da Proposta *</label>
                    <input
                      type="text"
                      value={condForm.validade}
                      onChange={e => {
                        setCondForm(f => ({ ...f, validade: e.target.value }));
                        setCondErrors(err => ({ ...err, validade: false }));
                      }}
                      className={condErrors.validade ? 'error' : ''}
                      placeholder="30 dias"
                      disabled={condSubmitting}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>
                    Garantia{' '}
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      (opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={condForm.garantia}
                    onChange={e => setCondForm(f => ({ ...f, garantia: e.target.value }))}
                    placeholder="12 meses (opcional)"
                    disabled={condSubmitting}
                  />
                </div>
                {condFormMsg.text && (
                  <div className={`msg ${condFormMsg.type}`}>{condFormMsg.text}</div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={condSubmitting}>
                    {condSubmitting ? 'Salvando...' : (condEditingId ? 'Salvar alterações' : 'Criar condição')}
                  </button>
                  {condEditingId && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={condSubmitting}
                      onClick={() => {
                        setCondEditingId(null);
                        setCondForm(EMPTY_COND);
                        setCondErrors({});
                        setCondFormMsg({ type: '', text: '' });
                        setView('condMenu');
                      }}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ CONDIÇÕES LISTA ═══════════════════════════════════════════════════ */}
        {view === 'condList' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '18px', gap: '12px', flexWrap: 'wrap',
            }}>
              <button className="btn-back" onClick={() => setView('condMenu')}>← Voltar</button>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                Condições cadastradas
              </h2>
              <button
                onClick={goToCondCreate}
                style={{
                  padding: '5px 12px', fontSize: '12px', fontWeight: 700,
                  background: 'var(--green-bg)', color: 'var(--green)',
                  border: '1px dashed var(--green-light)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                + Nova condição
              </button>
            </div>
            <div className="card">
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  value={condSearchQ}
                  onChange={handleCondSearch}
                  placeholder="Buscar por nome ou forma de pagamento..."
                  autoComplete="off"
                  style={{
                    width: '100%', padding: '8px 12px', boxSizing: 'border-box',
                    border: '1px solid #ccc', borderRadius: 'var(--radius)',
                    fontSize: '13px', fontFamily: 'inherit',
                  }}
                />
              </div>
              {condLoading && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: '13px' }}>
                  Carregando...
                </div>
              )}
              {!condLoading && (
                <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                  {condList.length === 0
                    ? (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '13px' }}>
                        Nenhuma condição encontrada.
                      </div>
                    )
                    : condList.map(c => (
                      <CondItem
                        key={c.id}
                        item={c}
                        onEdit={() => goToCondEdit(c)}
                        onDelete={() => setDeleteCondConfirm({ id: c.id, name: c.name })}
                      />
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Modais de confirmação ──────────────────────────────────────────────── */}
      {deleteObjConfirm && (
        <ConfirmModal
          title="Excluir objeto"
          message={`Deseja excluir <strong>${deleteObjConfirm.nome}</strong>? Esta ação não pode ser desfeita.`}
          onConfirm={handleObjDelete}
          onCancel={() => setDeleteObjConfirm(null)}
        />
      )}
      {deleteCondConfirm && (
        <ConfirmModal
          title="Excluir condição"
          message={`Deseja excluir <strong>${deleteCondConfirm.name}</strong>? Esta ação não pode ser desfeita.`}
          onConfirm={handleCondDelete}
          onCancel={() => setDeleteCondConfirm(null)}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(t => ({ ...t, message: '' }))}
      />
    </>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SectionCard({ icon, title, desc, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hover ? 'var(--green-light)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '32px 28px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        textAlign: 'center',
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green)', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

function ObjItem({ item, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const desc = item.descricao
    ? item.descricao.substring(0, 70) + (item.descricao.length > 70 ? '...' : '')
    : '';
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius)',
        border: `1px solid ${hover ? 'var(--border)' : 'transparent'}`,
        background: hover ? 'var(--green-bg)' : 'transparent',
        marginBottom: '4px',
        transition: 'all 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{item.nome}</div>
          {desc && (
            <div style={{
              fontSize: '11px', color: 'var(--muted)', marginTop: '2px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {desc}
            </div>
          )}
        </div>
        {hover && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{
                padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                background: '#fff', color: 'var(--green)',
              }}
            >
              Editar
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{
                padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                border: '1px solid #ef9a9a', borderRadius: 'var(--radius)',
                background: '#fff', color: 'var(--danger)',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CondItem({ item, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const pills = [
    item.forma_pagamento,
    item.prazo_pagamento,
    item.prazo_entrega  && `Entrega: ${item.prazo_entrega}`,
    item.validade       && `Válida: ${item.validade}`,
    item.garantia       && `Garantia: ${item.garantia}`,
  ].filter(Boolean);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius)',
        border: `1px solid ${hover ? 'var(--border)' : 'transparent'}`,
        background: hover ? 'var(--green-bg)' : 'transparent',
        marginBottom: '4px',
        transition: 'all 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{item.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {pills.map((p, i) => (
              <span
                key={i}
                style={{
                  fontSize: '10px', padding: '2px 7px',
                  background: 'var(--green-bg)', border: '1px solid var(--border)',
                  borderRadius: '12px', color: 'var(--green)',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        {hover && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{
                padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                background: '#fff', color: 'var(--green)',
              }}
            >
              Editar
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{
                padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                border: '1px solid #ef9a9a', borderRadius: 'var(--radius)',
                background: '#fff', color: 'var(--danger)',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
