import { ChecklistVersaoStatus, ChecklistEscopo, ChecklistFinalidade } from '@prisma/client';
import { ChecklistDto, ChecklistVersionDto } from './checklists.dto';
import { assertValidChecklistVersionItems, normalizeChecklistItemOpcoes } from './checklist-item.rules';

export function canEditChecklistVersion(status: ChecklistVersaoStatus) {
  return status === ChecklistVersaoStatus.RASCUNHO;
}

export function nextChecklistVersion(currentVersions: Array<{ versao: number }>) {
  if (currentVersions.length === 0) {
    return 1;
  }

  return Math.max(...currentVersions.map((item) => item.versao)) + 1;
}

export function assertDraftEditable(status: ChecklistVersaoStatus) {
  if (!canEditChecklistVersion(status)) {
    throw new Error('Somente versoes em rascunho podem ser editadas');
  }
}

export function normalizeItemCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

export function resolveChecklistFinalidades(dto: ChecklistDto): ChecklistFinalidade[] {
  const fromArray = (dto.finalidades ?? []).filter(Boolean);
  if (fromArray.length > 0) {
    return Array.from(new Set(fromArray));
  }
  return [dto.finalidade ?? ChecklistFinalidade.VISTORIA];
}

export function resolvePrimaryFinalidade(finalidades: ChecklistFinalidade[]): ChecklistFinalidade {
  if (finalidades.includes(ChecklistFinalidade.CHAMADO)) return ChecklistFinalidade.CHAMADO;
  if (finalidades.includes(ChecklistFinalidade.VISTORIA)) return ChecklistFinalidade.VISTORIA;
  if (finalidades.includes(ChecklistFinalidade.DOCUMENTO_AVULSO)) return ChecklistFinalidade.DOCUMENTO_AVULSO;
  return ChecklistFinalidade.VISTORIA;
}

export function validateChecklistEscopo(dto: ChecklistDto) {
  const finalidades = resolveChecklistFinalidades(dto);
  if (finalidades.length === 0) {
    throw new Error('Selecione ao menos uma finalidade de uso do checklist.');
  }

  if (finalidades.includes(ChecklistFinalidade.CHAMADO)) {
    if (!dto.tipoChamadoIds?.length) {
      throw new Error('Vincule o checklist a ao menos um tipo de chamado.');
    }
  }

  const needsEscopo =
    finalidades.includes(ChecklistFinalidade.VISTORIA) ||
    (finalidades.includes(ChecklistFinalidade.DOCUMENTO_AVULSO) &&
      !finalidades.includes(ChecklistFinalidade.CHAMADO));

  if (!needsEscopo) return;

  if (finalidades.includes(ChecklistFinalidade.VISTORIA)) {
    if (dto.escopo === ChecklistEscopo.UNIDADE_TIPO && !dto.unidadeTipo) {
      throw new Error('Informe o tipo de proprio para checklists com escopo por tipo.');
    }
    if (dto.escopo === ChecklistEscopo.SECRETARIA && !dto.secretariaId) {
      throw new Error('Informe a secretaria para checklists com escopo por secretaria.');
    }
    if (dto.escopo === ChecklistEscopo.UNIDADE && !dto.unidadeId) {
      throw new Error('Informe o proprio para checklists com escopo por unidade.');
    }
  }
}

export function normalizeChecklistBinding(dto: ChecklistDto): ChecklistDto {
  const finalidades = resolveChecklistFinalidades(dto);
  const finalidade = resolvePrimaryFinalidade(finalidades);

  if (finalidade === ChecklistFinalidade.CHAMADO && !finalidades.includes(ChecklistFinalidade.VISTORIA)) {
    return {
      ...dto,
      finalidade,
      finalidades,
      escopo: ChecklistEscopo.GLOBAL,
      secretariaId: undefined,
      unidadeId: undefined,
      unidadeTipo: undefined,
      tipoChamadoIds: Array.from(new Set((dto.tipoChamadoIds ?? []).map((id) => id.trim()).filter(Boolean))),
    };
  }

  if (finalidade === ChecklistFinalidade.DOCUMENTO_AVULSO && !finalidades.includes(ChecklistFinalidade.VISTORIA)) {
    return {
      ...dto,
      finalidade,
      finalidades,
      escopo: dto.escopo ?? ChecklistEscopo.GLOBAL,
      secretariaId: dto.secretariaId || undefined,
      unidadeId: dto.unidadeId || undefined,
      unidadeTipo: dto.unidadeTipo || undefined,
      tipoChamadoIds: finalidades.includes(ChecklistFinalidade.CHAMADO)
        ? Array.from(new Set((dto.tipoChamadoIds ?? []).map((id) => id.trim()).filter(Boolean)))
        : undefined,
    };
  }

  const base = {
    ...dto,
    finalidade,
    finalidades,
    secretariaId: dto.secretariaId || undefined,
    unidadeId: dto.unidadeId || undefined,
    unidadeTipo: dto.unidadeTipo || undefined,
    tipoChamadoIds: finalidades.includes(ChecklistFinalidade.CHAMADO)
      ? Array.from(new Set((dto.tipoChamadoIds ?? []).map((id) => id.trim()).filter(Boolean)))
      : undefined,
  };

  switch (dto.escopo) {
    case ChecklistEscopo.GLOBAL:
      return { ...base, secretariaId: undefined, unidadeId: undefined, unidadeTipo: undefined };
    case ChecklistEscopo.SECRETARIA:
      return { ...base, unidadeId: undefined, unidadeTipo: undefined };
    case ChecklistEscopo.UNIDADE_TIPO:
      return { ...base, unidadeId: undefined };
    case ChecklistEscopo.UNIDADE:
      return { ...base, unidadeTipo: undefined };
    default:
      return base;
  }
}

export function assertValidChecklistVersion(
  dto: ChecklistVersionDto,
  options?: { finalidadeChamado?: boolean },
) {
  assertValidChecklistVersionItems(dto.itens, {
    finalidadeChamado: options?.finalidadeChamado,
    requireCategoria: !options?.finalidadeChamado,
  });
}

export { normalizeChecklistItemOpcoes };
