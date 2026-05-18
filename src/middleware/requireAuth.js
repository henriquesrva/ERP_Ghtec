const PUBLIC_PATHS = new Set(["/login.html", "/auth/login", "/auth/logout", "/health"]);

function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (req.session && req.session.userId) return next();

  const acceptsHtml = (req.headers.accept || "").includes("text/html");
  if (req.method === "GET" && acceptsHtml) return res.redirect("/login.html");
  res.status(401).json({ success: false, message: "Não autenticado." });
}

module.exports = requireAuth;
