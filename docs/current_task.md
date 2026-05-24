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

## Template

```
## Tarefa atual

**O que:** [descrição objetiva do que está sendo implementado ou corrigido]

**Por quê:** [motivo ou contexto que levou à tarefa]

**Arquivos envolvidos:**
- [arquivo 1]
- [arquivo 2]

**Status:** Em andamento

---

## Resultado (preencher ao concluir)

**O que foi feito:** [resumo do que foi implementado/corrigido]

**Arquivos alterados:**
- [arquivo 1]
- [arquivo 2]

**Impacto no SYSTEM_CONTEXT.md:** [Sim — seção X foi atualizada / Não — mudança não é estrutural]
```
