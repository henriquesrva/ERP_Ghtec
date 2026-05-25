-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'user', 'comercial', 'tecnico', 'financeiro');

-- CreateEnum
CREATE TYPE "KanbanStatus" AS ENUM ('pendente_envio', 'enviado', 'aguardando_compra', 'comprado', 'pendente_execucao', 'faturar', 'faturado');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "ContaStatus" AS ENUM ('em_aberto', 'pago', 'cancelado');

-- CreateEnum
CREATE TYPE "NotaStatus" AS ENUM ('lancada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('produto', 'servico', 'misto');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "signature_cargo" TEXT,
    "signature_telefone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "razao_social" TEXT,
    "nome_fantasia" TEXT,
    "cnpj" TEXT,
    "inscricao_estadual" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "contato_responsavel" TEXT,
    "observacoes" TEXT,
    "has_parts_contract" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "category_id" INTEGER,
    "identity_code" TEXT,
    "codigo_interno" TEXT,
    "ncm" TEXT,
    "preco_compra" DECIMAL(15,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" SERIAL NOT NULL,
    "numero_proposta" TEXT NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "cidade_emissao" TEXT NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL,
    "objeto_proposta" TEXT NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "prazo_pagamento" TEXT NOT NULL,
    "prazo_entrega" TEXT NOT NULL,
    "garantia" TEXT NOT NULL,
    "validade" TEXT NOT NULL,
    "valor_total" DECIMAL(15,2) NOT NULL,
    "valor_total_extenso" TEXT NOT NULL,
    "responsavel_nome" TEXT NOT NULL,
    "responsavel_cargo" TEXT NOT NULL,
    "responsavel_email" TEXT NOT NULL,
    "responsavel_telefone" TEXT NOT NULL,
    "responsible_user_id" INTEGER,
    "responsible_name" TEXT,
    "responsible_role" TEXT,
    "responsible_phone" TEXT,
    "commercial_condition_id" INTEGER,
    "pdf_path" TEXT,
    "kanban_status" "KanbanStatus" NOT NULL DEFAULT 'pendente_envio',
    "kanban_status_updated_at" TIMESTAMP(3),
    "execution_completed" BOOLEAN NOT NULL DEFAULT false,
    "execution_date" TIMESTAMP(3),
    "executed_by" TEXT,
    "execution_os" TEXT,
    "execution_details" TEXT,
    "execution_marked_by_user_id" INTEGER,
    "execution_marked_at" TIMESTAMP(3),
    "approval_date" TIMESTAMP(3),
    "approval_notes" TEXT,
    "approval_attachment_path" TEXT,
    "approval_registered_by_user_id" INTEGER,
    "approval_registered_at" TIMESTAMP(3),
    "billing_date" TIMESTAMP(3),
    "invoice_number" TEXT,
    "billing_notes" TEXT,
    "billed_by_user_id" INTEGER,
    "billed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_items" (
    "id" SERIAL NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "item_ordem" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_unitario" DECIMAL(15,2) NOT NULL,
    "ncm" TEXT,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "part_id" INTEGER,
    "proposal_id" INTEGER NOT NULL,
    "descricao_original" TEXT NOT NULL,
    "descricao_normalizada" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor_unitario" DECIMAL(15,2) NOT NULL,
    "data_proposta" TIMESTAMP(3) NOT NULL,
    "numero_proposta" TEXT NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_client_price_references" (
    "id" SERIAL NOT NULL,
    "part_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "reference_price" DECIMAL(15,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_by_user_id" INTEGER,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_client_price_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_conditions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "prazo_pagamento" TEXT NOT NULL,
    "prazo_entrega" TEXT NOT NULL,
    "garantia" TEXT,
    "validade" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsaveis" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "cargo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_tasks" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kanban_status" "KanbanStatus" NOT NULL DEFAULT 'pendente_envio',
    "kanban_status_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_comments" (
    "id" SERIAL NOT NULL,
    "card_type" TEXT NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_nome" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "part_id" INTEGER NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "entry_type" TEXT,
    "proposal_id" INTEGER,
    "client_id" INTEGER,
    "returns_to_stock" BOOLEAN,
    "notes" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "previous_quantity" INTEGER,
    "new_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" SERIAL NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT,
    "inscricao_estadual" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_despesa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_recebidas" (
    "id" SERIAL NOT NULL,
    "fornecedor_id" INTEGER NOT NULL,
    "numero_nota" TEXT,
    "serie" TEXT,
    "chave_acesso" TEXT,
    "tipo_nota" "TipoNota" NOT NULL DEFAULT 'produto',
    "data_emissao" TIMESTAMP(3),
    "data_entrada" TIMESTAMP(3) NOT NULL,
    "valor_total" DECIMAL(15,2) NOT NULL,
    "descricao" TEXT,
    "categoria_despesa_id" INTEGER,
    "arquivo_pdf" TEXT,
    "arquivo_xml" TEXT,
    "status" "NotaStatus" NOT NULL DEFAULT 'lancada',
    "observacoes" TEXT,
    "natureza_operacao" TEXT,
    "cfop_principal" TEXT,
    "modalidade_frete" INTEGER,
    "valor_frete" DECIMAL(15,2),
    "valor_seguro" DECIMAL(15,2),
    "valor_desconto" DECIMAL(15,2),
    "valor_outras_despesas" DECIMAL(15,2),
    "valor_bc_icms" DECIMAL(15,2),
    "valor_icms" DECIMAL(15,2),
    "valor_ipi" DECIMAL(15,2),
    "valor_pis" DECIMAL(15,2),
    "valor_cofins" DECIMAL(15,2),
    "valor_iss" DECIMAL(15,2),
    "numero_protocolo" TEXT,
    "data_autorizacao" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_recebidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_nota_recebida" (
    "id" SERIAL NOT NULL,
    "nota_recebida_id" INTEGER NOT NULL,
    "produto_id" INTEGER,
    "numero_item" INTEGER NOT NULL,
    "codigo_produto" TEXT,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "unidade" TEXT,
    "quantidade" DECIMAL(15,4),
    "valor_unitario" DECIMAL(15,4),
    "valor_total" DECIMAL(15,2),
    "valor_desconto" DECIMAL(15,2),
    "origem_mercadoria" TEXT,
    "cst_icms" TEXT,
    "csosn" TEXT,
    "modalidade_bc_icms" INTEGER,
    "reducao_base_icms" DECIMAL(6,4),
    "valor_bc_icms" DECIMAL(15,2),
    "aliquota_icms" DECIMAL(6,4),
    "valor_icms" DECIMAL(15,2),
    "valor_bc_icms_st" DECIMAL(15,2),
    "aliquota_icms_st" DECIMAL(6,4),
    "valor_icms_st" DECIMAL(15,2),
    "cst_ipi" TEXT,
    "codigo_enquadramento_ipi" TEXT,
    "valor_bc_ipi" DECIMAL(15,2),
    "aliquota_ipi" DECIMAL(6,4),
    "valor_ipi" DECIMAL(15,2),
    "cst_pis" TEXT,
    "valor_bc_pis" DECIMAL(15,2),
    "aliquota_pis" DECIMAL(6,4),
    "valor_pis" DECIMAL(15,2),
    "cst_cofins" TEXT,
    "valor_bc_cofins" DECIMAL(15,2),
    "aliquota_cofins" DECIMAL(6,4),
    "valor_cofins" DECIMAL(15,2),
    "aliquota_iss" DECIMAL(6,4),
    "valor_iss" DECIMAL(15,2),
    "cest" TEXT,
    "informacoes_adicionais" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_nota_recebida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_pagar" (
    "id" SERIAL NOT NULL,
    "fornecedor_id" INTEGER NOT NULL,
    "nota_recebida_id" INTEGER,
    "categoria_despesa_id" INTEGER,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "forma_pagamento" TEXT,
    "status" "ContaStatus" NOT NULL DEFAULT 'em_aberto',
    "data_pagamento" TIMESTAMP(3),
    "valor_pago" DECIMAL(15,2),
    "comprovante_pagamento" TEXT,
    "paid_by" INTEGER,
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "observacoes" TEXT,
    "parcela_numero" INTEGER,
    "parcela_total" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "clients_nome_idx" ON "clients"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "part_categories_code_key" ON "part_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "parts_codigo_interno_key" ON "parts"("codigo_interno");

-- CreateIndex
CREATE UNIQUE INDEX "parts_nome_marca_modelo_key" ON "parts"("nome", "marca", "modelo");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_numero_proposta_key" ON "proposals"("numero_proposta");

-- CreateIndex
CREATE INDEX "proposals_cliente_id_idx" ON "proposals"("cliente_id");

-- CreateIndex
CREATE INDEX "proposals_kanban_status_idx" ON "proposals"("kanban_status");

-- CreateIndex
CREATE INDEX "proposals_data_emissao_idx" ON "proposals"("data_emissao");

-- CreateIndex
CREATE INDEX "price_history_client_id_part_id_idx" ON "price_history"("client_id", "part_id");

-- CreateIndex
CREATE INDEX "price_history_client_id_descricao_normalizada_idx" ON "price_history"("client_id", "descricao_normalizada");

-- CreateIndex
CREATE INDEX "price_history_client_id_data_proposta_idx" ON "price_history"("client_id", "data_proposta" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "part_client_price_references_part_id_client_id_key" ON "part_client_price_references"("part_id", "client_id");

-- CreateIndex
CREATE INDEX "kanban_comments_card_type_card_id_idx" ON "kanban_comments"("card_type", "card_id");

-- CreateIndex
CREATE INDEX "stock_movements_part_id_idx" ON "stock_movements"("part_id");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_idx" ON "stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "fornecedores_cnpj_idx" ON "fornecedores"("cnpj");

-- CreateIndex
CREATE INDEX "notas_recebidas_fornecedor_id_idx" ON "notas_recebidas"("fornecedor_id");

-- CreateIndex
CREATE INDEX "notas_recebidas_chave_acesso_idx" ON "notas_recebidas"("chave_acesso");

-- CreateIndex
CREATE UNIQUE INDEX "notas_recebidas_fornecedor_id_numero_nota_serie_key" ON "notas_recebidas"("fornecedor_id", "numero_nota", "serie");

-- CreateIndex
CREATE INDEX "itens_nota_recebida_nota_recebida_id_idx" ON "itens_nota_recebida"("nota_recebida_id");

-- CreateIndex
CREATE INDEX "contas_pagar_fornecedor_id_idx" ON "contas_pagar"("fornecedor_id");

-- CreateIndex
CREATE INDEX "contas_pagar_nota_recebida_id_idx" ON "contas_pagar"("nota_recebida_id");

-- CreateIndex
CREATE INDEX "contas_pagar_data_vencimento_status_idx" ON "contas_pagar"("data_vencimento", "status");

-- CreateIndex
CREATE INDEX "contas_pagar_status_idx" ON "contas_pagar"("status");

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "part_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_commercial_condition_id_fkey" FOREIGN KEY ("commercial_condition_id") REFERENCES "commercial_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_billed_by_user_id_fkey" FOREIGN KEY ("billed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_approval_registered_by_user_id_fkey" FOREIGN KEY ("approval_registered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_execution_marked_by_user_id_fkey" FOREIGN KEY ("execution_marked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_client_price_references" ADD CONSTRAINT "part_client_price_references_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_client_price_references" ADD CONSTRAINT "part_client_price_references_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_client_price_references" ADD CONSTRAINT "part_client_price_references_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_client_price_references" ADD CONSTRAINT "part_client_price_references_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_recebidas" ADD CONSTRAINT "notas_recebidas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_recebidas" ADD CONSTRAINT "notas_recebidas_categoria_despesa_id_fkey" FOREIGN KEY ("categoria_despesa_id") REFERENCES "categorias_despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_recebidas" ADD CONSTRAINT "notas_recebidas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_nota_recebida" ADD CONSTRAINT "itens_nota_recebida_nota_recebida_id_fkey" FOREIGN KEY ("nota_recebida_id") REFERENCES "notas_recebidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_nota_recebida" ADD CONSTRAINT "itens_nota_recebida_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_nota_recebida_id_fkey" FOREIGN KEY ("nota_recebida_id") REFERENCES "notas_recebidas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_categoria_despesa_id_fkey" FOREIGN KEY ("categoria_despesa_id") REFERENCES "categorias_despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
