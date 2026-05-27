import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { getResumo } from '../api/financeiro';

ChartJS.register(ArcElement, Tooltip, Legend);

// ── Utilitários ────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}

function fmtMoeda(v) {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function mesAtual() {
  const agora = new Date();
  return `${agora.toLocaleString('pt-BR', { month: 'long' })} ${agora.getFullYear()}`;
}

const BASE_COLORS = [
  '#2e7d32', '#1565c0', '#f57f17', '#c62828', '#6a1b9a',
  '#00838f', '#558b2f', '#4e342e', '#37474f', '#ad1457',
];

function generateColors(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(BASE_COLORS[i % BASE_COLORS.length]);
  return out;
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function KpiCard({ mod, label, value, sub }) {
  return (
    <div className={`kpi-card kpi-${mod}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function ProxVencimentos({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="empty-state">Nenhum vencimento próximo.</div>;
  }
  return (
    <table className="mini-table">
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Fornecedor</th>
          <th>Vencimento</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={i}>
            <td>{c.descricao}</td>
            <td>{c.fornecedor_nome}</td>
            <td>
              {fmtDate(c.data_vencimento)}
              {c.atrasado && (
                <span className="tag tag-danger" style={{ marginLeft: 4 }}>
                  atrasado
                </span>
              )}
            </td>
            <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {fmtMoeda(c.valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoriaChart({ porCategoria }) {
  if (!porCategoria || porCategoria.length === 0) {
    return <div className="empty-state">Sem dados de categorias.</div>;
  }

  const labels = porCategoria.map(c => c.categoria);
  const values = porCategoria.map(c => c.total);
  const colors = generateColors(labels.length);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { font: { size: 11 }, boxWidth: 12 },
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${fmtMoeda(ctx.parsed)}`,
        },
      },
    },
  };

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function Financeiro() {
  const [resumo, setResumo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    getResumo()
      .then(data => { setResumo(data); setError(null); })
      .catch(() => setError('Erro ao carregar dados financeiros.'))
      .finally(() => setLoading(false));
  }, []);

  const totais        = resumo?.totais        ?? {};
  const proxVenc      = resumo?.proxVencimentos ?? [];
  const vencendo7     = resumo?.vencendo7dias  ?? { total: 0, n: 0 };
  const porCategoria  = resumo?.porCategoria   ?? [];

  return (
    <>
      {/* page-bar */}
      <div className="page-bar">
        <div>
          <h1>Painel Financeiro</h1>
          <div>Visão consolidada de contas a pagar e despesas</div>
        </div>
        <a
          href="/legacy/contas-pagar.html"
          className="btn btn-sm"
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          Contas a pagar →
        </a>
      </div>

      <div className="container">

        {loading && <div className="loading">Carregando...</div>}
        {error   && <div className="msg error">{error}</div>}

        {!loading && !error && resumo && (
          <>
            {/* KPI grid */}
            <div className="kpi-grid">
              <KpiCard
                mod="aberto"
                label="Total em aberto"
                value={fmtMoeda(totais.total_aberto ?? 0)}
                sub="contas não vencidas"
              />
              <KpiCard
                mod="atrasado"
                label="Total atrasado"
                value={fmtMoeda(totais.total_atrasado ?? 0)}
                sub="vencidas e não pagas"
              />
              <KpiCard
                mod="pago"
                label="Pago no mês"
                value={fmtMoeda(totais.total_pago_mes ?? 0)}
                sub={mesAtual()}
              />
              <KpiCard
                mod="vencendo"
                label="Vencendo em 7 dias"
                value={fmtMoeda(vencendo7.total ?? 0)}
                sub={`${vencendo7.n ?? 0} conta(s)`}
              />
            </div>

            {/* two-col */}
            <div className="two-col">
              <div className="card">
                <div className="card-title">
                  Próximos vencimentos
                  <a href="/legacy/contas-pagar.html" className="btn btn-sm btn-ghost">
                    Ver todos →
                  </a>
                </div>
                <ProxVencimentos rows={proxVenc} />
              </div>

              <div className="card">
                <div className="card-title">Despesas por categoria</div>
                <CategoriaChart porCategoria={porCategoria} />
              </div>
            </div>
          </>
        )}

      </div>
    </>
  );
}
