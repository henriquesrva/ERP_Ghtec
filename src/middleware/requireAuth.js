const PUBLIC_PATHS  = new Set(["/login.html", "/auth/login", "/auth/logout", "/health"]);
const ADMIN_PAGES   = new Set(["/usuarios.html"]);

function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();

  if (!req.session?.userId) {
    const acceptsHtml = (req.headers.accept || "").includes("text/html");
    if (req.method === "GET" && acceptsHtml) return res.redirect("/login.html");
    return res.status(401).json({ success: false, message: "Não autenticado." });
  }

  if (ADMIN_PAGES.has(req.path) && req.session.userRole !== "admin") {
    return res.redirect("/");
  }

  next();
}

module.exports = requireAuth;
