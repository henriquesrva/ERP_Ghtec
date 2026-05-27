import http from './http';

export const listResponsaveis   = ()      => http.get('/responsaveis');
export const searchResponsaveis = (q)     => http.get(`/responsaveis/search?q=${encodeURIComponent(q)}`);
export const createResponsavel  = (data)  => http.post('/responsaveis', data);
export const deleteResponsavel  = (id)    => http.del(`/responsaveis/${id}`);
