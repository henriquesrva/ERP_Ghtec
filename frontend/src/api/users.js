import http from './http';

export const listUsers       = ()               => http.get('/users');
export const createUser      = (data)           => http.post('/users', data);
export const changeUserRole  = (id, role)       => http.put(`/users/${id}/role`, { role });
export const deleteUser      = (id)             => http.del(`/users/${id}`);
export const changePassword  = (current, novo)  => http.put('/users/me/password', { currentPassword: current, newPassword: novo });
export const updateSignature = (cargo, telefone) => http.put('/users/me/signature', { cargo, telefone });
