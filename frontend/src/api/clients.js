import { get, post, put, del } from './http';

export const listClients      = ()         => get('/clients');
export const searchClients    = (q)        => get(`/clients/search?q=${encodeURIComponent(q)}`);
export const getClient        = (id)       => get(`/clients/${id}`);
export const createClient     = (data)     => post('/clients', data);
export const updateClient     = (id, data) => put(`/clients/${id}`, data);
export const deleteClient     = (id)       => del(`/clients/${id}`);
export const getProfitAnalysis = ()        => get('/clients/profit-analysis');
