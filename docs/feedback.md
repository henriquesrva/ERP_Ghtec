# current_task.md

## Função deste arquivo

Registra a tarefa atual sendo trabalhada no sistema.

Deve conter apenas **uma tarefa por vez** — a que está em andamento agora.

Ao concluir uma tarefa, a IA deve:
1. Avaliar se a mudança altera algo estrutural do sistema
2. Se sim, atualizar a seção relevante do `SYSTEM_CONTEXT.md`
3. Limpar este arquivo e deixar o status como `Nenhuma tarefa em andamento`

---

## Instruções para a IA

- Atualize este arquivo ao iniciar qualquer tarefa relevante
- Seja objetivo: descreva o que está sendo feito, não como vai fazer
- Ao terminar, escreva o resultado e avalie o impacto no `SYSTEM_CONTEXT.md`
- Não acumule tarefas antigas aqui — este arquivo é sempre sobre o presente

---

## Status atual

**Nenhuma tarefa em andamento.**

---

## Última tarefa concluída

**O que foi feito:**
- Corrigido loading infinito na tela de nova proposta (`nova-proposta.html`) — `loadSignaturePreview()` agora tem `showState()` helper com 4 estados (loading, loaded, nosig, error), nunca fica preso em skeleton
- Adicionados estados `#resp-nosig` e `#resp-error` no card de assinatura
- Adicionada variável `currentUser` para guardar usuário logado
- Adicionada validação de assinatura no handler de submit (bloqueia antes de fazer request)
- Adicionada validação de `numero_proposta` vazio no submit handler
- Corrigidos 4 itens obsoletos no `SYSTEM_CONTEXT.md` (extensao, session store, payload)
- Adicionada regra permanente 20 no SYSTEM_CONTEXT.md: assinatura vem do usuário logado

**Arquivos alterados:**
- `public/nova-proposta.html`
- `docs/SYSTEM_CONTEXT.md`

**Impacto no SYSTEM_CONTEXT.md:** Sim — seção 14 item 20 adicionado (regra permanente de assinatura), + 4 itens obsoletos corrigidos
