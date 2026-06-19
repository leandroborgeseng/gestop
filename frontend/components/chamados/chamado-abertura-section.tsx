'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSnackbar } from '@/components/ui/snackbar';
import { ChamadoCoordMapDialog } from '@/components/chamados/chamado-coord-map-dialog';
import { getStoredAuth, updateChamadoAbertura } from '@/lib/api';
import { resolveChamadoCoordinates } from '@/lib/chamado-geo';
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
  const [editingField, setEditingField] = useState<'bairro' | 'solicitante' | 'endereco' | 'coords' | null>(null);
  const [draftBairro, setDraftBairro] = useState('');
  const [draftSolicitante, setDraftSolicitante] = useState('');
  const [draftTelefone, setDraftTelefone] = useState('');
  const [draftEndereco, setDraftEndereco] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapEditable, setMapEditable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftBairro(resumo.enderecoBairro ?? resumo.unidade?.bairro ?? '');
    setDraftSolicitante(resumo.solicitanteNome ?? '');
    setDraftTelefone(resumo.solicitanteTelefone ?? '');
    setDraftEndereco(resumo.enderecoTexto ?? resumo.unidade?.endereco ?? '');
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

  return (
    <div className="space-y-4 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <DetailField label="Aberto em">{new Date(resumo.createdAt).toLocaleString('pt-BR')}</DetailField>

      <div>
        <EditableLabel
          label="Bairro"
          editable={canEdit}
          onEdit={() => setEditingField(editingField === 'bairro' ? null : 'bairro')}
        />
        {editingField === 'bairro' ? (
          <div className="flex gap-2">
            <Input value={draftBairro} onChange={(e) => setDraftBairro(e.target.value)} disabled={saving || busy} />
            <Button
              size="sm"
              variant="outlined"
              disabled={saving || busy}
              onClick={() => void saveAbertura({ enderecoBairro: draftBairro || null })}
            >
              Salvar
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-2)]">{resumo.unidade?.bairro ?? resumo.enderecoBairro ?? '—'}</p>
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
          label="Endereço"
          editable={canEdit}
          onEdit={() => setEditingField(editingField === 'endereco' ? null : 'endereco')}
        />
        {editingField === 'endereco' ? (
          <div className="flex gap-2">
            <Input value={draftEndereco} onChange={(e) => setDraftEndereco(e.target.value)} disabled={saving || busy} />
            <Button
              size="sm"
              variant="outlined"
              disabled={saving || busy}
              onClick={() => void saveAbertura({ enderecoTexto: draftEndereco || null })}
            >
              Salvar
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-2)]">
            {resumo.unidade?.endereco ?? resumo.enderecoTexto ?? '—'}
            {resumo.enderecoBairro ? ` · ${resumo.enderecoBairro}` : ''}
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
          <button
            type="button"
            className="mt-1 text-[12px] font-semibold text-[var(--brand)] hover:underline"
            onClick={() => {
              setMapEditable(false);
              setMapOpen(true);
            }}
          >
            Ver no mapa
          </button>
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
        title={mapEditable ? 'Reposicionar coordenadas' : 'Localização do chamado'}
        latitude={coords?.latitude ?? null}
        longitude={coords?.longitude ?? null}
        editable={mapEditable && canEdit}
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
