import { get, post, del } from './http';

// PUT genérico que suporta JSON e FormData
async function putAny(url, body) {
  const isFormData = body instanceof FormData;
  const res = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ message: `Erro ${res.status}` }));
  if (!res.ok) {
    const err = new Error(data.message || `Erro ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const getCards    = ()                       => get('/kanban/cards');
export const getComments = (type, id)               => get(`/kanban/comments/${type}/${id}`);
export const addComment  = (cardType, cardId, comment) =>
  post('/kanban/comments', { cardType, cardId, comment });

export const createTask          = (title, description)   => post('/kanban/tasks', { title, description });
export const updateTask          = (id, title, description) => putAny(`/kanban/tasks/${id}`, { title, description });
export const moveTask            = (id, status)            => putAny(`/kanban/tasks/${id}/status`, { status });
export const deleteTask          = (id)                    => del(`/kanban/tasks/${id}`);
export const linkTaskToProposal  = (taskId, proposalId)   =>
  post(`/kanban/tasks/${taskId}/link-proposal`, { proposal_id: proposalId });

export const moveProposal     = (id, status)   => putAny(`/proposals/${id}/kanban-status`, { status });
export const markExecution    = (id, body)     => putAny(`/proposals/${id}/execution`, body);
export const removeExecution  = (id)           => del(`/proposals/${id}/execution`);
export const registerApproval = (id, formData) => putAny(`/proposals/${id}/approval`, formData);
export const registerBilling  = (id, body)     => putAny(`/proposals/${id}/billing`, body);
