'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSnackbar } from '@/components/ui/snackbar';
import { ChamadoCoordMapDialog } from '@/components/chamados/chamado-coord-map-dialog';
import { getStoredAuth, updateChamadoAbertura } from '@/lib/api';
import { resolveChamadoCoordinates } from '@/lib/chamado-geo';
import { composeEnderecoTexto, parseEnderecoTexto } from '@/lib/geocoding';
import { openMapsRoute } from '@/lib/maps-route';
import { ChamadoResumo } from '@/lib/types';

function EditableLabel({
  label,
  editable,
  onEdit,
}: {
  label: string;
  editable?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</p>
      {editable ? (
        <button type="button" onClick={onEdit} className="text-[var(--brand)]" aria-label={`Editar ${label}`}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function displayEndereco(resumo: ChamadoResumo) {
  const texto = resumo.enderecoTexto ?? resumo.unidade?.endereco;
  const bairro = resumo.enderecoBairro ?? resumo.unidade?.bairro;
  return [texto, bairro].filter(Boolean).join(' · ') || '—';
}

export function ChamadoAberturaSection({
  resumo,
  busy,
  onSaved,
}: {
  resumo: ChamadoResumo;
  busy?: boolean;
  onSaved: () => void;
}) {
  const snackbar = useSnackbar();
  const canEdit =
    getStoredAuth()?.user.permissoes.includes('chamados.gerenciar') ||
    getStoredAuth()?.user.permissoes.includes('chamados.editar_abertura');

  const coords = resolveChamadoCoordinates(resumo);
  const [editingField, setEditingField] = useState<'solicitante' | 'endereco' | 'coords' | null>(null);
  const [draftLogradouro, setDraftLogradouro] = useState('');
  const [draftNumero, setDraftNumero] = useState('');
  const [draftComplemento, setDraftComplemento] = useState('');
  const [draftBairro, setDraftBairro] = useState('');
  const [draftCidade, setDraftCidade] = useState('Franca');
  const [draftSolicitante, setDraftSolicitante] = useState('');
  const [draftTelefone, setDraftTelefone] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapEditable, setMapEditable] = useState(false);
  const [saving, setSaving] = useState(false);

  function hydrateEnderecoDraft() {
    const parsed = parseEnderecoTexto(resumo.enderecoTexto ?? resumo.unidade?.endereco, {
      bairro: resumo.enderecoBairro ?? resumo.unidade?.bairro ?? '',
      cidade: 'Franca',
    });
    setDraftLogradouro(parsed.logradouro);
    setDraftNumero(parsed.numero);
    setDraftComplemento(parsed.complemento);
    setDraftBairro(parsed.bairro || resumo.enderecoBairro || resumo.unidade?.bairro || '');
    setDraftCidade(parsed.cidade || 'Franca');
  }

  useEffect(() => {
    hydrateEnderecoDraft();
    setDraftSolicitante(resumo.solicitanteNome ?? '');
    setDraftTelefone(resumo.solicitanteTelefone ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate when chamado address fields change
  }, [resumo.id, resumo.enderecoBairro, resumo.solicitanteNome, resumo.solicitanteTelefone, resumo.enderecoTexto, resumo.unidade]);

  async function saveAbertura(payload: Parameters<typeof updateChamadoAbertura>[1]) {
    setSaving(true);
    try {
      await updateChamadoAbertura(resumo.id, payload);
      onSaved();
      setEditingField(null);
      snackbar.show('Informações de abertura atualizadas.', 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao salvar abertura.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function saveEnderecoEstruturado() {
    const enderecoTexto = composeEnderecoTexto({
      logradouro: draftLogradouro,
      numero: draftNumero,
      complemento: draftComplemento,
      cidade: draftCidade || 'Franca',
    });
    void saveAbertura({
      enderecoTexto: enderecoTexto || null,
      enderecoBairro: draftBairro.trim() || null,
    });
  }

  const enderecoPreview = composeEnderecoTexto({
    logradouro: draftLogradouro,
    numero: draftNumero,
    complemento: draftComplemento,
    cidade: draftCidade || 'Franca',
  });

  return (
    <div className="space-y-4 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <DetailField label="Aberto em">{new Date(resumo.createdAt).toLocaleString('pt-BR')}</DetailField>

      {resumo.unidade ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailField label="Secretaria responsável pelo próprio">
            {resumo.unidade.secretaria
              ? `${resumo.unidade.secretaria.sigla} — ${resumo.unidade.secretaria.nome}`
              : '—'}
          </DetailField>
          <DetailField label="Secretaria responsável pela execução">
            {resumo.secretaria.sigla} — {resumo.secretaria.nome}
          </DetailField>
        </div>
      ) : (
        <DetailField label="Secretaria responsável pela execução">
          {resumo.secretaria.sigla} — {resumo.secretaria.nome}
        </DetailField>
      )}

      <div>
        <EditableLabel
          label="Endereço"
          editable={canEdit}
          onEdit={() => {
            if (editingField === 'endereco') {
              setEditingField(null);
              return;
            }
            hydrateEnderecoDraft();
            setEditingField('endereco');
          }}
        />
        {editingField === 'endereco' ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Logradouro">
                <Input
                  value={draftLogradouro}
                  onChange={(e) => setDraftLogradouro(e.target.value)}
                  disabled={saving || busy}
                  placeholder="Rua, avenida..."
                />
              </Field>
              <Field label="Número">
                <Input
                  value={draftNumero}
                  onChange={(e) => setDraftNumero(e.target.value)}
                  disabled={saving || busy}
                  placeholder="Ex.: 1000"
                />
              </Field>
              <Field label="Complemento">
                <Input
                  value={draftComplemento}
                  onChange={(e) => setDraftComplemento(e.target.value)}
                  disabled={saving || busy}
                  placeholder="Apto, bloco, referência..."
                />
              </Field>
              <Field label="Bairro">
                <Input
                  value={draftBairro}
                  onChange={(e) => setDraftBairro(e.target.value)}
                  disabled={saving || busy}
                  placeholder="Bairro"
                />
              </Field>
              <Field label="Cidade" className="sm:col-span-2">
                <Input
                  value={draftCidade}
                  onChange={(e) => setDraftCidade(e.target.value)}
                  disabled={saving || busy}
                  placeholder="Franca"
                />
              </Field>
            </div>
            {enderecoPreview ? (
              <p className="text-[12px] text-[var(--ink-3)]">
                Endereço completo:{' '}
                <strong className="text-[var(--ink)]">
                  {enderecoPreview}
                  {draftBairro.trim() ? ` · ${draftBairro.trim()}` : ''}
                </strong>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outlined" disabled={saving || busy} onClick={saveEnderecoEstruturado}>
                Salvar
              </Button>
              <Button size="sm" variant="text" disabled={saving || busy} onClick={() => setEditingField(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-2)]">{displayEndereco(resumo)}</p>
        )}
      </div>

      <div>
        <EditableLabel
          label="Solicitante"
          editable={canEdit}
          onEdit={() => setEditingField(editingField === 'solicitante' ? null : 'solicitante')}
        />
        {editingField === 'solicitante' ? (
          <div className="space-y-2">
            <Input value={draftSolicitante} onChange={(e) => setDraftSolicitante(e.target.value)} disabled={saving || busy} placeholder="Nome" />
            <Input value={draftTelefone} onChange={(e) => setDraftTelefone(e.target.value)} disabled={saving || busy} placeholder="Telefone" />
            <Button
              size="sm"
              variant="outlined"
              disabled={saving || busy}
              onClick={() =>
                void saveAbertura({
                  solicitanteNome: draftSolicitante || null,
                  solicitanteTelefone: draftTelefone || null,
                })
              }
            >
              Salvar
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-2)]">
            {resumo.solicitanteNome ?? '—'}
            {resumo.solicitanteTelefone ? ` · ${resumo.solicitanteTelefone}` : ''}
          </p>
        )}
      </div>

      <div>
        <EditableLabel
          label="Coordenadas geográficas"
          editable={canEdit}
          onEdit={() => {
            setMapEditable(true);
            setMapOpen(true);
          }}
        />
        <p className="mono text-[13px] text-[var(--ink-2)]">
          {coords ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : '—'}
        </p>
        {coords ? (
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              type="button"
              className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
              onClick={() => {
                setMapEditable(false);
                setMapOpen(true);
              }}
            >
              Ver no mapa
            </button>
            <button
              type="button"
              className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
              onClick={() => openMapsRoute(coords.latitude, coords.longitude)}
            >
              Obter rota
            </button>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            className="mt-1 text-[12px] font-semibold text-[var(--brand)] hover:underline"
            onClick={() => {
              setMapEditable(true);
              setMapOpen(true);
            }}
          >
            Definir no mapa
          </button>
        ) : null}
      </div>

      <ChamadoCoordMapDialog
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title={mapEditable ? (coords ? 'Editar coordenadas' : 'Adicionar coordenadas') : 'Localização do chamado'}
        latitude={coords?.latitude ?? null}
        longitude={coords?.longitude ?? null}
        editable={mapEditable && Boolean(canEdit)}
        onSave={(next) => void saveAbertura({ latitude: next.latitude, longitude: next.longitude })}
      />
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-[var(--ink-2)]">{children}</p>
    </div>
  );
}
