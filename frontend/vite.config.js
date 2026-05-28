import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Todos os prefixos de API do Express — proxy de dev para localhost:3000
const expressRoutes = [
  '/auth', '/users', '/clients', '/parts', '/part-categories',
  '/items', '/responsaveis', '/commercial-conditions', '/objetos',
  '/proposals', '/kanban', '/stock', '/fornecedores',
  '/categorias-despesa', '/notas-recebidas', '/contas-pagar',
  '/files', '/health',
  // Assets servidos pelo Express (logo, etc.)
  '/assets',
];

function proxyEntries() {
  const entries = {};
  for (const route of expressRoutes) {
    entries[route] = {
      target: 'http://localhost:3000',
      changeOrigin: true,
    };
  }
  return entries;
}

export default defineConfig({
  // Base para produção — React serve sob /app no Express
  base: '/app/',

  plugins: [react()],

  server: {
    port: 5173,
    proxy: proxyEntries(),
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
