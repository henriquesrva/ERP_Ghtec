import http from './http';

export const listProposals  = ()   => http.get('/proposals');
export const deleteProposal = (id) => http.del(`/proposals/${id}`);
export const createProposal = (data) => http.post('/proposals', data);

export function getLastItemPrice({ clientId, descricao, partId }) {
  const params = new URLSearchParams({ descricao: descricao || '' });
  if (clientId) params.set('clientId', clientId);
  if (partId)   params.set('partId', partId);
  return http.get(`/items/last-price?${params}`);
}
