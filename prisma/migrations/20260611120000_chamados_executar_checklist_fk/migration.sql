-- Permissão chamados.executar + vínculo com perfis operacionais
INSERT INTO "Permissao" ("id", "chave", "descricao", "modulo", "createdAt")
SELECT gen_random_uuid()::text, 'chamados.executar', 'Executar chamados em campo', 'chamados', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Permissao" WHERE "chave" = 'chamados.executar');

INSERT INTO "PerfilPermissao" ("perfilId", "permissaoId")
SELECT p.id, perm.id
FROM "Perfil" p
CROSS JOIN "Permissao" perm
WHERE perm.chave = 'chamados.executar'
  AND p.nome IN ('Administrador do Sistema', 'Gestor CCO', 'Operador de Manutencao')
  AND NOT EXISTS (
    SELECT 1 FROM "PerfilPermissao" pp
    WHERE pp."perfilId" = p.id AND pp."permissaoId" = perm.id
  );

-- Operador de manutenção: execução em campo, não triagem/backoffice
DELETE FROM "PerfilPermissao" pp
USING "Perfil" p, "Permissao" perm
WHERE pp."perfilId" = p.id
  AND pp."permissaoId" = perm.id
  AND p.nome = 'Operador de Manutencao'
  AND perm.chave = 'chamados.gerenciar';

-- FK Checklist.unidadeId → UnidadePublica
UPDATE "Checklist"
SET "unidadeId" = NULL
WHERE "unidadeId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "UnidadePublica" u WHERE u.id = "Checklist"."unidadeId");

ALTER TABLE "Checklist"
ADD CONSTRAINT "Checklist_unidadeId_fkey"
FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
