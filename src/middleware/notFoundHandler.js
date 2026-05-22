function notFoundHandler(req, res) {
  const acceptsHtml = (req.headers.accept || "").includes("text/html");

  // Requisições de browser para páginas inexistentes voltam para a raiz.
  if (req.method === "GET" && acceptsHtml) return res.redirect("/");

  return res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.path}`,
  });
}

module.exports = notFoundHandler;
