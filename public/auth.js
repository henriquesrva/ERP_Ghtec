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
})();

function logout() {
  fetch("/auth/logout", { method: "POST" }).finally(() => {
    window.location.href = "/login.html";
  });
}
