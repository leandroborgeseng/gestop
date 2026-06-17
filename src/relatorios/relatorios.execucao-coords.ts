import { PrismaService } from '../prisma/prisma.service';
import { parseExecucaoCheckinMetadata } from '../chamados/chamados.rules';

export type ExecucaoCoordenadas = {
  latitude: number;
  longitude: number;
};

function parseConclusaoCheckin(metadata: unknown): ExecucaoCoordenadas | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const checkin = (metadata as { checkin?: { latitude?: number; longitude?: number } }).checkin;
  if (checkin?.latitude == null || checkin?.longitude == null) return null;
  return { latitude: checkin.latitude, longitude: checkin.longitude };
}

export async function loadExecucaoCoordenadas(
  prisma: PrismaService,
  chamadoIds: string[],
): Promise<Map<string, ExecucaoCoordenadas>> {
  const result = new Map<string, ExecucaoCoordenadas>();
  if (chamadoIds.length === 0) return result;

  const registros = await prisma.historicoStatus.findMany({
    where: {
      entidadeTipo: 'Chamado',
      entidadeId: { in: chamadoIds },
      OR: [
        { metadata: { path: ['tipo'], equals: 'execucao_checkin' } },
        { metadata: { path: ['tipo'], equals: 'execucao_conclusao' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { entidadeId: true, metadata: true, createdAt: true },
  });

  for (const registro of registros) {
    const tipo = (registro.metadata as { tipo?: string } | null)?.tipo;
    if (tipo === 'execucao_checkin') {
      const parsed = parseExecucaoCheckinMetadata(registro.metadata, registro.createdAt);
      if (parsed) {
        result.set(registro.entidadeId, {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        });
      }
      continue;
    }

    if (tipo === 'execucao_conclusao' && !result.has(registro.entidadeId)) {
      const parsed = parseConclusaoCheckin(registro.metadata);
      if (parsed) {
        result.set(registro.entidadeId, parsed);
      }
    }
  }

  return result;
}

export function formatCoordenada(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '';
  return value.toFixed(6);
}
