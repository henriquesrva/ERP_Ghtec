import { useState, useEffect, useCallback, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import { listNotas, getNota, createNota, cancelarNota as apiCancelarNota } from '../api/notasRecebidas';
import { listFornecedores, searchFornecedores } from '../api/fornecedores';
import { listCategoriasDespesa } from '../api/categoriasDespesa';
import { searchParts } from '../api/parts';

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
function tagContaStatus(s, a) {
  if (a) return 'tag-danger';
  if (s === 'pago') return 'tag-ok';
  if (s === 'cancelado') return 'tag-muted';
  return 'tag-warn';
}
function labelContaStatus(s, a) {
  if (a) return 'atrasado';
  return { em_aberto: 'em aberto', pago: 'pago', cancelado: 'cancelado' }[s] || s;
}

const TODAY = new Date().toISOString().slice(0, 10);

function makeItem(uid) {
  return {
    _uid: uid,
    descricao: '', codigo_produto: '', unidade: '', quantidade: '',
    valor_unitario: '', valor_total: '', valor_desconto: '', ncm: '', cfop: '',
    produto_id: '',
    // Dados fiscais avançados
    origem_mercadoria: '', cst_icms: '', csosn: '', modalidade_bc_icms: '',
    reducao_base_icms: '', valor_bc_icms: '', aliquota_icms: '', valor_icms: '',
    valor_bc_icms_st: '', aliquota_icms_st: '', valor_icms_st: '',
    cst_ipi: '', codigo_enquadramento_ipi: '', valor_bc_ipi: '', aliquota_ipi: '', valor_ipi: '',
    cst_pis: '', valor_bc_pis: '', aliquota_pis: '', valor_pis: '',
    cst_cofins: '', valor_bc_cofins: '', aliquota_cofins: '', valor_cofins: '',
    aliquota_iss: '', valor_iss: '', cest: '', informacoes_adicionais: '',
  };
}

const NOVA_FORM_DEFAULT = {
  numero_nota: '', serie: '', chave_acesso: '', tipo_nota: 'produto',
  categoria_despesa_id: '', data_emissao: '', data_entrada: TODAY,
  valor_total: '', descricao: '', observacoes: '',
  // Dados fiscais da nota
  natureza_operacao: '', cfop_principal: '', modalidade_frete: '',
  valor_frete: '', valor_seguro: '', valor_desconto: '', valor_outras_despesas: '',
  valor_bc_icms: '', valor_icms: '', valor_ipi: '', valor_pis: '',
  valor_cofins: '', valor_iss: '', numero_protocolo: '', data_autorizacao: '',
};
const CONTAS_DEFAULT = { forma_pagamento: '', parcela_vencimento_inicial: '', parcelas_quantidade: '1' };

function buildParcelasPreview(valorStr, vcStr, nStr) {
  const val = parseFloat(valorStr) || 0;
  const n   = parseInt(nStr) || 1;
  if (!val || !vcStr) return n === 1 ? ['1 parcela à vista'] : [];
  if (n < 2) return ['1 parcela à vista'];
  const parc  = Math.floor((val / n) * 100) / 100;
  const ultima = Math.round((val - parc * (n - 1)) * 100) / 100;
  const [y, m, d] = vcStr.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    let mes = m + i;
    const ano = y + Math.floor((mes - 1) / 12);
    mes = ((mes - 1) % 12) + 1;
    const vencStr = `${String(d).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    return `${i + 1}/${n} — ${fmtMoeda(i < n - 1 ? parc : ultima)} — vence ${vencStr}`;
  });
}

// ── Sub-componente: ItemBlock ──────────────────────────────────────────────────

function ItemBlock({ item, idx, fiscalOpen, acResults, onToggleFiscal, onRemove, onDescInput, onSelectProduto, onClearAc, onUpdate, onQtyPrice }) {
  return (
    <div className="item-block">
      <div className="item-block-header">
        <span className="item-block-title">Item {idx + 1}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-danger)' }}
          onClick={onRemove}
        >
          Remover
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: 8 }}>
        {/* Descrição com autocomplete de peça */}
        <div className="field col-span-2">
          <label>Descrição *</label>
          <div className="item-ac-wrap">
            <input
              type="text"
              value={item.descricao}
              placeholder="Digite ou busque uma peça..."
              autoComplete="off"
              onChange={e => onDescInput(e.target.value)}
            />
            {acResults.length > 0 && (
              <div className="item-ac-list">
                {acResults.map(p => (
                  <div
                    key={p.id}
                    className="item-ac-list-item"
                    onClick={() => onSelectProduto(p)}
                  >
                    {p.nome}{p.codigo_interno ? ' — ' + p.codigo_interno : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label>Código do produto</label>
          <input type="text" value={item.codigo_produto} placeholder="Código do fornecedor"
            onChange={e => onUpdate('codigo_produto', e.target.value)} />
        </div>
        <div className="field">
          <label>Unidade</label>
          <input type="text" value={item.unidade} placeholder="UN, KG, M..." maxLength="10"
            onChange={e => onUpdate('unidade', e.target.value)} />
        </div>
        <div className="field">
          <label>Quantidade</label>
          <input type="number" step="0.001" min="0" value={item.quantidade}
            onChange={e => onQtyPrice('quantidade', e.target.value)} />
        </div>
        <div className="field">
          <label>Valor unitário (R$)</label>
          <input type="number" step="0.0001" min="0" value={item.valor_unitario}
            onChange={e => onQtyPrice('valor_unitario', e.target.value)} />
        </div>
        <div className="field">
          <label>Valor total (R$)</label>
          <input type="number" step="0.01" min="0" value={item.valor_total}
            onChange={e => onUpdate('valor_total', e.target.value)} />
        </div>
        <div className="field">
          <label>Desconto item (R$)</label>
          <input type="number" step="0.01" min="0" value={item.valor_desconto}
            onChange={e => onUpdate('valor_desconto', e.target.value)} />
        </div>
        <div className="field">
          <label>NCM</label>
          <input type="text" value={item.ncm} maxLength="10"
            onChange={e => onUpdate('ncm', e.target.value)} />
        </div>
        <div className="field">
          <label>CFOP</label>
          <input type="text" value={item.cfop} maxLength="10"
            onChange={e => onUpdate('cfop', e.target.value)} />
        </div>
      </div>

      {/* Dados fiscais avançados (collapsible) */}
      <div style={{ marginTop: 6 }}>
        <button type="button" className="section-toggle" style={{ fontSize: 11 }} onClick={onToggleFiscal}>
          {fiscalOpen ? '▲ Dados fiscais avançados' : '▼ Dados fiscais avançados'}
        </button>
      </div>
      {fiscalOpen && (
        <div style={{ marginTop: 10 }}>
          <div className="grid-4" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Origem merc.</label>
              <select value={item.origem_mercadoria} onChange={e => onUpdate('origem_mercadoria', e.target.value)}>
                <option value="">—</option>
                <option value="0">0 – Nacional</option>
                <option value="1">1 – Estrangeira (importada)</option>
                <option value="2">2 – Estrangeira (merc. interno)</option>
                <option value="3">3 – Nacional (&gt;40% cont. ext.)</option>
                <option value="4">4 – Nacional (proc. básico)</option>
                <option value="5">5 – Nacional (&gt;40% import.)</option>
                <option value="6">6 – Estrangeira (direta s/ similar)</option>
                <option value="7">7 – Estrangeira (merc. int. s/ similar)</option>
                <option value="8">8 – Nacional (norma Anatel)</option>
              </select>
            </div>
            <div className="field"><label>CST ICMS</label>
              <input type="text" value={item.cst_icms} maxLength="5" placeholder="Ex: 040"
                onChange={e => onUpdate('cst_icms', e.target.value)} />
            </div>
            <div className="field"><label>CSOSN</label>
              <input type="text" value={item.csosn} maxLength="5" placeholder="Ex: 400"
                onChange={e => onUpdate('csosn', e.target.value)} />
            </div>
            <div className="field">
              <label>Mod. BC ICMS</label>
              <select value={item.modalidade_bc_icms} onChange={e => onUpdate('modalidade_bc_icms', e.target.value)}>
                <option value="">—</option>
                <option value="0">0 – Margem valor agregado</option>
                <option value="1">1 – Pauta</option>
                <option value="2">2 – Preço tabelado</option>
                <option value="3">3 – Valor da operação</option>
              </select>
            </div>
            <div className="field"><label>Redução BC ICMS (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={item.reducao_base_icms}
                onChange={e => onUpdate('reducao_base_icms', e.target.value)} />
            </div>
            <div className="field"><label>BC ICMS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_bc_icms}
                onChange={e => onUpdate('valor_bc_icms', e.target.value)} />
            </div>
            <div className="field"><label>Alíq. ICMS (%)</label>
              <input type="number" step="0.01" min="0" value={item.aliquota_icms}
                onChange={e => onUpdate('aliquota_icms', e.target.value)} />
            </div>
            <div className="field"><label>ICMS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_icms}
                onChange={e => onUpdate('valor_icms', e.target.value)} />
            </div>
            <div className="field"><label>BC ICMS-ST (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_bc_icms_st}
                onChange={e => onUpdate('valor_bc_icms_st', e.target.value)} />
            </div>
            <div className="field"><label>Alíq. ICMS-ST (%)</label>
              <input type="number" step="0.01" min="0" value={item.aliquota_icms_st}
                onChange={e => onUpdate('aliquota_icms_st', e.target.value)} />
            </div>
            <div className="field"><label>ICMS-ST (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_icms_st}
                onChange={e => onUpdate('valor_icms_st', e.target.value)} />
            </div>
            <div className="field"><label>CST IPI</label>
              <input type="text" value={item.cst_ipi} maxLength="5"
                onChange={e => onUpdate('cst_ipi', e.target.value)} />
            </div>
            <div className="field"><label>Cód. enquad. IPI</label>
              <input type="text" value={item.codigo_enquadramento_ipi} maxLength="10"
                onChange={e => onUpdate('codigo_enquadramento_ipi', e.target.value)} />
            </div>
            <div className="field"><label>BC IPI (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_bc_ipi}
                onChange={e => onUpdate('valor_bc_ipi', e.target.value)} />
            </div>
            <div className="field"><label>Alíq. IPI (%)</label>
              <input type="number" step="0.01" min="0" value={item.aliquota_ipi}
                onChange={e => onUpdate('aliquota_ipi', e.target.value)} />
            </div>
            <div className="field"><label>IPI (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_ipi}
                onChange={e => onUpdate('valor_ipi', e.target.value)} />
            </div>
            <div className="field"><label>CST PIS</label>
              <input type="text" value={item.cst_pis} maxLength="5"
                onChange={e => onUpdate('cst_pis', e.target.value)} />
            </div>
            <div className="field"><label>BC PIS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_bc_pis}
                onChange={e => onUpdate('valor_bc_pis', e.target.value)} />
            </div>
            <div className="field"><label>Alíq. PIS (%)</label>
              <input type="number" step="0.01" min="0" value={item.aliquota_pis}
                onChange={e => onUpdate('aliquota_pis', e.target.value)} />
            </div>
            <div className="field"><label>PIS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_pis}
                onChange={e => onUpdate('valor_pis', e.target.value)} />
            </div>
            <div className="field"><label>CST COFINS</label>
              <input type="text" value={item.cst_cofins} maxLength="5"
                onChange={e => onUpdate('cst_cofins', e.target.value)} />
            </div>
            <div className="field"><label>BC COFINS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_bc_cofins}
                onChange={e => onUpdate('valor_bc_cofins', e.target.value)} />
            </div>
            <div className="field"><label>Alíq. COFINS (%)</label>
              <input type="number" step="0.01" min="0" value={item.aliquota_cofins}
                onChange={e => onUpdate('aliquota_cofins', e.target.value)} />
            </div>
            <div className="field"><label>COFINS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_cofins}
                onChange={e => onUpdate('valor_cofins', e.target.value)} />
            </div>
            <div className="field"><label>Alíq. ISS (%)</label>
              <input type="number" step="0.01" min="0" value={item.aliquota_iss}
                onChange={e => onUpdate('aliquota_iss', e.target.value)} />
            </div>
            <div className="field"><label>ISS (R$)</label>
              <input type="number" step="0.01" min="0" value={item.valor_iss}
                onChange={e => onUpdate('valor_iss', e.target.value)} />
            </div>
            <div className="field"><label>CEST</label>
              <input type="text" value={item.cest} maxLength="10"
                onChange={e => onUpdate('cest', e.target.value)} />
            </div>
            <div className="field col-span-4">
              <label>Informações adicionais do item</label>
              <input type="text" value={item.informacoes_adicionais}
                onChange={e => onUpdate('informacoes_adicionais', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componente: DetailContent ──────────────────────────────────────────────

function DetailContent({ data, podeCancel, cancelConfirm, cancelErr, cancelLoading, onCancel, onCancelConfirm, onCancelAbort }) {
  const { nota, contas, itens } = data;

  const hasFiscal = nota.natureza_operacao || nota.cfop_principal || nota.valor_icms ||
    nota.valor_ipi || nota.valor_pis || nota.valor_cofins || nota.valor_iss || nota.numero_protocolo;

  return (
    <div>
      {/* Dados principais */}
      <div className="detail-view">
        <div className="dv-row"><span className="dv-label">Fornecedor</span>
          <span>{nota.fornecedor_nome}{nota.fornecedor_cnpj ? ' — ' + nota.fornecedor_cnpj : ''}</span></div>
        <div className="dv-row"><span className="dv-label">Nota / Série</span>
          <span>{nota.numero_nota || 's/n'}{nota.serie ? ' / ' + nota.serie : ''}</span></div>
        {nota.chave_acesso && (
          <div className="dv-row"><span className="dv-label">Chave acesso</span>
            <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{nota.chave_acesso}</span></div>
        )}
        <div className="dv-row"><span className="dv-label">Tipo</span><span>{nota.tipo_nota}</span></div>
        <div className="dv-row"><span className="dv-label">Categoria</span><span>{nota.categoria_nome || '—'}</span></div>
        <div className="dv-row"><span className="dv-label">Data emissão</span><span>{fmtDate(nota.data_emissao)}</span></div>
        <div className="dv-row"><span className="dv-label">Data entrada</span><span>{fmtDate(nota.data_entrada)}</span></div>
        <div className="dv-row"><span className="dv-label">Valor total</span>
          <span style={{ fontWeight: 700 }}>{fmtMoeda(nota.valor_total)}</span></div>
        {nota.descricao && (
          <div className="dv-row"><span className="dv-label">Descrição</span><span>{nota.descricao}</span></div>
        )}
        <div className="dv-row"><span className="dv-label">Status</span>
          <span className={`tag ${nota.status === 'lancada' ? 'tag-ok' : 'tag-muted'}`}>{nota.status}</span></div>
        {nota.arquivo_pdf && (
          <div className="dv-row"><span className="dv-label">PDF</span>
            <a href={`/files/notas/${nota.arquivo_pdf.replace('notas-recebidas/', '')}`}
              target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)' }}>Abrir PDF</a></div>
        )}
        {nota.arquivo_xml && (
          <div className="dv-row"><span className="dv-label">XML</span>
            <a href={`/files/notas/${nota.arquivo_xml.replace('notas-recebidas/', '')}`}
              target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)' }}>Baixar XML</a></div>
        )}
        {nota.observacoes && (
          <div className="dv-row"><span className="dv-label">Obs.</span><span>{nota.observacoes}</span></div>
        )}
      </div>

      {/* Itens */}
      {itens && itens.length > 0 && (
        <>
          <hr className="separator" />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Itens ({itens.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>#</th><th>Descrição</th><th>Cód.</th><th>NCM</th><th>CFOP</th>
                  <th>Qtde</th><th>V.Unit</th><th>V.Total</th><th>ICMS</th><th>IPI</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(i => (
                  <tr key={i.id || i.numero_item}>
                    <td>{i.numero_item}</td>
                    <td>
                      {i.descricao}
                      {i.produto_nome && (
                        <><br /><span style={{ color: 'var(--color-muted)', fontSize: 11 }}>Peça: {i.produto_nome}</span></>
                      )}
                    </td>
                    <td>{i.codigo_produto || '—'}</td>
                    <td>{i.ncm || '—'}</td>
                    <td>{i.cfop || '—'}</td>
                    <td>{i.quantidade != null ? Number(i.quantidade).toLocaleString('pt-BR') : '—'}</td>
                    <td>{fmtMoeda(i.valor_unitario)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtMoeda(i.valor_total)}</td>
                    <td>{i.valor_icms != null ? fmtMoeda(i.valor_icms) : '—'}</td>
                    <td>{i.valor_ipi != null ? fmtMoeda(i.valor_ipi) : '—'}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: '#f9f9f9' }}>
                  <td colSpan="7" style={{ textAlign: 'right' }}>Total itens:</td>
                  <td>{fmtMoeda(itens.reduce((s, i) => s + (i.valor_total || 0), 0))}</td>
                  <td>{fmtMoeda(itens.reduce((s, i) => s + (i.valor_icms || 0), 0))}</td>
                  <td>{fmtMoeda(itens.reduce((s, i) => s + (i.valor_ipi || 0), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Dados fiscais */}
      {hasFiscal && (
        <>
          <hr className="separator" />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Dados fiscais
          </div>
          <div className="detail-view">
            {nota.natureza_operacao && (
              <div className="dv-row"><span className="dv-label">Nat. operação</span><span>{nota.natureza_operacao}</span></div>
            )}
            {nota.cfop_principal && (
              <div className="dv-row"><span className="dv-label">CFOP principal</span><span>{nota.cfop_principal}</span></div>
            )}
            {nota.numero_protocolo && (
              <div className="dv-row"><span className="dv-label">Protocolo</span><span>{nota.numero_protocolo}</span></div>
            )}
            {nota.data_autorizacao && (
              <div className="dv-row"><span className="dv-label">Dt autorização</span><span>{fmtDate(nota.data_autorizacao)}</span></div>
            )}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
              {nota.valor_frete   ? <span><b>Frete:</b> {fmtMoeda(nota.valor_frete)}</span>   : null}
              {nota.valor_seguro  ? <span><b>Seguro:</b> {fmtMoeda(nota.valor_seguro)}</span>  : null}
              {nota.valor_desconto ? <span><b>Desconto:</b> {fmtMoeda(nota.valor_desconto)}</span> : null}
              {nota.valor_bc_icms ? <span><b>BC ICMS:</b> {fmtMoeda(nota.valor_bc_icms)}</span> : null}
              {nota.valor_icms    ? <span><b>ICMS:</b> {fmtMoeda(nota.valor_icms)}</span>    : null}
              {nota.valor_ipi     ? <span><b>IPI:</b> {fmtMoeda(nota.valor_ipi)}</span>      : null}
              {nota.valor_pis     ? <span><b>PIS:</b> {fmtMoeda(nota.valor_pis)}</span>      : null}
              {nota.valor_cofins  ? <span><b>COFINS:</b> {fmtMoeda(nota.valor_cofins)}</span>  : null}
              {nota.valor_iss     ? <span><b>ISS:</b> {fmtMoeda(nota.valor_iss)}</span>      : null}
            </div>
          </div>
        </>
      )}

      {/* Contas a pagar vinculadas */}
      <hr className="separator" />
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 8 }}>
        Contas a pagar vinculadas
      </div>
      {contas && contas.length > 0 ? (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Descrição</th><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contas.map(c => (
              <tr key={c.id}>
                <td>{c.descricao}</td>
                <td>{c.parcela_numero ? `${c.parcela_numero}/${c.parcela_total}` : '—'}</td>
                <td>{fmtMoeda(c.valor)}</td>
                <td>{fmtDate(c.data_vencimento)}</td>
                <td>
                  <span className={`tag ${tagContaStatus(c.status, c.atrasado)}`}>
                    {labelContaStatus(c.status, c.atrasado)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Nenhuma conta a pagar vinculada.</div>
      )}

      {/* Cancelar */}
      {podeCancel && nota.status === 'lancada' && (
        <div style={{ marginTop: 16 }}>
          {!cancelConfirm ? (
            <button className="btn btn-danger btn-sm" onClick={onCancel}>
              Cancelar nota
            </button>
          ) : (
            <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--color-danger)' }}>
                Confirmar cancelamento? As contas a pagar em aberto devem ser canceladas primeiro.
              </div>
              {cancelErr && <div className="msg error" style={{ marginBottom: 8 }}>{cancelErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger btn-sm" onClick={onCancelConfirm} disabled={cancelLoading}>
                  {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onCancelAbort} disabled={cancelLoading}>
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function NotasRecebidas() {
  const { user } = useAuth();

  // ── List ─────────────────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState({ status: '', fornecedor_id: '', categoria_id: '' });
  const [fornecedores, setFornecedores] = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [notas, setNotas]             = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, msg: '', ok: true });

  // ── Nova modal ────────────────────────────────────────────────────────────────
  const [novaOpen, setNovaOpen]         = useState(false);
  const [novaForm, setNovaForm]         = useState(NOVA_FORM_DEFAULT);
  const [novaFiles, setNovaFiles]       = useState({ arquivo_pdf: null, arquivo_xml: null });
  const [novaItens, setNovaItens]       = useState([]);
  const [gerarContas, setGerarContas]   = useState(false);
  const [contasForm, setContasForm]     = useState(CONTAS_DEFAULT);
  const [novaErr, setNovaErr]           = useState('');
  const [saving, setSaving]             = useState(false);
  const [fiscalNotaOpen, setFiscalNotaOpen] = useState(false);
  const [itensSecOpen, setItensSecOpen] = useState(false);
  const [itemFiscalOpen, setItemFiscalOpen] = useState({});

  // Fornecedor AC
  const [acInput, setAcInput]         = useState('');
  const [acResults, setAcResults]     = useState([]);
  const [acSelectedId, setAcSelectedId] = useState('');
  const acTimer = useRef(null);

  // Item product AC
  const [itemAcResults, setItemAcResults] = useState({});
  const itemAcTimers  = useRef({});
  const itemUidCounter = useRef(0);

  // ── Detail modal ──────────────────────────────────────────────────────────────
  const [detailOpen, setDetailOpen]     = useState(false);
  const [detailData, setDetailData]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelErr, setCancelErr]       = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([listFornecedores(), listCategoriasDespesa()])
      .then(([f, c]) => { setFornecedores(f); setCategorias(c); });
  }, []);

  // ── List loading ──────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setListLoading(true);
    listNotas(filtros)
      .then(data => setNotas(Array.isArray(data) ? data : []))
      .catch(() => setNotas([]))
      .finally(() => setListLoading(false));
  }, [filtros]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  function showToast(msg, ok = true) {
    setToast({ show: true, msg, ok });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }

  // ── Fornecedor AC ─────────────────────────────────────────────────────────────
  function handleAcInput(value) {
    setAcInput(value);
    setAcSelectedId('');
    clearTimeout(acTimer.current);
    if (!value.trim()) { setAcResults([]); return; }
    acTimer.current = setTimeout(async () => {
      try {
        const res = await searchFornecedores(value);
        setAcResults(Array.isArray(res) ? res : []);
      } catch { setAcResults([]); }
    }, 250);
  }
  function selectFornecedor(f) {
    setAcInput(f.razao_social + (f.cnpj ? ' — ' + f.cnpj : ''));
    setAcSelectedId(String(f.id));
    setAcResults([]);
  }

  // ── Items ─────────────────────────────────────────────────────────────────────
  function addItem() {
    const uid = itemUidCounter.current++;
    setNovaItens(prev => [...prev, makeItem(uid)]);
  }
  function removeItem(uid) {
    setNovaItens(prev => prev.filter(i => i._uid !== uid));
    setItemAcResults(prev => { const n = { ...prev }; delete n[uid]; return n; });
    setItemFiscalOpen(prev => { const n = { ...prev }; delete n[uid]; return n; });
  }
  function updateItem(uid, field, value) {
    setNovaItens(prev => prev.map(i => i._uid === uid ? { ...i, [field]: value } : i));
  }
  function handleQtyOrPrice(uid, field, value) {
    setNovaItens(prev => prev.map(i => {
      if (i._uid !== uid) return i;
      const upd = { ...i, [field]: value };
      const qtd  = parseFloat(field === 'quantidade'    ? value : upd.quantidade)    || 0;
      const vu   = parseFloat(field === 'valor_unitario' ? value : upd.valor_unitario) || 0;
      if (qtd > 0 && vu > 0) upd.valor_total = String(Math.round(qtd * vu * 100) / 100);
      return upd;
    }));
  }
  function handleItemDescInput(uid, value) {
    updateItem(uid, 'descricao', value);
    clearTimeout(itemAcTimers.current[uid]);
    if (!value.trim()) { setItemAcResults(prev => ({ ...prev, [uid]: [] })); return; }
    itemAcTimers.current[uid] = setTimeout(async () => {
      try {
        const res = await searchParts(value);
        setItemAcResults(prev => ({ ...prev, [uid]: (Array.isArray(res) ? res : []).slice(0, 10) }));
      } catch { setItemAcResults(prev => ({ ...prev, [uid]: [] })); }
    }, 250);
  }
  function selectProduto(uid, part) {
    setNovaItens(prev => prev.map(i =>
      i._uid === uid
        ? { ...i, descricao: part.nome, codigo_produto: part.codigo_interno || '', ncm: part.ncm || '', produto_id: String(part.id) }
        : i
    ));
    setItemAcResults(prev => ({ ...prev, [uid]: [] }));
  }

  // ── Nova modal ────────────────────────────────────────────────────────────────
  function openNovaModal() {
    setNovaOpen(true);
    setNovaForm({ ...NOVA_FORM_DEFAULT, data_entrada: new Date().toISOString().slice(0, 10) });
    setNovaFiles({ arquivo_pdf: null, arquivo_xml: null });
    setNovaItens([]);
    setGerarContas(false);
    setContasForm(CONTAS_DEFAULT);
    setNovaErr('');
    setFiscalNotaOpen(false);
    setItensSecOpen(false);
    setItemFiscalOpen({});
    setAcInput('');
    setAcResults([]);
    setAcSelectedId('');
    setItemAcResults({});
    itemUidCounter.current = 0;
  }
  function closeNovaModal() { setNovaOpen(false); }

  async function handleSubmitNota(e) {
    e.preventDefault();
    if (!acSelectedId) { setNovaErr('Selecione um fornecedor.'); return; }
    for (let i = 0; i < novaItens.length; i++) {
      if (!novaItens[i].descricao?.trim()) {
        setNovaErr(`Item ${i + 1}: descrição é obrigatória.`); return;
      }
    }
    setSaving(true);
    setNovaErr('');

    const fd = new FormData();
    fd.set('fornecedor_id', acSelectedId);
    Object.entries(novaForm).forEach(([k, v]) => { if (v !== '' && v != null) fd.set(k, String(v)); });
    if (gerarContas) {
      fd.set('gerar_contas_pagar', 'true');
      Object.entries(contasForm).forEach(([k, v]) => { if (v !== '' && v != null) fd.set(k, String(v)); });
    }
    if (novaFiles.arquivo_pdf) fd.set('arquivo_pdf', novaFiles.arquivo_pdf);
    if (novaFiles.arquivo_xml) fd.set('arquivo_xml', novaFiles.arquivo_xml);

    const itensPayload = novaItens.map(({ _uid, ...rest }) => {
      const clean = {};
      Object.entries(rest).forEach(([k, v]) => { if (v !== '' && v != null) clean[k] = v; });
      return clean;
    });
    fd.set('itens', JSON.stringify(itensPayload));

    try {
      const json = await createNota(fd);
      if (json.success || json.id) {
        closeNovaModal();
        loadList();
        showToast('Nota lançada com sucesso.');
      } else {
        setNovaErr(json.message || 'Erro ao salvar nota.');
      }
    } catch {
      setNovaErr('Erro de comunicação com o servidor.');
    } finally {
      setSaving(false);
    }
  }

  // ── Detail modal ──────────────────────────────────────────────────────────────
  async function openDetail(id) {
    setDetailOpen(true);
    setDetailData(null);
    setDetailLoading(true);
    setCancelConfirm(false);
    setCancelErr('');
    try {
      const data = await getNota(id);
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }
  function closeDetailModal() {
    setDetailOpen(false);
    setDetailData(null);
    setCancelConfirm(false);
    setCancelErr('');
  }

  async function handleCancelar() {
    if (!detailData?.nota) return;
    setCancelLoading(true);
    setCancelErr('');
    try {
      const json = await apiCancelarNota(detailData.nota.id);
      if (json.success) {
        closeDetailModal();
        loadList();
        showToast('Nota cancelada.');
      } else {
        setCancelErr(json.message || 'Erro ao cancelar nota.');
        setCancelConfirm(false);
      }
    } catch {
      setCancelErr('Erro de comunicação.');
      setCancelConfirm(false);
    } finally {
      setCancelLoading(false);
    }
  }

  // ── Derivados ──────────────────────────────────────────────────────────────────
  const podeCancel   = user?.role === 'admin' || user?.role === 'financeiro';
  const itensTotal   = novaItens.reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0);
  const notaTotal    = parseFloat(novaForm.valor_total) || 0;
  const itensDiff    = itensTotal - notaTotal;
  const parcelasPreview = gerarContas
    ? buildParcelasPreview(novaForm.valor_total, contasForm.parcela_vencimento_inicial, contasForm.parcelas_quantidade)
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* page-bar */}
      <div className="page-bar">
        <div>
          <h1>Notas Fiscais Recebidas</h1>
          <div>Registro e controle de notas de fornecedores</div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <div className="card-header">
            <span className="section-title">Notas recebidas</span>
            <button className="btn btn-primary" onClick={openNovaModal}>+ Nova nota</button>
          </div>

          {/* Filtros */}
          <div className="filters">
            <select
              value={filtros.status}
              onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos os status</option>
              <option value="lancada">Lançada</option>
              <option value="cancelada">Cancelada</option>
            </select>
            <select
              value={filtros.fornecedor_id}
              onChange={e => setFiltros(f => ({ ...f, fornecedor_id: e.target.value }))}
            >
              <option value="">Todos os fornecedores</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.razao_social}</option>
              ))}
            </select>
            <select
              value={filtros.categoria_id}
              onChange={e => setFiltros(f => ({ ...f, categoria_id: e.target.value }))}
            >
              <option value="">Todas as categorias</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFiltros({ status: '', fornecedor_id: '', categoria_id: '' })}
            >
              Limpar filtros
            </button>
          </div>

          {/* Tabela */}
          {listLoading ? (
            <div className="loading">Carregando...</div>
          ) : notas.length === 0 ? (
            <div className="empty-state">Nenhuma nota encontrada.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nota / Série</th>
                  <th>Fornecedor</th>
                  <th>Entrada</th>
                  <th>Valor total</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Itens</th>
                  <th>Contas</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {notas.map(n => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 700 }}>
                      {n.numero_nota || 's/n'}{n.serie ? ' / ' + n.serie : ''}
                    </td>
                    <td>{n.fornecedor_nome}</td>
                    <td>{fmtDate(n.data_entrada)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtMoeda(n.valor_total)}</td>
                    <td>{n.tipo_nota}</td>
                    <td>{n.categoria_nome || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{n.total_itens || 0}</td>
                    <td style={{ textAlign: 'center' }}>{n.total_contas}</td>
                    <td>
                      <span className={`tag ${n.status === 'lancada' ? 'tag-ok' : 'tag-muted'}`}>
                        {n.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDetail(n.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`toast ${toast.ok ? 'success' : 'error'}`}>{toast.msg}</div>
      )}

      {/* ── Modal: Nova nota ── */}
      {novaOpen && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) closeNovaModal(); }}
        >
          <div className="modal" style={{ width: 820, maxWidth: '96vw' }}>
            <div className="modal-title">Nova Nota Fiscal Recebida</div>
            {novaErr && (
              <div className="msg error" style={{ marginBottom: 12 }}>{novaErr}</div>
            )}
            <form onSubmit={handleSubmitNota}>

              {/* Dados principais */}
              <div className="grid-2">

                {/* Fornecedor autocomplete */}
                <div className="field col-span-2">
                  <label>Fornecedor *</label>
                  <div className="ac-wrap">
                    <input
                      type="text"
                      value={acInput}
                      onChange={e => handleAcInput(e.target.value)}
                      placeholder="Digite para buscar..."
                      autoComplete="off"
                    />
                    {acResults.length > 0 && (
                      <div className="ac-list">
                        {acResults.map(f => (
                          <div key={f.id} className="ac-list-item" onClick={() => selectFornecedor(f)}>
                            {f.razao_social}{f.cnpj ? ' — ' + f.cnpj : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>Número da nota</label>
                  <input type="text" value={novaForm.numero_nota}
                    onChange={e => setNovaForm(f => ({ ...f, numero_nota: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Série</label>
                  <input type="text" value={novaForm.serie}
                    onChange={e => setNovaForm(f => ({ ...f, serie: e.target.value }))} />
                </div>
                <div className="field col-span-2">
                  <label>Chave de acesso (44 dígitos)</label>
                  <input type="text" maxLength="50" value={novaForm.chave_acesso}
                    onChange={e => setNovaForm(f => ({ ...f, chave_acesso: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Tipo *</label>
                  <select value={novaForm.tipo_nota}
                    onChange={e => setNovaForm(f => ({ ...f, tipo_nota: e.target.value }))}>
                    <option value="produto">Produto</option>
                    <option value="servico">Serviço</option>
                    <option value="misto">Misto</option>
                  </select>
                </div>
                <div className="field">
                  <label>Categoria de despesa</label>
                  <select value={novaForm.categoria_despesa_id}
                    onChange={e => setNovaForm(f => ({ ...f, categoria_despesa_id: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Data de emissão</label>
                  <input type="date" value={novaForm.data_emissao}
                    onChange={e => setNovaForm(f => ({ ...f, data_emissao: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Data de entrada *</label>
                  <input type="date" required value={novaForm.data_entrada}
                    onChange={e => setNovaForm(f => ({ ...f, data_entrada: e.target.value }))} />
                </div>
                <div className="field col-span-2">
                  <label>Valor total (R$) *</label>
                  <input type="number" step="0.01" min="0.01" required value={novaForm.valor_total}
                    onChange={e => setNovaForm(f => ({ ...f, valor_total: e.target.value }))} />
                </div>
                <div className="field col-span-2">
                  <label>Descrição / Objeto</label>
                  <input type="text" value={novaForm.descricao}
                    onChange={e => setNovaForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="field col-span-2">
                  <label>Observações</label>
                  <textarea rows="2" value={novaForm.observacoes}
                    onChange={e => setNovaForm(f => ({ ...f, observacoes: e.target.value }))} />
                </div>
                <div className="field">
                  <label>PDF da nota</label>
                  <input type="file" accept=".pdf,application/pdf"
                    onChange={e => setNovaFiles(f => ({ ...f, arquivo_pdf: e.target.files[0] || null }))} />
                </div>
                <div className="field">
                  <label>XML da nota</label>
                  <input type="file" accept=".xml,text/xml,application/xml"
                    onChange={e => setNovaFiles(f => ({ ...f, arquivo_xml: e.target.files[0] || null }))} />
                </div>
              </div>

              {/* Dados fiscais da nota (collapsible) */}
              <div className="collapsible-section">
                <div className="section-header">
                  <span className="section-label">Dados fiscais da nota</span>
                  <button type="button" className="section-toggle"
                    onClick={() => setFiscalNotaOpen(o => !o)}>
                    {fiscalNotaOpen ? '▲ Ocultar' : '▼ Mostrar'}
                  </button>
                </div>
                {fiscalNotaOpen && (
                  <div>
                    <div className="grid-3">
                      <div className="field col-span-2">
                        <label>Natureza da operação</label>
                        <input type="text" placeholder="Ex: Compra para uso e consumo"
                          value={novaForm.natureza_operacao}
                          onChange={e => setNovaForm(f => ({ ...f, natureza_operacao: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>CFOP principal</label>
                        <input type="text" maxLength="10" placeholder="Ex: 1102"
                          value={novaForm.cfop_principal}
                          onChange={e => setNovaForm(f => ({ ...f, cfop_principal: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Modalidade do frete</label>
                        <select value={novaForm.modalidade_frete}
                          onChange={e => setNovaForm(f => ({ ...f, modalidade_frete: e.target.value }))}>
                          <option value="">— Sem info —</option>
                          <option value="0">0 – Emitente</option>
                          <option value="1">1 – Destinatário</option>
                          <option value="2">2 – Terceiros</option>
                          <option value="9">9 – Sem frete</option>
                        </select>
                      </div>
                      <div className="field"><label>Valor frete (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_frete}
                          onChange={e => setNovaForm(f => ({ ...f, valor_frete: e.target.value }))} />
                      </div>
                      <div className="field"><label>Valor seguro (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_seguro}
                          onChange={e => setNovaForm(f => ({ ...f, valor_seguro: e.target.value }))} />
                      </div>
                      <div className="field"><label>Desconto global (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_desconto}
                          onChange={e => setNovaForm(f => ({ ...f, valor_desconto: e.target.value }))} />
                      </div>
                      <div className="field"><label>Outras despesas (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_outras_despesas}
                          onChange={e => setNovaForm(f => ({ ...f, valor_outras_despesas: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', margin: '8px 0 6px' }}>
                      Totais fiscais (da NF-e)
                    </div>
                    <div className="grid-4">
                      <div className="field"><label>BC ICMS (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_bc_icms}
                          onChange={e => setNovaForm(f => ({ ...f, valor_bc_icms: e.target.value }))} />
                      </div>
                      <div className="field"><label>ICMS (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_icms}
                          onChange={e => setNovaForm(f => ({ ...f, valor_icms: e.target.value }))} />
                      </div>
                      <div className="field"><label>IPI (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_ipi}
                          onChange={e => setNovaForm(f => ({ ...f, valor_ipi: e.target.value }))} />
                      </div>
                      <div className="field"><label>PIS (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_pis}
                          onChange={e => setNovaForm(f => ({ ...f, valor_pis: e.target.value }))} />
                      </div>
                      <div className="field"><label>COFINS (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_cofins}
                          onChange={e => setNovaForm(f => ({ ...f, valor_cofins: e.target.value }))} />
                      </div>
                      <div className="field"><label>ISS (R$)</label>
                        <input type="number" step="0.01" min="0" value={novaForm.valor_iss}
                          onChange={e => setNovaForm(f => ({ ...f, valor_iss: e.target.value }))} />
                      </div>
                      <div className="field"><label>Nº protocolo</label>
                        <input type="text" value={novaForm.numero_protocolo}
                          onChange={e => setNovaForm(f => ({ ...f, numero_protocolo: e.target.value }))} />
                      </div>
                      <div className="field"><label>Data autorização</label>
                        <input type="date" value={novaForm.data_autorizacao}
                          onChange={e => setNovaForm(f => ({ ...f, data_autorizacao: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Itens e tributação (collapsible) */}
              <div className="collapsible-section">
                <div className="section-header">
                  <span className="section-label">Itens e tributação</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {novaItens.length > 0 && notaTotal > 0 && (
                      <span className={Math.abs(itensDiff) < 0.02 ? 'itens-total-ok' : 'itens-total-warn'}>
                        {Math.abs(itensDiff) < 0.02
                          ? `Itens: ${fmtMoeda(itensTotal)} ✓`
                          : `Itens: ${fmtMoeda(itensTotal)} | Diferença: ${fmtMoeda(itensDiff)}`}
                      </span>
                    )}
                    <button type="button" className="section-toggle"
                      onClick={() => setItensSecOpen(o => !o)}>
                      {itensSecOpen ? '▲ Ocultar' : '▼ Mostrar'}
                    </button>
                  </div>
                </div>
                {itensSecOpen && (
                  <div>
                    {novaItens.map((item, idx) => (
                      <ItemBlock
                        key={item._uid}
                        item={item}
                        idx={idx}
                        fiscalOpen={!!itemFiscalOpen[item._uid]}
                        acResults={itemAcResults[item._uid] || []}
                        onToggleFiscal={() => setItemFiscalOpen(o => ({ ...o, [item._uid]: !o[item._uid] }))}
                        onRemove={() => removeItem(item._uid)}
                        onDescInput={v => handleItemDescInput(item._uid, v)}
                        onSelectProduto={p => selectProduto(item._uid, p)}
                        onClearAc={() => setItemAcResults(prev => ({ ...prev, [item._uid]: [] }))}
                        onUpdate={(field, value) => updateItem(item._uid, field, value)}
                        onQtyPrice={(field, value) => handleQtyOrPrice(item._uid, field, value)}
                      />
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}
                      style={{ marginTop: 4 }}>
                      + Adicionar item
                    </button>
                  </div>
                )}
              </div>

              <hr className="separator" />

              {/* Gerar contas a pagar */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={gerarContas}
                    onChange={e => setGerarContas(e.target.checked)}
                  />
                  Gerar conta(s) a pagar
                </label>
              </div>
              {gerarContas && (
                <div>
                  <div className="grid-3">
                    <div className="field">
                      <label>Forma de pagamento</label>
                      <select value={contasForm.forma_pagamento}
                        onChange={e => setContasForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                        <option value="">— Selecione —</option>
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="transferencia">Transferência</option>
                        <option value="cartao">Cartão</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Vencimento (1ª parcela) *</label>
                      <input type="date" value={contasForm.parcela_vencimento_inicial}
                        onChange={e => setContasForm(f => ({ ...f, parcela_vencimento_inicial: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>Nº de parcelas</label>
                      <input type="number" min="1" max="60" value={contasForm.parcelas_quantidade}
                        onChange={e => setContasForm(f => ({ ...f, parcelas_quantidade: e.target.value }))} />
                    </div>
                  </div>
                  {parcelasPreview.length > 0 && (
                    <div className="parcelas-preview">
                      {parcelasPreview.map((p, i) => <div key={i}>{p}</div>)}
                    </div>
                  )}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar nota'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeNovaModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Detalhe da nota ── */}
      {detailOpen && (
        <div
          className="modal-bg"
          style={{ display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) closeDetailModal(); }}
        >
          <div className="modal" style={{ width: 820, maxWidth: '96vw' }}>
            <div className="modal-title">Detalhe da nota</div>
            {detailLoading ? (
              <div className="loading">Carregando...</div>
            ) : detailData ? (
              <DetailContent
                data={detailData}
                podeCancel={podeCancel}
                cancelConfirm={cancelConfirm}
                cancelErr={cancelErr}
                cancelLoading={cancelLoading}
                onCancel={() => setCancelConfirm(true)}
                onCancelConfirm={handleCancelar}
                onCancelAbort={() => { setCancelConfirm(false); setCancelErr(''); }}
              />
            ) : (
              <div className="msg error">Erro ao carregar nota.</div>
            )}
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={closeDetailModal}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
