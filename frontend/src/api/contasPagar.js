import { get, post, put } from './http';

export const listContas = (params = {}) => {
  const qs = new URLSearchParams({ limit: '200' });
  if (params.status)          qs.set('status',          params.status);
  if (params.fornecedor_id)   qs.set('fornecedor_id',   params.fornecedor_id);
  if (params.categoria_id)    qs.set('categoria_id',    params.categoria_id);
  if (params.forma_pagamento) qs.set('forma_pagamento', params.forma_pagamento);
  return get(`/contas-pagar?${qs}`);
};

export const getConta      = (id)       => get(`/contas-pagar/${id}`);
export const createConta   = (data)     => post('/contas-pagar', data);
export const updateConta   = (id, data) => put(`/contas-pagar/${id}`, data);

// body deve ser FormData (upload de comprovante)
export const baixarConta   = (id, formData) => post(`/contas-pagar/${id}/baixar`, formData);

// body é JSON { motivo }
export const cancelarConta = (id, data)     => post(`/contas-pagar/${id}/cancelar`, data);
