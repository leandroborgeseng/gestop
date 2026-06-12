import { PrismaService } from '../prisma/prisma.service';
import { isUuid } from '../common/uuid';

/** Evita FK em LogAuditoria quando o JWT referencia usuario removido/recriado. */
export async function resolveAuditUsuarioId(
  prisma: PrismaService,
  usuarioId: string | undefined,
): Promise<string | undefined> {
  if (!isUuid(usuarioId)) return undefined;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, ativo: true },
  });

  return usuario?.ativo ? usuario.id : undefined;
}
