/**
 * Camada base de HTTP.
 * Centraliza credentials, Content-Type e tratamento de erro.
 */
async function request(url, options = {}) {
  const headers = { ...options.headers };

  // Não define Content-Type para FormData — browser define com boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  // Tenta parsear JSON mesmo em erros (para pegar data.message)
  const data = await res.json().catch(() => ({
    message: `Erro ${res.status} — resposta não era JSON.`,
  }));

  if (!res.ok) {
    const err    = new Error(data.message || `Erro ${res.status}`);
    err.status   = res.status;
    err.data     = data;
    throw err;
  }

  return data;
}

export const get  = (url)         => request(url);
export const post = (url, body)   => request(url, {
  method: 'POST',
  body: body instanceof FormData ? body : JSON.stringify(body),
});
export const put  = (url, body)   => request(url, { method: 'PUT',    body: JSON.stringify(body) });
export const del  = (url)         => request(url, { method: 'DELETE' });

export default { get, post, put, del };
