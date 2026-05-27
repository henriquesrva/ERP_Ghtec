import { get, post } from './http';

export const listNotas = (params = {}) => {
  const qs = new URLSearchParams({ limit: '200' });
  if (params.status)        qs.set('status',        params.status);
  if (params.fornecedor_id) qs.set('fornecedor_id', params.fornecedor_id);
  if (params.categoria_id)  qs.set('categoria_id',  params.categoria_id);
  return get(`/notas-recebidas?${qs}`);
};

export const getNota      = (id)       => get(`/notas-recebidas/${id}`);

// body deve ser FormData (upload de arquivo_pdf + arquivo_xml)
export const createNota   = (formData) => post('/notas-recebidas', formData);

// cancelar não exige body (backend lê apenas session)
export const cancelarNota = (id)       => post(`/notas-recebidas/${id}/cancelar`, {});
