import http from './http';

export const listFornecedores       = (includeInactive = false) =>
  http.get(`/fornecedores?includeInactive=${includeInactive}`);

export const searchFornecedores     = (q, includeInactive = false) =>
  http.get(`/fornecedores/search?q=${encodeURIComponent(q)}&includeInactive=${includeInactive}`);

export const getFornecedor          = (id)       => http.get(`/fornecedores/${id}`);
export const getFornecedorDetalhes  = (id)       => http.get(`/fornecedores/${id}/detalhes`);
export const createFornecedor       = (data)     => http.post('/fornecedores', data);
export const updateFornecedor       = (id, data) => http.put(`/fornecedores/${id}`, data);
export const desativarFornecedor    = (id)       => http.post(`/fornecedores/${id}/desativar`, {});
