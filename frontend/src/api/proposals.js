import http from './http';

export const listProposals  = ()   => http.get('/proposals');
export const deleteProposal = (id) => http.del(`/proposals/${id}`);
