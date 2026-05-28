import { get, post } from './http';

export const getStockParts     = ()            => get('/stock');
export const getMovements      = (partId)      =>
  partId ? get(`/stock/movements?part_id=${partId}`) : get('/stock/movements');
export const getContractSpend  = ()            => get('/stock/contract-spend');
export const getMovsByDate     = (days = 60)   => get(`/stock/movements-by-date?days=${days}`);
export const createMovement    = (data)        => post('/stock/movements', data);
export const inventoryCount    = (adjustments) => post('/stock/inventory-count', { adjustments });
export const getPartCategories = ()            => get('/part-categories');
