import { get } from './http';

export const searchParts = (q) => get(`/parts/search?q=${encodeURIComponent(q)}`);
