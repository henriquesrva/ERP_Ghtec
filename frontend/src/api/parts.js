import { get, post, put, del } from './http';

export const searchParts            = (q)           => get(`/parts/search?q=${encodeURIComponent(q)}`);
export const listParts              = ()            => get('/parts');
export const getPart                = (id)          => get(`/parts/${id}`);
export const createPart             = (data)        => post('/parts', data);
export const updatePart             = (id, data)    => put(`/parts/${id}`, data);
export const deletePart             = (id)          => del(`/parts/${id}`);

export const getPriceHistoryByClient = (partId, clientId) =>
  get(`/parts/${partId}/price-history-client?client_id=${clientId}`);
export const getPriceComparison      = (partId) => get(`/parts/${partId}/price-comparison`);
export const getClientPriceRefs      = (partId) => get(`/parts/${partId}/client-price-references`);
export const upsertClientPriceRef    = (partId, data) => post(`/parts/${partId}/client-price-references`, data);

export const listCategories    = ()           => get('/part-categories');
export const createCategory    = (data)       => post('/part-categories', data);
export const updateCategory    = (id, data)   => put(`/part-categories/${id}`, data);
export const deleteCategory    = (id)         => del(`/part-categories/${id}`);
