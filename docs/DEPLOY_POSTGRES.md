# Deploy em Produção — PostgreSQL/Prisma

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+ provisionado e acessível
- Variáveis de ambiente configuradas (ver seção abaixo)

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```env
# OBRIGATÓRIO em produção — string longa e aleatória
SESSION_SECRET=<string-de-32+-chars>

# Porta do servidor (padrão: 3000)
PORT=3000

# Deve ser "production" em produção
NODE_ENV=production

# URL do banco PostgreSQL provisionado
DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/BANCO"
```

**Gerar SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> O servidor **não sobe** em produção sem `SESSION_SECRET` definido — fail-fast intencional em `server.js`.

---

## Passos de Deploy

### 1. Provisionar PostgreSQL

Crie um banco PostgreSQL vazio. Exemplos de providers:
- Supabase, Railway, Render, Neon, AWS RDS, Azure Database
- Ou instância própria com `docker run postgres:16-alpine`

Anote a `DATABASE_URL` no formato:
```
postgresql://USUARIO:SENHA@HOST:PORTA/BANCO
```

### 2. Configurar .env

```bash
cp .env.example .env
# Editar .env com os valores reais de produção
```

### 3. Instalar dependências

```bash
npm install --production
```

> Em ambientes com CI/CD, use `npm ci` para instalação determinística.

### 4. Gerar Prisma Client

```bash
npm run prisma:generate
```

Isso gera `src/generated/prisma/` a partir do `prisma/schema.prisma`. **Necessário antes de subir o servidor.**

### 5. Aplicar migrations

```bash
npm run prisma:deploy
```

Equivale a `prisma migrate deploy` — aplica todas as migrations pendentes sem criar novas. **Seguro para uso em CI/CD e produção.**

> Nunca use `prisma migrate dev` em produção — ele tenta criar migrations interativamente.

### 6. Criar usuário admin inicial

```bash
node scripts/seed-postgres.js
```

O script é **idempotente**: se o usuário `admin` já existir, ele não faz nada.

Saída esperada na primeira execução:
```
✅  Usuário admin criado com sucesso (id=1).
   username: admin
   senha:    admin123
   ⚠️  Altere a senha após o primeiro login.
```

**⚠️ Trocar a senha imediatamente após o primeiro acesso.**

### 7. Subir o servidor

```bash
npm start
```

Ou com PM2 para produção contínua:
```bash
pm2 start src/server.js --name ghtec-erp
```

### 8. Testar /health

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "ok": true,
  "db": "postgres",
  "prisma": true,
  "sessionStore": "sqlite"
}
```

Se PostgreSQL estiver inacessível, retorna HTTP 503.

### 9. Fazer login

Acesse `http://HOST:PORT` e faça login com:
- Usuário: `admin`
- Senha: `admin123`

### 10. Trocar senha admin

Em `Usuários` → editar admin → alterar senha para algo seguro.

---

## Validações Pós-Deploy

Rode estas verificações para confirmar que tudo está ok:

```bash
# Status das migrations — deve mostrar "Database schema is up to date!"
npm run prisma:status

# Testes automatizados (não precisam de banco)
npm test

# Validação real de CRUD contra o banco (cria e remove dados de teste)
# ATENÇÃO: conecta ao banco definido em DATABASE_URL e executa 15 seções de CRUD real
node scripts/check-prisma-connection.js
```

> `check-prisma-connection.js` cria registros de teste em cada tabela e os remove ao final. **Não execute em banco com dados que não possam ser temporariamente afetados.**

---

## SessionStore

As sessões de usuário ficam em `sessions.sqlite` (arquivo local no diretório raiz do projeto).

**Importante para hospedagem em nuvem:**
- Em ambientes com **sistema de arquivos efêmero** (Heroku dynos, Railway containers sem volume persistente, etc.), o arquivo `sessions.sqlite` será apagado a cada deploy/restart, derrubando todas as sessões ativas.
- Para evitar isso, use um volume persistente montado no diretório do projeto.
- Alternativa futura: migrar `sessionStore.js` para PostgreSQL ou Redis (não incluído nesta versão).

---

## Infraestrutura Recomendada para Produção

| Componente | Sugestão |
|-----------|---------|
| Servidor app | PM2 com 1 worker (Puppeteer é pesado — evitar múltiplos workers) |
| Reverse proxy | nginx com SSL/TLS (certbot) |
| Banco de dados | PostgreSQL 14+ (gerenciado ou próprio) |
| Sessões | Volume persistente para `sessions.sqlite` (curto prazo) |
| Logs | PM2 log rotation ou agregador externo |
| PDFs gerados | `output/proposals/` — usar volume persistente ou S3 |

---

## Variáveis de Ambiente — Resumo

| Variável | Obrigatória em prod | Descrição |
|----------|-------------------|-----------|
| `SESSION_SECRET` | ✅ Sim | Segredo do cookie (mín. 32 chars) |
| `DATABASE_URL` | ✅ Sim | URL PostgreSQL completa |
| `NODE_ENV` | ✅ Sim | Deve ser `"production"` |
| `PORT` | Não | Porta do servidor (padrão: 3000) |

---

## Troubleshooting

**Servidor não sobe com erro SESSION_SECRET:**
→ Defina `SESSION_SECRET` no `.env`. Em produção, o servidor falha intencionalmente sem ele.

**`prisma:deploy` falha com "Migration not found":**
→ Certifique que `prisma/migrations/` está incluído no deploy (não está no `.gitignore`).

**`prisma:generate` falha com "Module not found":**
→ Rode `npm install` antes de `prisma:generate`.

**`/health` retorna 503:**
→ PostgreSQL está inacessível. Verifique `DATABASE_URL`, firewall e status do banco.

**Sessões expiram após restart:**
→ O `sessions.sqlite` está em armazenamento efêmero. Configure volume persistente (ver seção SessionStore acima).
