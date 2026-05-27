import { get, post, put, del } from './http';

export const listObjetos   = ()         => get('/objetos');
export const searchObjetos = (q)        => get(`/objetos/search?q=${encodeURIComponent(q)}`);
export const getObjeto     = (id)       => get(`/objetos/${id}`);
export const createObjeto  = (data)     => post('/objetos', data);
export const updateObjeto  = (id, data) => put(`/objetos/${id}`, data);
export const deleteObjeto  = (id)       => del(`/objetos/${id}`);
