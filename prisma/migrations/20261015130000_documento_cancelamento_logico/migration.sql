-- 287: cancelamento lógico de documento. Só adiciona colunas, índice e FK; nada é apagado.
ALTER TABLE "Documento" ADD COLUMN "canceladoEm" TIMESTAMP(3);
ALTER TABLE "Documento" ADD COLUMN "canceladoPorId" TEXT;
ALTER TABLE "Documento" ADD COLUMN "canceladoMotivo" TEXT;

ALTER TABLE "Documento" ADD CONSTRAINT "Documento_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
