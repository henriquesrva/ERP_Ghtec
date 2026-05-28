import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { listProposals } from '../api/proposals';
import { getStockParts } from '../api/stock';

// ── Ícones SVG ─────────────────────────────────────────────────────────────────

function IcDoc({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IcPlus({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  );
}

function IcKanban({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="12" rx="1"/>
      <rect x="17" y="3" width="5" height="8" rx="1"/>
    </svg>
  );
}

function IcUsers({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IcWrench({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

function IcBox({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}

function IcTruck({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}

function IcAlert({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function IcCheck({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IcClock({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IcArrow({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

// ── Utilitários ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function roleLabel(role) {
  const map = { admin: 'Admin', user: 'Usuário', comercial: 'Comercial', tecnico: 'Técnico', financeiro: 'Financeiro' };
  return map[role] ?? role;
}

// Mapeamento de status do Kanban para exibição nas propostas recentes
const KANBAN_LABELS = {
  pendente_envio:    'Pendente Envio',
  enviado:           'Enviado',
  aguardando_compra: 'Ag. Compra',
  comprado:          'Comprado',
  pendente_execucao: 'Pend. Execução',
  faturar:           'Para Faturar',
  faturado:          'Faturado',
};

const KANBAN_TAG = {
  pendente_envio:    'tag-muted',
  enviado:           'tag-info',
  aguardando_compra: 'tag-warn',
  comprado:          'tag-ok',
  pendente_execucao: 'tag-warn',
  faturar:           'tag-info',
  faturado:          'tag-ok',
};

// ── Atalhos de acesso rápido ───────────────────────────────────────────────────

const ACTIONS_SECONDARY = [
  { icon: IcDoc,    label: 'Propostas',    desc: 'Histórico e gestão de propostas',  to: '/proposals'    },
  { icon: IcKanban, label: 'Kanban',       desc: 'Pipeline operacional',              to: '/kanban'       },
  { icon: IcUsers,  label: 'Clientes',     desc: 'Cadastro de clientes',              to: '/clients'      },
  { icon: IcWrench, label: 'Peças',        desc: 'Catálogo e preços',                 to: '/parts'        },
  { icon: IcBox,    label: 'Estoque',      desc: 'Entradas, saídas e inventário',     to: '/stock'        },
  { icon: IcTruck,  label: 'Fornecedores', desc: 'Cadastro e notas recebidas',        to: '/fornecedores' },
];

// ── Componente principal ───────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [kpis, setKpis]            = useState(null);
  const [pendencias, setPendencias] = useState(null);
  const [recentes, setRecentes]     = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [proposalsRes, stockRes] = await Promise.allSettled([
        listProposals(),
        getStockParts(),
      ]);

      if (cancelled) return;

      // ── Propostas ────────────────────────────────────────────────────
      const proposals        = proposalsRes.status === 'fulfilled' ? (proposalsRes.value ?? []) : [];
      const emAndamento      = proposals.filter(p => p.kanban_status !== 'faturado');
      const aguardandoCompra = proposals.filter(p => p.kanban_status === 'aguardando_compra');
      const pendenteExec     = proposals.filter(p => p.kanban_status === 'pendente_execucao');
      const paraFaturar      = proposals.filter(p => p.kanban_status === 'faturar');

      // ── Atividade recente: 5 propostas mais novas ─────────────────────
      const recentProposals = [...proposals]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(p => ({
          id:     p.id,
          label:  `Proposta ${p.numero_proposta}`,
          sub:    p.cliente_nome ?? '—',
          status: p.kanban_status,
          date:   p.created_at,
          to:     '/proposals',
        }));

      setRecentes(recentProposals);

      // ── Estoque ───────────────────────────────────────────────────────
      const stock          = stockRes.status === 'fulfilled' ? (stockRes.value ?? []) : [];
      const estoqueCritico = stock.filter(p => (p.stock_quantity ?? 0) <= 0);

      setKpis({
        em_andamento:      emAndamento.length,
        aguardando_compra: aguardandoCompra.length,
        pendente_execucao: pendenteExec.length,
        para_faturar:      paraFaturar.length,
        estoque_critico:   estoqueCritico.length,
      });

      setPendencias({
        aguardando_compra: aguardandoCompra.slice(0, 6),
        pendente_execucao: pendenteExec.slice(0, 6),
        para_faturar:      paraFaturar.slice(0, 6),
        estoque_critico:   estoqueCritico.slice(0, 6),
      });

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const totalPendencias = pendencias
    ? pendencias.aguardando_compra.length
      + pendencias.pendente_execucao.length
      + pendencias.para_faturar.length
      + pendencias.estoque_critico.length
    : null;

  return (
    <div className="dash-root">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="dash-hero">
        <div className="dash-hero-inner">
          <div>
            <p className="dash-welcome">
              Bom dia, <strong>{user?.nome ?? '…'}</strong>
            </p>
            <p className="dash-date">{today}</p>
          </div>
          <div className="dash-hero-meta">
            {role && <span className="dash-role-pill">{roleLabel(role)}</span>}
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="dash-body">

        {/* ── KPIs ─────────────────────────────────────────────────── */}
        <section className="dash-section">
          <p className="dash-section-label">Situação da operação</p>
          <div className="dash-kpi-row">

            <StatCard
              label="Propostas em andamento"
              value={kpis?.em_andamento}
              hint="Não faturadas"
              to="/proposals"
              tone="neutral"
            />
            <StatCard
              label="Aguardando compra"
              value={kpis?.aguardando_compra}
              hint="Em acompanhamento"
              to="/kanban"
              tone={kpis?.aguardando_compra > 0 ? 'warn' : 'neutral'}
            />
            <StatCard
              label="Pendente execução"
              value={kpis?.pendente_execucao}
              hint="Em acompanhamento"
              to="/kanban"
              tone={kpis?.pendente_execucao > 0 ? 'warn' : 'neutral'}
            />
            <StatCard
              label="Pronto para faturamento"
              value={kpis?.para_faturar}
              hint="Aguardam emissão de NF"
              to="/kanban"
              tone={kpis?.para_faturar > 0 ? 'info' : 'neutral'}
            />
            <StatCard
              label="Peças críticas"
              value={kpis?.estoque_critico}
              hint="Estoque zerado"
              to="/stock"
              tone={kpis?.estoque_critico > 0 ? 'danger' : 'neutral'}
            />

          </div>
        </section>

        {/* ── Corpo principal ───────────────────────────────────────── */}
        <div className="dash-main">

          {/* ── Coluna esquerda: atalhos + recentes ─────────────────── */}
          <div className="dash-left">

            {/* CTA principal */}
            <section className="dash-section">
              <Link to="/nova-proposta" className="dash-cta-card">
                <span className="dash-cta-icon"><IcPlus size={26} /></span>
                <div className="dash-cta-text">
                  <span className="dash-cta-label">Nova proposta comercial</span>
                  <span className="dash-cta-desc">Criar proposta, gerar PDF e acompanhar no Kanban</span>
                </div>
                <span className="dash-cta-arrow"><IcArrow size={18} /></span>
              </Link>
            </section>

            {/* Acesso rápido */}
            <section className="dash-section">
              <p className="dash-section-label">Acesso rápido</p>
              <div className="dash-actions-grid">
                {ACTIONS_SECONDARY.map(({ icon: Icon, label, desc, to }) => (
                  <Link key={label} to={to} className="dash-action-card">
                    <span className="dash-action-icon"><Icon size={18} /></span>
                    <span className="dash-action-label">{label}</span>
                    <span className="dash-action-desc">{desc}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Propostas recentes */}
            <section className="dash-section">
              <p className="dash-section-label">Propostas recentes</p>
              <div className="dash-recentes">
                {loading && (
                  <p className="dash-recentes-empty">Carregando…</p>
                )}
                {!loading && recentes?.length === 0 && (
                  <p className="dash-recentes-empty">Nenhuma proposta encontrada.</p>
                )}
                {!loading && recentes?.map(ev => (
                  <Link key={ev.id} to={ev.to} className="dash-recente-item">
                    <span className="dash-recente-icon"><IcDoc size={14} /></span>
                    <span className="dash-recente-label">
                      <span className="dash-recente-label-text">{ev.label}</span>
                      {ev.status && (
                        <span className={`dash-recente-status tag ${KANBAN_TAG[ev.status] ?? 'tag-muted'}`}>
                          {KANBAN_LABELS[ev.status] ?? ev.status}
                        </span>
                      )}
                    </span>
                    <span className="dash-recente-sub">{ev.sub}</span>
                    <span className="dash-recente-time">
                      <IcClock size={11} />&nbsp;{timeAgo(ev.date)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

          </div>

          {/* ── Coluna direita: fila de atenção ─────────────────────── */}
          <aside className="dash-right">
            <section className="dash-section">
              <p className="dash-section-label">
                Exigem atenção
                {totalPendencias != null && totalPendencias > 0 && (
                  <span className="dash-atencao-count">{totalPendencias}</span>
                )}
              </p>

              {loading && (
                <p className="dash-pend-empty">Carregando…</p>
              )}

              {!loading && totalPendencias === 0 && (
                <div className="dash-pend-ok">
                  <IcCheck size={14} />
                  <span>Tudo em ordem</span>
                </div>
              )}

              {!loading && totalPendencias > 0 && (
                <div className="dash-pend-list">

                  <AttentionGroup
                    title="Aguardando compra"
                    items={pendencias.aguardando_compra}
                    to="/kanban"
                    tone="warn"
                    renderItem={p => ({ primary: p.numero_proposta, secondary: p.cliente_nome })}
                  />
                  <AttentionGroup
                    title="Pendente de execução"
                    items={pendencias.pendente_execucao}
                    to="/kanban"
                    tone="warn"
                    renderItem={p => ({ primary: p.numero_proposta, secondary: p.cliente_nome })}
                  />
                  <AttentionGroup
                    title="Prontas para faturar"
                    items={pendencias.para_faturar}
                    to="/kanban"
                    tone="info"
                    renderItem={p => ({ primary: p.numero_proposta, secondary: p.cliente_nome })}
                  />
                  <AttentionGroup
                    title="Estoque crítico"
                    items={pendencias.estoque_critico}
                    to="/stock"
                    tone="danger"
                    renderItem={p => ({ primary: p.nome, secondary: p.codigo_interno })}
                  />

                </div>
              )}
            </section>
          </aside>

        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, to, tone = 'neutral' }) {
  const isLoading = value === undefined || value === null;
  return (
    <Link to={to} className={`dash-stat-card dash-stat-${tone}`}>
      <span className="dash-stat-label">{label}</span>
      <span className="dash-stat-value">{isLoading ? '—' : value}</span>
      <span className="dash-stat-hint">{hint}</span>
    </Link>
  );
}

function AttentionGroup({ title, items, to, tone, renderItem }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`dash-atg dash-atg-${tone}`}>
      <div className="dash-atg-header">
        <span className="dash-atg-icon"><IcAlert size={13} /></span>
        <span className="dash-atg-title">{title}</span>
        <Link to={to} className="dash-atg-link">
          Ver todos <IcArrow size={11} />
        </Link>
      </div>
      <ul className="dash-atg-items">
        {items.map((item, i) => {
          const { primary, secondary } = renderItem(item);
          return (
            <li key={item.id ?? i} className="dash-atg-item">
              <span className="dash-atg-primary">{primary}</span>
              {secondary && <span className="dash-atg-secondary">{secondary}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
