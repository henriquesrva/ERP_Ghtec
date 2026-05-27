# Feedback — Passo 4.4: Migração Usuários

## Arquivos criados

- `frontend/src/api/users.js` — listUsers, createUser, changeUserRole, deleteUser, changePassword, updateSignature
- `frontend/src/pages/Usuarios.jsx` — componente completo com sub-componentes: UsersTable, PasswordCard, SignatureCard

## Arquivos alterados

- `frontend/src/router.jsx` — `/usuarios` saiu do LEGACY, ganhou `<Route>` própria; importado Usuarios
- `frontend/src/components/layout/Navbar.jsx` — gear icon mudou de `<a href="/legacy/usuarios.html">` para `<Link to="/usuarios">` React Router

## Endpoints usados

| Método | Rota | Quem pode |
|---|---|---|
| GET | `/users` | admin |
| POST | `/users` | admin |
| PUT | `/users/:id/role` | admin |
| DELETE | `/users/:id` | admin |
| PUT | `/users/me/password` | todos |
| PUT | `/users/me/signature` | todos |

## Comportamentos migrados

**Admin:**
- Layout split: formulário de criação (esquerda) + [tabela + senha + assinatura] (direita)
- Tabela de usuários com select de role por linha e botão "Salvar" que aparece só quando há mudança pendente
- Badges de role com cores por perfil (admin/user/comercial/tecnico/financeiro)
- Botão "Excluir" desabilitado para o próprio usuário logado
- ConfirmModal antes de excluir
- Toast para role change e exclusão

**Todos os usuários:**
- Card "Trocar minha senha" (atual + nova + confirmação, validação de match)
- Card "Minha Assinatura" (cargo + telefone, pré-populado do AuthContext)
- Após salvar assinatura, atualiza AuthContext para refletir na geração de propostas

**Não-admin:**
- Layout simplificado: apenas senha + assinatura (sem tabela nem criação)

## Regras de permissão preservadas

- Gestão de usuários (criar/alterar role/excluir) só visível para `user.role === 'admin'`
- Backend continua sendo a fonte da regra (403 retornado pelo server para não-admin)
- Botão excluir desabilitado para próprio usuário (`u.id === me?.id`)
- Assinatura acessível a todos

## Como ficou /app/usuarios

Rota React. Gear icon da Navbar aponta para `/app/usuarios` via Link React. `isAdmin` já detecta `/usuarios` path para ativo.

## O que ainda está em legacy

`public/legacy/usuarios.html` — mantido, navegação principal usa React.

## Validações executadas

- `npm run frontend:build` → ✅ (211KB / gzip 65KB)
- `npm test` → ✅ 408/408
- `npm run prisma:status` → ✅ schema up to date
- `node scripts/check-prisma-connection.js` → ✅ Prisma conectado

## Documentação

`SYSTEM_CONTEXT.md` não atualizado — migração de tela individual não constitui mudança estrutural.
