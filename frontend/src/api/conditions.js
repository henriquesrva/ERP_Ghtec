import { get, post, put, del } from './http';

export const listConditions   = ()         => get('/commercial-conditions');
export const searchConditions = (q)        => get(`/commercial-conditions/search?q=${encodeURIComponent(q)}`);
export const getCondition     = (id)       => get(`/commercial-conditions/${id}`);
export const createCondition  = (data)     => post('/commercial-conditions', data);
export const updateCondition  = (id, data) => put(`/commercial-conditions/${id}`, data);
export const deleteCondition  = (id)       => del(`/commercial-conditions/${id}`);
