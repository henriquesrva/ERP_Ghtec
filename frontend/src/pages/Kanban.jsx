import { useState, useEffect, useCallback, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import Toast from '../components/shared/Toast';
import * as api from '../api/kanban';
import './Kanban.css';

// ─── Constantes ────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'pendente_envio',    label: 'Pendente Envio' },
  { key: 'enviado',           label: 'Enviado' },
  { key: 'aguardando_compra', label: 'Aguardando Compra' },
  { key: 'comprado',          label: 'Comprado' },
  { key: 'pendente_execucao', label: 'Pendente Execução' },
  { key: 'faturar',           label: 'Faturar' },
  { key: 'faturado',          label: 'Faturado' },
];
const COL_INDEX = Object.fromEntries(COLUMNS.map((c, i) => [c.key, i]));

// ─── Permissões (espelho do backend domain/kanban.js) ──────────────────────
function canMoveKanban(role, from, to) {
  if (role === 'user')  return false;
  if (role === 'admin') return true;
  const RC = new Set(['pendente_envio','enviado','aguardando_compra','comprado','pendente_execucao','faturar']);
  const RT = new Set(['aguardando_compra','comprado','pendente_execucao','faturar']);
  if (role === 'financeiro') return (from === 'faturar' && to === 'faturado') || (from === 'faturado' && to === 'faturar');
  if (role === 'comercial')  return RC.has(from) && to !== 'faturado';
  if (role === 'tecnico')    return RT.has(from) && to !== 'faturado';
  return false;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatBRL(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function daysInStatus(updatedAt) {
  if (!updatedAt) return 0;
  const str = updatedAt.includes('T') ? updatedAt : updatedAt.replace(' ', 'T') + 'Z';
  return Math.max(0, Math.floor((Date.now() - new Date(str).getTime()) / 86400000));
}

function daysBadgeClass(days) {
  if (days >= 14) return 'alert';
  if (days >= 7)  return 'warn';
  return '';
}

function pdfUrl(pdfPath) {
  if (!pdfPath) return null;
  const parts = pdfPath.replace(/\\/g, '/').split('/');
  return '/files/' + parts[parts.length - 1];
}

function fmtDate(s) {
  if (!s) return '—';
  return s.replace('T', ' ').substring(0, 16);
}

// ─── KbConfirm — confirm modal local com variantes de cor ─────────────────
function KbConfirm({ title, message, confirmLabel = 'Confirmar', confirmCls = 'kb-btn-warn', onConfirm, onCancel }) {
  return (
    <div className="kb-confirm-overlay" onClick={onCancel}>
      <div className="kb-confirm-box" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p dangerouslySetInnerHTML={{ __html: message }} />
        <div className="kb-confirm-actions">
          <button className="kb-btn kb-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className={`kb-btn ${confirmCls}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────
function KanbanCard({ card, colIdx, role, onMove, onOpenDrawer }) {
  const isFirst = colIdx === 0;
  const isLast  = colIdx === COLUMNS.length - 1;
  const prevKey = isFirst ? null : COLUMNS[colIdx - 1].key;

  let canNext;
  if (card.card_type === 'task') {
    canNext = false;
  } else if (card.kanban_status === 'enviado') {
    canNext = ['aguardando_compra','comprado','pendente_execucao','faturar']
      .some(d => canMoveKanban(role, 'enviado', d));
  } else {
    const nextKey = isLast ? null : COLUMNS[colIdx + 1].key;
    canNext = nextKey ? canMoveKanban(role, card.kanban_status, nextKey) : false;
  }
  const canPrev    = prevKey ? canMoveKanban(role, card.kanban_status, prevKey) : false;
  const disablePrev = isFirst || !canPrev;
  const disableNext = isLast  || !canNext;

  const days    = daysInStatus(card.kanban_status_updated_at);
  const daysCls = daysBadgeClass(days);
  const daysLabel = days === 1 ? '1 dia' : `${days} dias`;

  if (card.card_type === 'proposal') {
    const url = pdfUrl(card.pdf_path);
    const partsPreview = (() => {
      if (!card.items_preview) return null;
      const items = card.items_preview.split('|||').filter(Boolean);
      const hasMore = (card.items_count || 0) > 3;
      return (
        <div className="kb-card-meta">
          <span className="kb-card-parts">Peças: {items.join(', ')}{hasMore ? ' etc.' : ''}</span>
        </div>
      );
    })();

    return (
      <div className="kb-card" onClick={() => onOpenDrawer(card)}>
        <div className="kb-card-top">
          <span className="kb-card-num">#{card.title}</span>
          <span className={`kb-card-days${daysCls ? ' ' + daysCls : ''}`}>{daysLabel}</span>
        </div>
        <div className="kb-card-client">{card.cliente_nome || '—'}</div>
        <div className="kb-card-meta">
          <span className="kb-card-value">{formatBRL(card.total)}</span>
        </div>
        {partsPreview}
        <div className={`kb-exec-badge ${card.execution_completed ? 'done' : 'pending'}`}>
          {card.execution_completed ? '✓ Executada' : '⏳ Execução pendente'}
        </div>
        <div className="kb-card-footer">
          <button
            className="kb-btn-move"
            title="Voltar etapa"
            disabled={disablePrev}
            onClick={e => { e.stopPropagation(); onMove(card, -1); }}
          >
            ←
          </button>
          {url
            ? <a className="kb-btn-pdf" href={url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>📄 PDF</a>
            : <span className="kb-btn-pdf disabled">PDF indisponível</span>
          }
          <button
            className="kb-btn-move"
            title="Avançar etapa"
            disabled={disableNext}
            onClick={e => { e.stopPropagation(); onMove(card, +1); }}
          >
            →
          </button>
        </div>
      </div>
    );
  }

  // Tarefa avulsa
  return (
    <div className="kb-card is-task" onClick={() => onOpenDrawer(card)}>
      <div className="kb-card-top">
        <span className="kb-card-task-badge">Tarefa</span>
        <span className={`kb-card-days${daysCls ? ' ' + daysCls : ''}`}>{daysLabel}</span>
      </div>
      <div className="kb-card-client" style={{ marginBottom: 8 }}>{card.title}</div>
      {card.description && (
        <div className="kb-card-meta">
          <span>{card.description.length > 60 ? card.description.substring(0, 60) + '…' : card.description}</span>
        </div>
      )}
      <div className="kb-card-footer">
        <button
          className="kb-btn-move"
          title="Voltar etapa"
          disabled={disablePrev}
          onClick={e => { e.stopPropagation(); onMove(card, -1); }}
        >
          ←
        </button>
        <button className="kb-btn-detail" onClick={e => { e.stopPropagation(); onOpenDrawer(card); }}>
          Detalhes
        </button>
        <button
          className="kb-btn-move"
          title="Avançar etapa"
          disabled={disableNext}
          onClick={e => { e.stopPropagation(); onMove(card, +1); }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ─── KanbanDrawer ──────────────────────────────────────────────────────────
function KanbanDrawer({
  card, role,
  comments, commentsLoading,
  commentInput, setCommentInput, onSendComment,
  editing, editTitle, editDesc, setEditTitle, setEditDesc,
  onStartEdit, onCancelEdit, onSaveEdit,
  onDelete, onMarkExecution, onRemoveExecution,
  onLinkProposal,
  onClose,
}) {
  const colLabel = (COLUMNS.find(c => c.key === card.kanban_status) || {}).label || card.kanban_status;
  const isTask   = card.card_type === 'task';

  return (
    <>
      <div className="kb-drawer-overlay" onClick={onClose} />
      <div className="kb-drawer">
        <div className="kb-drawer-header">
          <h2>{isTask ? 'Detalhes da Tarefa' : `Proposta #${card.title}`}</h2>
          <button className="kb-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="kb-drawer-body">

          {/* ── Informações ── */}
          <div>
            <div className="kb-drawer-section">Informações</div>

            {isTask ? (
              <>
                {!editing ? (
                  <>
                    <div className="kb-drawer-field">
                      <div className="kb-drawer-field-label">Título</div>
                      <div className="kb-drawer-field-value">{card.title}</div>
                    </div>
                    <div className="kb-drawer-field">
                      <div className="kb-drawer-field-label">Descrição</div>
                      <div className="kb-drawer-field-value" style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>
                        {card.description || '—'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="kb-drawer-edit-area">
                    <div className="kb-form-group">
                      <label>Título *</label>
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                    </div>
                    <div className="kb-form-group">
                      <label>Descrição</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="kb-drawer-field">
                  <div className="kb-drawer-field-label">Etapa atual</div>
                  <div className="kb-drawer-field-value">{colLabel}</div>
                </div>
                <div className="kb-drawer-field">
                  <div className="kb-drawer-field-label">Criado em</div>
                  <div className="kb-drawer-field-value">{fmtDate(card.created_at)}</div>
                </div>

                <div className="kb-drawer-actions">
                  {!editing ? (
                    <button className="kb-btn kb-btn-green" onClick={onStartEdit}>Editar</button>
                  ) : (
                    <>
                      <button className="kb-btn kb-btn-green" onClick={onSaveEdit}>Salvar</button>
                      <button className="kb-btn kb-btn-ghost" onClick={onCancelEdit}>Cancelar</button>
                    </>
                  )}
                  {(role === 'admin' || role === 'comercial') && (
                    <button className="kb-btn kb-btn-green" onClick={onLinkProposal}>
                      Vincular à proposta
                    </button>
                  )}
                  {role === 'admin' && (
                    <button className="kb-btn kb-btn-danger" style={{ marginLeft: 'auto' }} onClick={onDelete}>
                      Excluir
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="kb-drawer-field">
                  <div className="kb-drawer-field-label">Cliente</div>
                  <div className="kb-drawer-field-value">{card.cliente_nome || '—'}</div>
                </div>
                <div className="kb-drawer-field">
                  <div className="kb-drawer-field-label">Valor total</div>
                  <div className="kb-drawer-field-value" style={{ color: 'var(--green)' }}>
                    {formatBRL(card.total)}
                  </div>
                </div>
                <div className="kb-drawer-field">
                  <div className="kb-drawer-field-label">Etapa atual</div>
                  <div className="kb-drawer-field-value">{colLabel}</div>
                </div>
                <div className="kb-drawer-field">
                  <div className="kb-drawer-field-label">Criado em</div>
                  <div className="kb-drawer-field-value">{fmtDate(card.created_at)}</div>
                </div>
                {(() => {
                  const url = pdfUrl(card.pdf_path);
                  return url
                    ? <a className="kb-btn kb-btn-green" href={url} target="_blank" rel="noopener" style={{ textDecoration: 'none', marginTop: 4 }}>📄 Ver PDF</a>
                    : <span style={{ fontSize: 12, color: 'var(--muted)' }}>PDF indisponível</span>;
                })()}
              </>
            )}
          </div>

          {/* ── Execução (só propostas) ── */}
          {!isTask && (
            <div>
              <div className="kb-drawer-section">Execução</div>
              <div className={`kb-exec-badge ${card.execution_completed ? 'done' : 'pending'}`} style={{ marginBottom: 10 }}>
                {card.execution_completed ? '✓ Proposta Executada' : '⏳ Execução pendente'}
              </div>

              {card.execution_completed ? (
                <>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Executado em</div>
                    <div className="kb-drawer-field-value">{card.execution_date || '—'}</div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Executado por</div>
                    <div className="kb-drawer-field-value">{card.executed_by || '—'}</div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">OS</div>
                    <div className="kb-drawer-field-value">{card.execution_os || '—'}</div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Detalhes</div>
                    <div className="kb-drawer-field-value" style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>
                      {card.execution_details || '—'}
                    </div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Marcado em</div>
                    <div className="kb-drawer-field-value">{fmtDate(card.execution_marked_at)}</div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Esta proposta ainda não foi marcada como executada.
                  Somente propostas executadas podem avançar para <strong>Faturar</strong>.
                </div>
              )}

              {(role === 'admin' || role === 'tecnico') && (
                <div style={{ marginTop: 6 }}>
                  {card.execution_completed
                    ? <button className="kb-btn kb-btn-warn" onClick={onRemoveExecution}>Remover execução</button>
                    : <button className="kb-btn kb-btn-green" onClick={onMarkExecution}>Marcar como executada</button>
                  }
                </div>
              )}
            </div>
          )}

          {/* ── Aprovação (só propostas) ── */}
          {!isTask && (
            <div>
              <div className="kb-drawer-section">Aprovação</div>
              {card.approval_registered_at ? (
                <>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Data de aprovação</div>
                    <div className="kb-drawer-field-value">{card.approval_date || '—'}</div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Informações</div>
                    <div className="kb-drawer-field-value" style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>
                      {card.approval_notes || '—'}
                    </div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Registrado em</div>
                    <div className="kb-drawer-field-value">{fmtDate(card.approval_registered_at)}</div>
                  </div>
                  {card.approval_attachment_path && (
                    <div className="kb-drawer-field">
                      <div className="kb-drawer-field-label">Anexo</div>
                      <div className="kb-drawer-field-value">
                        <a href={`/files/approvals/${card.approval_attachment_path}`} target="_blank" rel="noopener" style={{ color: 'var(--blue)' }}>
                          Ver anexo
                        </a>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhuma aprovação registrada.</div>
              )}
            </div>
          )}

          {/* ── Faturamento (só propostas) ── */}
          {!isTask && (
            <div>
              <div className="kb-drawer-section">Faturamento</div>
              {card.billed_at ? (
                <>
                  <div className="kb-billing-badge">✓ Faturado</div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Número da NF</div>
                    <div className="kb-drawer-field-value">{card.invoice_number || '—'}</div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Data de faturamento</div>
                    <div className="kb-drawer-field-value">{card.billing_date || '—'}</div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Observações</div>
                    <div className="kb-drawer-field-value" style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>
                      {card.billing_notes || '—'}
                    </div>
                  </div>
                  <div className="kb-drawer-field">
                    <div className="kb-drawer-field-label">Registrado em</div>
                    <div className="kb-drawer-field-value">{fmtDate(card.billed_at)}</div>
                  </div>
                </>
              ) : card.kanban_status === 'faturado' ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Faturado sem dados de NF registrados.</div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Proposta ainda não faturada.</div>
              )}
            </div>
          )}

          {/* ── Comentários ── */}
          <div>
            <div className="kb-drawer-section">Comentários</div>
            {commentsLoading ? (
              <p className="kb-no-comments">Carregando...</p>
            ) : comments === null ? (
              <p className="kb-no-comments" style={{ color: 'var(--danger)' }}>Erro ao carregar comentários.</p>
            ) : comments.length === 0 ? (
              <p className="kb-no-comments">Nenhum comentário ainda.</p>
            ) : (
              <>
                {comments.map((c, i) => (
                  <div key={i} className="kb-comment-item">
                    <div className="kb-comment-meta">
                      <span className="kb-comment-author">{c.user_nome}</span>
                      <span>{fmtDate(c.created_at)}</span>
                    </div>
                    <div className="kb-comment-text">{c.comment}</div>
                  </div>
                ))}
              </>
            )}
            <div className="kb-comment-input-area">
              <textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Escreva um comentário..."
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendComment(); } }}
              />
              <button className="kb-btn-send" onClick={onSendComment}>Enviar</button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── CreateTaskModal ──────────────────────────────────────────────────────
function CreateTaskModal({ onClose, onCreate, showToast }) {
  const [title, setTitle] = useState('');
  const [desc,  setDesc]  = useState('');

  async function handleCreate() {
    const t = title.trim();
    if (!t) { showToast('O título é obrigatório.'); return; }
    await onCreate(t, desc.trim() || null);
  }

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal-box" onClick={e => e.stopPropagation()}>
        <h3>Nova Tarefa</h3>
        <div className="kb-form-group">
          <label>Título *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da tarefa"
            autoFocus
          />
        </div>
        <div className="kb-form-group">
          <label>Descrição</label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Descrição (opcional)"
          />
        </div>
        <div className="kb-modal-actions">
          <button className="kb-btn kb-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="kb-btn kb-btn-green" onClick={handleCreate}>Criar Tarefa</button>
        </div>
      </div>
    </div>
  );
}

// ─── EnviadoDestinoModal ──────────────────────────────────────────────────
function EnviadoDestinoModal({ card, role, onClose, onSelect }) {
  const DEST_OPTIONS = [
    { key: 'aguardando_compra', label: 'Aguardando Compra' },
    { key: 'comprado',          label: 'Comprado' },
    { key: 'pendente_execucao', label: 'Pendente Execução' },
    { key: 'faturar',           label: 'Faturar' },
  ];
  const label = card.card_type === 'proposal' ? `Proposta #${card.title}` : `Tarefa: ${card.title}`;

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <h3>Avançar para qual etapa?</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
          <strong>{label}</strong> — escolha o destino:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {DEST_OPTIONS.map(o => {
            const hasPerm   = canMoveKanban(role, 'enviado', o.key);
            const needsExec = o.key === 'faturar' && !card.execution_completed;
            const ok     = hasPerm && !needsExec;
            const reason = !hasPerm ? '(sem permissão)' : needsExec ? '(execução necessária)' : '';
            return (
              <button
                key={o.key}
                className="kb-btn-dest"
                disabled={!ok}
                onClick={() => onSelect(card, o.key)}
              >
                {o.label}
                {reason && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 6 }}>{reason}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ textAlign: 'right' }}>
          <button className="kb-btn kb-btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── ApprovalModal ────────────────────────────────────────────────────────
function ApprovalModal({ card, destination, onClose, onConfirm, showToast }) {
  const [dateVal,  setDateVal]  = useState('');
  const [notesVal, setNotesVal] = useState('');
  const fileRef = useRef(null);

  async function handleSave() {
    const fd = new FormData();
    if (dateVal)                    fd.append('approval_date',  dateVal);
    if (notesVal.trim())            fd.append('approval_notes', notesVal.trim());
    if (fileRef.current?.files[0]) fd.append('attachment',     fileRef.current.files[0]);
    await onConfirm(card, destination, fd);
  }

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal-box" onClick={e => e.stopPropagation()}>
        <h3>A proposta foi aprovada?</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
          Proposta #{card.title} — informe os dados da aprovação antes de mover o card.
        </p>
        <div className="kb-form-group">
          <label>Data de aprovação</label>
          <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} />
        </div>
        <div className="kb-form-group">
          <label>Informações sobre aprovação</label>
          <textarea
            value={notesVal}
            onChange={e => setNotesVal(e.target.value)}
            placeholder="Detalhes da aprovação (opcional)"
          />
        </div>
        <div className="kb-form-group">
          <label>Anexo / print (opcional)</label>
          <input type="file" ref={fileRef} accept="image/*" />
        </div>
        <div className="kb-modal-actions">
          <button className="kb-btn kb-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="kb-btn kb-btn-green" onClick={handleSave}>Confirmar e mover</button>
        </div>
      </div>
    </div>
  );
}

// ─── BillingModal ─────────────────────────────────────────────────────────
function BillingModal({ card, onClose, onConfirm, showToast }) {
  const [nf,    setNf]    = useState('');
  const [date,  setDate]  = useState('');
  const [notes, setNotes] = useState('');
  const [nfErr, setNfErr] = useState(false);

  async function handleSave() {
    if (!nf.trim()) {
      setNfErr(true);
      showToast('O número da NF é obrigatório.');
      return;
    }
    await onConfirm(card, nf.trim(), date || null, notes.trim() || null);
  }

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal-box" onClick={e => e.stopPropagation()}>
        <h3>Registrar Faturamento</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
          Proposta #{card.title} — preencha os dados do faturamento antes de mover o card.
        </p>
        <div className="kb-form-group">
          <label>Número da NF <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            type="text"
            value={nf}
            onChange={e => { setNf(e.target.value); setNfErr(false); }}
            placeholder="Número da Nota Fiscal (obrigatório)"
            style={nfErr ? { borderColor: 'var(--danger)' } : {}}
            autoFocus
          />
        </div>
        <div className="kb-form-group">
          <label>Data de faturamento</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="kb-form-group">
          <label>Observações</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observações sobre o faturamento (opcional)"
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
          (*) Campo obrigatório. A proposta não será movida sem o número da NF.
        </p>
        <div className="kb-modal-actions">
          <button className="kb-btn kb-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="kb-btn kb-btn-green" onClick={handleSave}>Confirmar e faturar</button>
        </div>
      </div>
    </div>
  );
}

// ─── ExecutionModal ───────────────────────────────────────────────────────
function ExecutionModal({ card, onClose, onConfirm }) {
  const [date,    setDate]    = useState('');
  const [by,      setBy]      = useState('');
  const [os,      setOs]      = useState('');
  const [details, setDetails] = useState('');

  async function handleSave() {
    await onConfirm({
      execution_date:    date           || null,
      executed_by:       by.trim()      || null,
      execution_os:      os.trim()      || null,
      execution_details: details.trim() || null,
    });
  }

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal-box" onClick={e => e.stopPropagation()}>
        <h3>Marcar como executada</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>Proposta #{card.title}</p>
        <div className="kb-form-group">
          <label>Executado em</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus />
        </div>
        <div className="kb-form-group">
          <label>Executado por</label>
          <input type="text" value={by} onChange={e => setBy(e.target.value)} placeholder="Nome do responsável pela execução" />
        </div>
        <div className="kb-form-group">
          <label>OS</label>
          <input type="text" value={os} onChange={e => setOs(e.target.value)} placeholder="Número da Ordem de Serviço" />
        </div>
        <div className="kb-form-group">
          <label>Detalhes da execução</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Observações sobre a execução (opcional)" />
        </div>
        <div className="kb-modal-actions">
          <button className="kb-btn kb-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="kb-btn kb-btn-green" onClick={handleSave}>Confirmar execução</button>
        </div>
      </div>
    </div>
  );
}

// ─── LinkProposalModal ────────────────────────────────────────────────────
function LinkProposalModal({ task, proposalCards, onClose, onConfirmLink }) {
  const [filter,     setFilter]     = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = proposalCards.filter(p => {
    const f = filter.toLowerCase();
    return !f
      || (p.title        || '').toLowerCase().includes(f)
      || (p.cliente_nome || '').toLowerCase().includes(f);
  });

  const selected = proposalCards.find(p => p.id === selectedId);

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal-box" style={{ maxWidth: 600, width: '95%' }} onClick={e => e.stopPropagation()}>
        <h3>Vincular à proposta</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
          Selecione uma proposta para vincular a tarefa <strong>"{task.title}"</strong>.
          O card avulso será removido e as informações serão registradas no chat da proposta selecionada.
        </p>
        <div className="kb-form-group">
          <label>Filtrar propostas</label>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Digite número ou cliente para filtrar..."
            autoFocus
          />
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
              Nenhuma proposta encontrada.
            </div>
          ) : filtered.map(p => {
            const colLabel = (COLUMNS.find(c => c.key === p.kanban_status) || {}).label || p.kanban_status;
            return (
              <div key={p.id} className="kb-link-prop-item" onClick={() => setSelectedId(p.id)}>
                <input
                  type="radio"
                  name="linkProp"
                  value={p.id}
                  checked={selectedId === p.id}
                  onChange={() => setSelectedId(p.id)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <div style={{ flex: 1, lineHeight: 1.4, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, color: 'var(--green)' }}>#{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{p.cliente_nome || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatBRL(p.total)} · {colLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
            Selecionada: Proposta #{selected.title} — {selected.cliente_nome || '—'}
          </div>
        )}

        <div className="kb-modal-actions" style={{ marginTop: 14 }}>
          <button className="kb-btn kb-btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="kb-btn kb-btn-green"
            disabled={!selectedId}
            onClick={() => selected && onConfirmLink(task.id, selectedId, selected.title)}
          >
            Confirmar vinculação
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban (página principal) ─────────────────────────────────────────────
export default function Kanban() {
  const { user } = useAuth();
  const role = user?.role || 'user';

  const [cards,      setCards]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [toast,      setToast]      = useState({ message: '', type: 'success' });

  // Drawer: referência ao card aberto (dados derivados de `cards`)
  const [drawerRef,   setDrawerRef]   = useState(null); // { id, card_type }
  const drawerCard = drawerRef
    ? cards.find(c => c.id === drawerRef.id && c.card_type === drawerRef.card_type) || null
    : null;

  // Estado de edição de tarefa no drawer
  const [drawerEditing, setDrawerEditing] = useState(false);
  const [editTitle,     setEditTitle]     = useState('');
  const [editDesc,      setEditDesc]      = useState('');

  // Comentários
  const [comments,        setComments]        = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput,    setCommentInput]     = useState('');

  // Modal (um de cada vez): { type, ...dados }
  const [modal, setModal] = useState(null);

  const showToast = useCallback((msg, type = 'error') => setToast({ message: msg, type }), []);

  // ── Carregar cards ─────────────────────────────────────────────────────
  useEffect(() => {
    api.getCards()
      .then(data => {
        setCards(data);
        setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // ── Carregar comentários quando o drawer abre ─────────────────────────
  const loadComments = useCallback((cardType, cardId) => {
    setCommentsLoading(true);
    api.getComments(cardType, cardId)
      .then(list => setComments(Array.isArray(list) ? list : []))
      .catch(() => setComments(null))
      .finally(() => setCommentsLoading(false));
  }, []);

  useEffect(() => {
    if (!drawerRef) { setComments([]); return; }
    const card = cards.find(c => c.id === drawerRef.id && c.card_type === drawerRef.card_type);
    if (card) loadComments(card.card_type, card.id);
  }, [drawerRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mover card ─────────────────────────────────────────────────────────
  async function doMoveCard(card, targetStatus) {
    if (card.card_type === 'proposal' && targetStatus === 'faturar' && !card.execution_completed) {
      showToast('Esta proposta precisa ser marcada como executada antes de ir para Faturar.');
      return;
    }
    try {
      if (card.card_type === 'proposal') {
        await api.moveProposal(card.id, targetStatus);
      } else {
        await api.moveTask(card.id, targetStatus);
      }
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setCards(prev => prev.map(c =>
        c.id === card.id && c.card_type === card.card_type
          ? { ...c, kanban_status: targetStatus, kanban_status_updated_at: now }
          : c
      ));
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      if (err.data?.code === 'EXECUTION_REQUIRED') {
        showToast('Esta proposta precisa ser marcada como executada antes de ir para Faturar.');
      } else {
        showToast(err.message || 'Erro ao mover card.');
      }
    }
  }

  function handleMoveCard(card, direction) {
    if (card.card_type === 'task' && direction === +1) {
      showToast('Cards avulsos não podem ser enviados. Vincule este card a uma proposta antes de avançar.');
      return;
    }
    const currentIdx = COL_INDEX[card.kanban_status] ?? 0;

    if (card.kanban_status === 'enviado' && direction === +1) {
      const hasAnyPerm = ['aguardando_compra','comprado','pendente_execucao','faturar']
        .some(d => canMoveKanban(role, 'enviado', d));
      if (!hasAnyPerm) { showToast('Você não tem permissão para fazer esse movimento.'); return; }
      setModal({ type: 'enviadoDestino', card });
      return;
    }

    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= COLUMNS.length) return;
    const targetStatus = COLUMNS[targetIdx].key;
    const targetLabel  = COLUMNS[targetIdx].label;

    if (!canMoveKanban(role, card.kanban_status, targetStatus)) {
      showToast('Você não tem permissão para fazer esse movimento.');
      return;
    }

    if (direction === -1) {
      const name = card.card_type === 'proposal' ? `proposta #${card.title}` : `tarefa "${card.title}"`;
      setModal({
        type: 'confirm',
        title: 'Voltar etapa',
        message: `Deseja voltar a ${name} para <strong>${targetLabel}</strong>?`,
        confirmLabel: 'Confirmar',
        confirmCls: 'kb-btn-warn',
        onConfirm: () => { setModal(null); doMoveCard(card, targetStatus); },
      });
    } else if (card.card_type === 'proposal' && targetStatus === 'faturado') {
      setModal({ type: 'billing', card });
    } else {
      doMoveCard(card, targetStatus);
    }
  }

  // ── Abrir drawer ──────────────────────────────────────────────────────
  function openDrawer(card) {
    setDrawerRef({ id: card.id, card_type: card.card_type });
    setDrawerEditing(false);
    setEditTitle(card.title || '');
    setEditDesc(card.description || '');
    setCommentInput('');
  }

  // ── Comentários ───────────────────────────────────────────────────────
  async function handleSendComment() {
    if (!drawerCard || !commentInput.trim()) return;
    try {
      await api.addComment(drawerCard.card_type, drawerCard.id, commentInput.trim());
      setCommentInput('');
      loadComments(drawerCard.card_type, drawerCard.id);
    } catch (err) {
      showToast(err.message || 'Erro ao enviar comentário.');
    }
  }

  // ── Criar tarefa ──────────────────────────────────────────────────────
  async function handleCreateTask(title, description) {
    try {
      const data = await api.createTask(title, description);
      const t = data.task;
      setCards(prev => [...prev, {
        card_type: 'task', id: t.id, title: t.title, description: t.description,
        kanban_status: t.kanban_status, kanban_status_updated_at: t.kanban_status_updated_at,
        created_at: t.created_at, created_by: t.created_by,
        cliente_nome: null, total: null, pdf_path: null,
      }]);
      setModal(null);
      showToast('Tarefa criada com sucesso.', 'success');
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      showToast(err.message || 'Erro ao criar tarefa.');
    }
  }

  // ── Editar tarefa ─────────────────────────────────────────────────────
  async function handleSaveTaskEdit() {
    if (!drawerCard) return;
    const title = editTitle.trim();
    if (!title) { showToast('O título é obrigatório.'); return; }
    try {
      const data = await api.updateTask(drawerCard.id, title, editDesc.trim() || null);
      setCards(prev => prev.map(c =>
        c.id === drawerCard.id && c.card_type === 'task'
          ? { ...c, title: data.task.title, description: data.task.description }
          : c
      ));
      setDrawerEditing(false);
      showToast('Tarefa atualizada.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar.');
    }
  }

  // ── Excluir tarefa ────────────────────────────────────────────────────
  async function handleDeleteTask() {
    if (!drawerCard) return;
    const { id } = drawerCard;
    try {
      await api.deleteTask(id);
      setCards(prev => prev.filter(c => !(c.id === id && c.card_type === 'task')));
      setDrawerRef(null);
      setModal(null);
      showToast('Tarefa excluída.', 'success');
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      showToast(err.message || 'Erro ao excluir.');
    }
  }

  // ── Execução ──────────────────────────────────────────────────────────
  async function handleMarkExecution(body) {
    if (!drawerCard) return;
    try {
      const data = await api.markExecution(drawerCard.id, body);
      setCards(prev => prev.map(c =>
        c.id === drawerCard.id && c.card_type === 'proposal' ? { ...c, ...data.execution } : c
      ));
      setModal(null);
      showToast('Proposta marcada como executada.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao marcar execução.');
    }
  }

  async function handleRemoveExecution() {
    if (!drawerCard) return;
    const cardId = drawerCard.id;
    try {
      const data = await api.removeExecution(cardId);
      const patch = {
        execution_completed: 0, execution_date: null, executed_by: null,
        execution_os: null, execution_details: null, execution_marked_at: null,
      };
      if (data.autoMoved) {
        patch.kanban_status = data.newStatus;
        patch.kanban_status_updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      }
      setCards(prev => prev.map(c =>
        c.id === cardId && c.card_type === 'proposal' ? { ...c, ...patch } : c
      ));
      setModal(null);
      showToast(
        data.autoMoved ? 'Execução removida. Proposta retornou para Pendente Execução.' : 'Selo de execução removido.',
        'success'
      );
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      showToast(err.message || 'Erro ao remover execução.');
    }
  }

  // ── Aprovação ─────────────────────────────────────────────────────────
  async function handleApproval(card, destination, formData) {
    try {
      const data = await api.registerApproval(card.id, formData);
      setCards(prev => prev.map(c =>
        c.id === card.id && c.card_type === 'proposal' ? { ...c, ...data.approval } : c
      ));
      setModal(null);
      await doMoveCard({ ...card, ...data.approval }, destination);
    } catch (err) {
      showToast(err.message || 'Erro ao registrar aprovação.');
    }
  }

  // ── Faturamento ───────────────────────────────────────────────────────
  async function handleBilling(card, invoiceNumber, billingDate, billingNotes) {
    try {
      const data = await api.registerBilling(card.id, {
        invoice_number: invoiceNumber,
        billing_date:   billingDate,
        billing_notes:  billingNotes,
      });
      const now   = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const patch = { kanban_status: 'faturado', kanban_status_updated_at: now, ...data.billing };
      setCards(prev => prev.map(c =>
        c.id === card.id && c.card_type === 'proposal' ? { ...c, ...patch } : c
      ));
      setModal(null);
      showToast('Faturamento registrado. Proposta movida para Faturado.', 'success');
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      showToast(err.message || 'Erro ao registrar faturamento.');
    }
  }

  // ── Vincular tarefa a proposta ────────────────────────────────────────
  async function handleLinkTask(taskId, proposalId) {
    try {
      await api.linkTaskToProposal(taskId, proposalId);
      setCards(prev => prev.filter(c => !(c.id === taskId && c.card_type === 'task')));
      setDrawerRef(null);
      setModal(null);
      showToast('Tarefa vinculada com sucesso. O chat da proposta foi atualizado.', 'success');
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      showToast(err.message || 'Erro ao vincular tarefa.');
    }
  }

  // ── Agrupar cards por coluna ──────────────────────────────────────────
  const groups = {};
  COLUMNS.forEach(c => { groups[c.key] = []; });
  cards.forEach(c => {
    const key = c.kanban_status || 'pendente_envio';
    if (groups[key]) groups[key].push(c);
  });

  // ── Render ────────────────────────────────────────────────────────────
  if (loading)   return <div className="kb-loading">Carregando...</div>;
  if (loadError) return <div className="kb-error">Erro ao carregar. Recarregue a página.</div>;

  return (
    <>
      <div className="page-bar">
        <div>
          <h1>Kanban</h1>
          Propostas e tarefas em andamento
        </div>
        <div className="kb-page-bar-right">
          {lastUpdate && <span className="kb-page-bar-ts">Atualizado: {lastUpdate}</span>}
          <button className="kb-btn-create-task" onClick={() => setModal({ type: 'createTask' })}>
            + Nova Tarefa
          </button>
        </div>
      </div>

      <div className="kb-board-wrap">
        <div className="kb-board">
          {COLUMNS.map((col, colIdx) => {
            const colCards = groups[col.key] || [];
            return (
              <div key={col.key} className="kb-col">
                <div className="kb-col-header">
                  <span className="kb-col-label">{col.label}</span>
                  <span className="kb-col-count">{colCards.length}</span>
                </div>
                <div className="kb-col-cards">
                  {colCards.length === 0
                    ? <div className="kb-col-empty">Nenhum card</div>
                    : colCards.map(card => (
                      <KanbanCard
                        key={`${card.card_type}-${card.id}`}
                        card={card}
                        colIdx={colIdx}
                        role={role}
                        onMove={handleMoveCard}
                        onOpenDrawer={openDrawer}
                      />
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer */}
      {drawerCard && (
        <KanbanDrawer
          card={drawerCard}
          role={role}
          comments={comments}
          commentsLoading={commentsLoading}
          commentInput={commentInput}
          setCommentInput={setCommentInput}
          onSendComment={handleSendComment}
          editing={drawerEditing}
          editTitle={editTitle}
          editDesc={editDesc}
          setEditTitle={setEditTitle}
          setEditDesc={setEditDesc}
          onStartEdit={() => setDrawerEditing(true)}
          onCancelEdit={() => {
            setDrawerEditing(false);
            setEditTitle(drawerCard.title || '');
            setEditDesc(drawerCard.description || '');
          }}
          onSaveEdit={handleSaveTaskEdit}
          onDelete={() => setModal({
            type: 'confirm',
            title: 'Excluir tarefa',
            message: `Deseja excluir a tarefa "<strong>${drawerCard.title}</strong>"? Esta ação não pode ser desfeita.`,
            confirmLabel: 'Excluir',
            confirmCls: 'kb-btn-danger',
            onConfirm: () => { setModal(null); handleDeleteTask(); },
          })}
          onMarkExecution={() => setModal({ type: 'execution', card: drawerCard })}
          onRemoveExecution={() => {
            const willAutoMove = drawerCard.kanban_status === 'faturar' || drawerCard.kanban_status === 'faturado';
            setModal({
              type: 'confirm',
              title: 'Remover execução',
              message: 'Tem certeza que deseja remover o selo de proposta executada?' +
                (willAutoMove ? ' A proposta retornará automaticamente para <strong>Pendente Execução</strong>.' : ''),
              confirmLabel: 'Remover',
              confirmCls: 'kb-btn-warn',
              onConfirm: () => { setModal(null); handleRemoveExecution(); },
            });
          }}
          onLinkProposal={() => setModal({ type: 'linkProposal', task: drawerCard })}
          onClose={() => setDrawerRef(null)}
        />
      )}

      {/* Modais */}
      {modal?.type === 'confirm' && (
        <KbConfirm
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          confirmCls={modal.confirmCls}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'createTask' && (
        <CreateTaskModal
          onClose={() => setModal(null)}
          onCreate={handleCreateTask}
          showToast={showToast}
        />
      )}

      {modal?.type === 'enviadoDestino' && (
        <EnviadoDestinoModal
          card={modal.card}
          role={role}
          onClose={() => setModal(null)}
          onSelect={(card, dest) => {
            if (card.card_type === 'proposal') {
              setModal({ type: 'approval', card, destination: dest });
            } else {
              setModal(null);
              doMoveCard(card, dest);
            }
          }}
        />
      )}

      {modal?.type === 'approval' && (
        <ApprovalModal
          card={modal.card}
          destination={modal.destination}
          onClose={() => setModal(null)}
          onConfirm={handleApproval}
          showToast={showToast}
        />
      )}

      {modal?.type === 'billing' && (
        <BillingModal
          card={modal.card}
          onClose={() => setModal(null)}
          onConfirm={handleBilling}
          showToast={showToast}
        />
      )}

      {modal?.type === 'execution' && (
        <ExecutionModal
          card={modal.card}
          onClose={() => setModal(null)}
          onConfirm={handleMarkExecution}
        />
      )}

      {modal?.type === 'linkProposal' && (
        <LinkProposalModal
          task={modal.task}
          proposalCards={cards.filter(c => c.card_type === 'proposal')}
          onClose={() => setModal(null)}
          onConfirmLink={(taskId, proposalId, proposalTitle) => {
            const taskTitle = modal.task.title;
            setModal({
              type: 'confirm',
              title: 'Confirmar vinculação',
              message: `Deseja vincular a tarefa <strong>"${taskTitle}"</strong> à proposta <strong>#${proposalTitle}</strong>?<br><br>O card avulso será removido e um registro será adicionado ao chat da proposta.`,
              confirmLabel: 'Vincular',
              confirmCls: 'kb-btn-green',
              onConfirm: () => handleLinkTask(taskId, proposalId),
            });
          }}
        />
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '' })}
      />
    </>
  );
}
