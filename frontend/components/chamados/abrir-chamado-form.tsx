'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Camera,
  Crosshair,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { ChamadoLocationMapPicker } from '@/components/chamados/chamado-location-map-picker';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { createChamado, getSecretarias, getUnidades } from '@/lib/api';
import { captureCurrentPosition } from '@/lib/geolocation';
import { searchAddresses } from '@/lib/geocoding';
import { UnidadeOperacional } from '@/lib/types';

const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
type ModoLocalizacao = 'UNIDADE' | 'GEOLOCALIZACAO' | 'ENDERECO';

const textareaClass =
  'min-h-[96px] w-full resize-y rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-[11px] py-2 text-[13px] text-[var(--ink)] transition-all duration-[var(--md-duration-short)] placeholder:text-[var(--ink-4)] hover:border-[#cdd8e6] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50';

export function AbrirChamadoForm({
  initialUnidadeId,
  initialUnidadeNome,
  onSuccess,
  compact = false,
}: {
  initialUnidadeId?: string;
  initialUnidadeNome?: string;
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [modo, setModo] = useState<ModoLocalizacao>(initialUnidadeId ? 'UNIDADE' : 'GEOLOCALIZACAO');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<(typeof PRIORIDADES)[number]>('MEDIA');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [secretariaId, setSecretariaId] = useState('');
  const [pickedUnidade, setPickedUnidade] = useState<{ id: string; nome: string } | null>(
    initialUnidadeId && initialUnidadeNome ? { id: initialUnidadeId, nome: initialUnidadeNome } : null,
  );
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [enderecoTexto, setEnderecoTexto] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<Array<{ label: string; latitude: number; longitude: number; bairro?: string | null }>>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoGeo, setFotoGeo] = useState<{ latitude: number; longitude: number } | null>(null);

  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSecretarias()
      .then((items) => setSecretarias(items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (modo !== 'UNIDADE' || pickedUnidade) return;

    let active = true;
    setLoadingUnidades(true);
    getUnidades({})
      .then((items) => {
        if (active) setUnidades(items);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a lista de próprios.');
      })
      .finally(() => {
        if (active) setLoadingUnidades(false);
      });

    return () => {
      active = false;
    };
  }, [modo, pickedUnidade]);

  useEffect(() => {
    if (modo !== 'ENDERECO') return;
    const query = addressQuery.trim();
    if (query.length < 4) {
      setAddressResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setAddressSearching(true);
      searchAddresses(query)
        .then((items) => setAddressResults(items))
        .catch(() => setAddressResults([]))
        .finally(() => setAddressSearching(false));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [addressQuery, modo]);

  const filteredUnidades = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return unidades.slice(0, 80);
    return unidades
      .filter((item) =>
        [item.nome, item.codigoPatrimonial, item.endereco, item.bairro, item.secretaria.sigla]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 80);
  }, [pickerSearch, unidades]);

  async function handleCaptureGeo() {
    setGeoLoading(true);
    setError(null);
    try {
      const position = await captureCurrentPosition();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
      if (modo === 'GEOLOCALIZACAO' && !fotoGeo) {
        setFotoGeo({ latitude: position.latitude, longitude: position.longitude });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível obter a localização.');
    } finally {
      setGeoLoading(false);
    }
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem (JPEG, PNG ou WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A foto deve ter no máximo 8 MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setFotoDataUrl(dataUrl);
      setFotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);

    try {
      const position = await captureCurrentPosition(
        latitude != null && longitude != null
          ? { latitude, longitude, precisaoMetros: 50, source: 'fallback' }
          : undefined,
      );
      setFotoGeo({ latitude: position.latitude, longitude: position.longitude });
      if (modo !== 'UNIDADE' && latitude == null) {
        setLatitude(position.latitude);
        setLongitude(position.longitude);
      }
    } catch {
      // Foto sem GPS — operador pode definir no mapa depois.
    }
  }

  function selectAddress(item: { label: string; latitude: number; longitude: number; bairro?: string | null }) {
    setEnderecoTexto(item.label);
    setEnderecoBairro(item.bairro ?? '');
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setAddressQuery(item.label);
    setAddressResults([]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (modo === 'UNIDADE' && !pickedUnidade) {
      setError('Selecione o próprio público.');
      return;
    }

    if (modo !== 'UNIDADE') {
      if (latitude == null || longitude == null) {
        setError('Confirme a localização no mapa ou capture o GPS.');
        return;
      }
      if (modo === 'ENDERECO' && !enderecoTexto.trim()) {
        setError('Informe o endereço do chamado.');
        return;
      }
      if (!secretariaId) {
        setError('Selecione a secretaria responsável.');
        return;
      }
    }

    setBusy(true);
    try {
      const chamado = await createChamado({
        modoLocalizacao: modo,
        unidadeId: pickedUnidade?.id,
        secretariaId: modo !== 'UNIDADE' ? secretariaId : undefined,
        latitude: modo !== 'UNIDADE' ? latitude ?? undefined : undefined,
        longitude: modo !== 'UNIDADE' ? longitude ?? undefined : undefined,
        enderecoTexto: modo === 'ENDERECO' ? enderecoTexto.trim() : undefined,
        enderecoBairro: modo === 'ENDERECO' ? enderecoBairro.trim() || undefined : undefined,
        descricao: descricao.trim(),
        prioridade,
        origem: 'MANUAL',
        solicitanteNome: solicitanteNome.trim() || undefined,
        fotoDataUrl: fotoDataUrl ?? undefined,
      });
      snackbar.show(`Chamado ${chamado.codigo} aberto com sucesso.`, 'success');
      onSuccess?.();
      router.push(`/chamados?search=${encodeURIComponent(chamado.codigo)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar o chamado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={compact ? 'space-y-4' : 'mx-auto max-w-2xl space-y-5'} onSubmit={(event) => void handleSubmit(event)}>
      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Como localizar o chamado?</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={modo === 'UNIDADE'} onClick={() => setModo('UNIDADE')}>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Por próprio
            </span>
          </Chip>
          <Chip active={modo === 'GEOLOCALIZACAO'} onClick={() => setModo('GEOLOCALIZACAO')}>
            <span className="inline-flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5" />
              Por geolocalização
            </span>
          </Chip>
          <Chip active={modo === 'ENDERECO'} onClick={() => setModo('ENDERECO')}>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Por endereço
            </span>
          </Chip>
        </div>
      </div>

      {modo === 'UNIDADE' ? (
        pickedUnidade ? (
          <p className="text-[13px] text-[var(--ink-3)]">
            Próprio: <strong className="text-[var(--ink)]">{pickedUnidade.nome}</strong>{' '}
            <button
              type="button"
              className="font-semibold text-[var(--brand)] hover:underline"
              onClick={() => setPickedUnidade(null)}
            >
              Trocar
            </button>
          </p>
        ) : (
          <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] p-3">
            <Field label="Buscar próprio">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                <Input
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder="Nome, código ou endereço"
                  className="pl-9"
                  disabled={busy || loadingUnidades}
                />
              </div>
            </Field>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {loadingUnidades ? (
                <p className="py-4 text-center text-[13px] text-[var(--ink-3)]">Carregando próprios...</p>
              ) : filteredUnidades.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-[var(--ink-3)]">Nenhum próprio encontrado.</p>
              ) : (
                filteredUnidades.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPickedUnidade({ id: item.id, nome: item.nome })}
                    className="flex w-full flex-col rounded-[var(--r-sm)] px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  >
                    <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{item.codigoPatrimonial}</span>
                    <span className="text-[13px] font-semibold text-[var(--ink)]">{item.nome}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      ) : null}

      {modo === 'GEOLOCALIZACAO' ? (
        <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] p-3">
          <p className="text-[13px] text-[var(--ink-3)]">
            Autorize a localização do dispositivo para registrar o ponto exato — ideal para tapa-buraco e ocorrências em via pública.
          </p>
          <Button type="button" variant="outlined" size="sm" disabled={busy || geoLoading} onClick={() => void handleCaptureGeo()}>
            {geoLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Obtendo GPS...
              </>
            ) : (
              <>
                <Crosshair className="h-4 w-4" />
                Usar minha localização
              </>
            )}
          </Button>
          {latitude != null && longitude != null ? (
            <p className="mono text-[12px] text-[var(--ink-3)]">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          ) : null}
          <ChamadoLocationMapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={({ latitude: lat, longitude: lng }) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
      ) : null}

      {modo === 'ENDERECO' ? (
        <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] p-3">
          <Field label="Endereço" hint="Busque no mapa ou digite rua e número em Franca.">
            <Input
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              placeholder="Ex.: Av. Rio Amazonas, 1000"
              disabled={busy}
            />
          </Field>
          {addressSearching ? (
            <p className="text-[12px] text-[var(--ink-3)]">Buscando endereços...</p>
          ) : null}
          {addressResults.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-[var(--r-sm)] border border-[var(--line-2)] p-1">
              {addressResults.map((item) => (
                <button
                  key={`${item.latitude}-${item.longitude}`}
                  type="button"
                  onClick={() => selectAddress(item)}
                  className="block w-full rounded-[var(--r-sm)] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <Field label="Endereço confirmado">
            <Input
              value={enderecoTexto}
              onChange={(event) => setEnderecoTexto(event.target.value)}
              placeholder="Confirme ou ajuste o endereço"
              disabled={busy}
            />
          </Field>
          <ChamadoLocationMapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={({ latitude: lat, longitude: lng }) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
      ) : null}

      {modo !== 'UNIDADE' ? (
        <Field label="Secretaria responsável">
          <Select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)} disabled={busy}>
            <option value="">Selecione...</option>
            {secretarias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sigla} — {item.nome}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {(modo === 'UNIDADE' ? pickedUnidade : true) ? (
        <>
          <Field label="Descrição" hint="Mínimo 10 caracteres.">
            <textarea
              className={textareaClass}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Descreva a ocorrência..."
              minLength={10}
              required
              disabled={busy || (modo === 'UNIDADE' && !pickedUnidade)}
            />
          </Field>

          <Field label="Foto georeferenciada (opcional)" hint="Ao capturar, tentamos registrar o GPS do dispositivo.">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--line)] px-4 py-3 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]">
                <Camera className="h-4 w-4" />
                Tirar / escolher foto
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handlePhotoSelect(event)} disabled={busy} />
              </label>
              {fotoPreview ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-[var(--r-md)] border border-[var(--line)]">
                  <Image src={fotoPreview} alt="Prévia da foto" fill className="object-cover" unoptimized />
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white"
                    onClick={() => {
                      setFotoPreview(null);
                      setFotoDataUrl(null);
                      setFotoGeo(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
            {fotoGeo ? (
              <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                GPS da foto: {fotoGeo.latitude.toFixed(5)}, {fotoGeo.longitude.toFixed(5)}
              </p>
            ) : null}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prioridade">
              <Select value={prioridade} onChange={(event) => setPrioridade(event.target.value as (typeof PRIORIDADES)[number])} disabled={busy}>
                {PRIORIDADES.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0) + item.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Solicitante (opcional)">
              <Input value={solicitanteNome} onChange={(event) => setSolicitanteNome(event.target.value)} disabled={busy} />
            </Field>
          </div>
        </>
      ) : null}

      {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="submit"
          variant="filled"
          disabled={
            busy ||
            (modo === 'UNIDADE' && !pickedUnidade) ||
            descricao.trim().length < 10
          }
        >
          {busy ? 'Registrando...' : 'Abrir chamado'}
        </Button>
      </div>
    </form>
  );
}
