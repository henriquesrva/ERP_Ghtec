(async function initAuth() {
  try {
    const res = await fetch("/auth/me");
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await res.json();
    const label = document.getElementById("navUserLabel");
    if (label && data.user) label.textContent = data.user.nome;
  } catch {
    window.location.href = "/login.html";
  }

  _markActiveNav();
})();

function logout() {
  fetch("/auth/logout", { method: "POST" }).finally(() => {
    window.location.href = "/login.html";
  });
}

function _markActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  const groupMap = {
    '/proposals.html':      'comercial',
    '/kanban.html':         'comercial',
    '/clients.html':        'comercial',
    '/objetos.html':        'comercial',
    '/parts.html':          'operacional',
    '/stock.html':          'operacional',
    '/fornecedores.html':   'operacional',
    '/notas-recebidas.html':'operacional',
    '/contas-pagar.html':   'financeiro',
    '/financeiro.html':     'financeiro',
    '/usuarios.html':       'admin',
    '/responsaveis.html':   'admin',
  };

  const group = groupMap[path];

  if (group && group !== 'admin') {
    const groupEl = document.querySelector(`.nav-group[data-group="${group}"]`);
    if (groupEl) groupEl.classList.add('active');
  }

  // Marca o link específico dentro do dropdown
  const link = document.querySelector(`.nav-dd-link[href="${path}"]`) ||
               document.querySelector(`.nav-dd-link[href="${path}.html"]`);
  if (link) link.classList.add('active');

  // Marca o ícone de admin
  if (group === 'admin') {
    const adminLink = document.querySelector('.nav-icon-link');
    if (adminLink) adminLink.classList.add('active');
  }

  // Wire up dropdown toggle via click (mobile/keyboard)
  document.querySelectorAll('.nav-group').forEach(group => {
    const btn = group.querySelector('.nav-group-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      const wasOpen = group.classList.contains('open');
      document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
      if (!wasOpen) group.classList.add('open');
      e.stopPropagation();
    });
  });

  // Fecha dropdowns ao clicar fora
  document.addEventListener('click', () => {
    document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
  });

  // Fecha com Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
    }
  });
}
