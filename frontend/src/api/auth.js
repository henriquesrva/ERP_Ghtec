import http from './http';

export const getMe  = ()      => http.get('/auth/me');
export const login  = (creds) => http.post('/auth/login', creds);
export const logout = ()      => http.post('/auth/logout');
