const PUBLIC_PATHS   = new Set(["/auth/login", "/auth/logout", "/health"]);
const PUBLIC_PREFIXES = ["/css/", "/assets/", "/app/"];
const ADMIN_PAGES    = new Set();

function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (PUBLIC_PREFIXES.some(p => req.path.startsWith(p) || req.path === p.slice(0, -1))) return next();

  if (!req.session?.userId) {
    const acceptsHtml = (req.headers.accept || "").includes("text/html");
    if (req.method === "GET" && acceptsHtml) return res.redirect("/app/login");
    return res.status(401).json({ success: false, message: "Não autenticado." });
  }

  if (ADMIN_PAGES.has(req.path) && req.session.userRole !== "admin") {
    return res.redirect("/");
  }

  next();
}

module.exports = requireAuth;
