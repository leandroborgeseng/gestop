'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Camera,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ChamadoLocationMapPicker } from '@/components/chamados/chamado-location-map-picker';
import { TipoChamadoSelect } from '@/components/chamados/tipo-chamado-select';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { createChamado, getSecretarias, getUnidades, listTiposChamadoOpcoes } from '@/lib/api';
import { captureCurrentPosition } from '@/lib/geolocation';
import {
  composeEnderecoTexto,
  geocodeStructuredAddress,
  reverseGeocodeAddress,
  searchAddresses,
} from '@/lib/geocoding';
import { isWithinFrancaMunicipio } from '@/lib/franca-geo';
import { TipoChamadoOpcao, UnidadeOperacional } from '@/lib/types';

const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
type ModoLocalizacao = 'UNIDADE' | 'ENDERECO';

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

  const [modo, setModo] = useState<ModoLocalizacao>(initialUnidadeId ? 'UNIDADE' : 'ENDERECO');
  const [descricao, setDescricao] = useState('');
  const [tipoChamadoId, setTipoChamadoId] = useState('');
  const [tiposChamado, setTiposChamado] = useState<TipoChamadoOpcao[]>([]);
  const [prioridade, setPrioridade] = useState<(typeof PRIORIDADES)[number]>('MEDIA');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [secretariaId, setSecretariaId] = useState('');
  const [pickedUnidade, setPickedUnidade] = useState<{
    id: string;
    nome: string;
    secretaria?: { id: string; nome: string; sigla: string } | null;
  } | null>(
    initialUnidadeId && initialUnidadeNome ? { id: initialUnidadeId, nome: initialUnidadeNome } : null,
  );
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Franca');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<
    Array<{
      label: string;
      latitude: number;
      longitude: number;
      bairro?: string | null;
      logradouro?: string | null;
      numero?: string | null;
      cidade?: string | null;
    }>
  >([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [pinUpdating, setPinUpdating] = useState(false);
  const [reverseGeocodingPin, setReverseGeocodingPin] = useState(false);
  /** Número que estava ativo quando o pin foi sincronizado (busca/geocode/manual). */
  const [pinSyncedNumero, setPinSyncedNumero] = useState<string | null>(null);
  const reverseGeocodePinTimerRef = useRef<number | null>(null);
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoGeo, setFotoGeo] = useState<{ latitude: number; longitude: number } | null>(null);

  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinHint, setPinHint] = useState<string | null>(null);

  const enderecoComposto = useMemo(
    () => composeEnderecoTexto({ logradouro, numero, complemento, cidade }),
    [logradouro, numero, complemento, cidade],
  );

  useEffect(() => {
    getSecretarias()
      .then((items) => setSecretarias(items))
      .catch(() => undefined);
    listTiposChamadoOpcoes()
      .then((items) => setTiposChamado(items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!initialUnidadeId || pickedUnidade?.secretaria) return;
    let active = true;
    getUnidades({})
      .then((items) => {
        if (!active) return;
        const match = items.find((item) => item.id === initialUnidadeId);
        if (!match) return;
        setPickedUnidade({
          id: match.id,
          nome: match.nome,
          secretaria: match.secretaria,
        });
        setSecretariaId((current) => current || match.secretaria.id);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialUnidadeId, pickedUnidade?.secretaria]);

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
    if (query.length < 3) {
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

  const pinNeedsRefresh =
    modo === 'ENDERECO' &&
    latitude != null &&
    longitude != null &&
    numero.trim() !== '' &&
    pinSyncedNumero !== null &&
    pinSyncedNumero !== numero.trim();

  function extractNumeroFromLabel(label: string) {
    const parts = label.split(',').map((part) => part.trim());
    if (parts.length >= 2 && /^\d{1,6}[A-Za-z]?$/.test(parts[1])) {
      return parts[1];
    }
    return '';
  }

  function applyAddressFields(item: {
    label: string;
    latitude: number;
    longitude: number;
    bairro?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    cidade?: string | null;
  }) {
    const nextNumero = (item.numero ?? '').trim() || extractNumeroFromLabel(item.label);
    setLogradouro(item.logradouro ?? item.label.split(',')[0]?.trim() ?? '');
    setNumero(nextNumero);
    setBairro(item.bairro ?? '');
    setCidade(item.cidade ?? 'Franca');
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setPinSyncedNumero(nextNumero);
    setAddressQuery(item.label);
    setAddressResults([]);
    setError(null);
    setPinHint(
      nextNumero
        ? null
        : 'Sugestão sem número. Informe o número e use “Atualizar pin no mapa” para refinar a localização.',
    );
  }

  async function handleCaptureGeo() {
    setGeoLoading(true);
    setError(null);
    setPinHint(null);
    try {
      const position = await captureCurrentPosition();
      setLatitude(position.latitude);
      setLongitude(position.longitude);

      const parsed = await reverseGeocodeAddress(position.latitude, position.longitude);
      if (parsed) {
        setLogradouro((current) => current.trim() || parsed.logradouro);
        setNumero((current) => current.trim() || parsed.numero);
        setComplemento((current) => current.trim() || parsed.complemento);
        setBairro((current) => current.trim() || parsed.bairro);
        setCidade((current) => current.trim() || parsed.cidade || 'Franca');
        setAddressQuery((current) =>
          current.trim()
            ? current
            : composeEnderecoTexto({
                logradouro: parsed.logradouro,
                numero: parsed.numero,
                complemento: parsed.complemento,
                cidade: parsed.cidade || 'Franca',
              }),
        );
      }
      setPinSyncedNumero(numero.trim() || parsed?.numero?.trim() || '');

      if (!fotoGeo) {
        setFotoGeo({ latitude: position.latitude, longitude: position.longitude });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível obter a localização.');
    } finally {
      setGeoLoading(false);
    }
  }

  async function applyAddressFromCoords(lat: number, lng: number) {
    setReverseGeocodingPin(true);
    try {
      const parsed = await reverseGeocodeAddress(lat, lng);
      if (!parsed) return;
      // Não sobrescreve o que o usuário já digitou — o pin manda nas coordenadas.
      setLogradouro((current) => current.trim() || parsed.logradouro);
      setNumero((current) => current.trim() || parsed.numero);
      setBairro((current) => current.trim() || parsed.bairro);
      setCidade((current) => current.trim() || parsed.cidade || 'Franca');
      setAddressQuery((current) =>
        current.trim()
          ? current
          : composeEnderecoTexto({
              logradouro: parsed.logradouro,
              numero: parsed.numero,
              complemento: '',
              cidade: parsed.cidade || 'Franca',
            }),
      );
    } catch {
      // Mantém coordenadas mesmo se o reverse geocode falhar.
    } finally {
      setReverseGeocodingPin(false);
    }
  }

  function handlePinChange(coords: { latitude: number; longitude: number }) {
    setLatitude(coords.latitude);
    setLongitude(coords.longitude);
    setPinSyncedNumero(numero.trim());
    setError(null);
    setPinHint(null);

    if (reverseGeocodePinTimerRef.current) {
      window.clearTimeout(reverseGeocodePinTimerRef.current);
    }
    reverseGeocodePinTimerRef.current = window.setTimeout(() => {
      void applyAddressFromCoords(coords.latitude, coords.longitude);
    }, 450);
  }

  async function handleUpdatePinFromAddress() {
    if (!logradouro.trim()) {
      setError('Informe o logradouro antes de atualizar o pin.');
      return;
    }

    setPinUpdating(true);
    setError(null);
    setPinHint(null);
    try {
      const result = await geocodeStructuredAddress({ logradouro, numero, bairro, cidade });
      if (!result) {
        setError(
          'Endereço não localizado automaticamente. Posicione o pin manualmente no mapa dentro do município de Franca e salve.',
        );
        snackbar.show('Não encontramos o endereço. Mova o pin no mapa.', 'warning');
        return;
      }
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setPinSyncedNumero(numero.trim());

      if (result.precision === 'exact') {
        setPinHint(null);
        snackbar.show('Pin atualizado no número informado.', 'success');
      } else if (result.precision === 'approximate') {
        setPinHint(
          'Localização aproximada para o número informado. Confira o pin no mapa e ajuste manualmente se necessário.',
        );
        snackbar.show('Pin aproximado — confira no mapa.', 'warning');
      } else {
        setPinHint(
          numero.trim()
            ? 'Não localizamos o número exato. O pin ficou no logradouro — ajuste manualmente se preciso.'
            : 'Pin posicionado no logradouro. Informe o número e atualize novamente para mais precisão.',
        );
        snackbar.show('Pin no logradouro — confira no mapa.', 'warning');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível localizar o endereço. Posicione o pin manualmente no mapa.',
      );
    } finally {
      setPinUpdating(false);
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
      if (modo === 'ENDERECO' && latitude == null) {
        setLatitude(position.latitude);
        setLongitude(position.longitude);
        const parsed = await reverseGeocodeAddress(position.latitude, position.longitude);
        if (parsed && !logradouro.trim()) {
          setLogradouro(parsed.logradouro);
          setNumero(parsed.numero);
          setBairro(parsed.bairro);
          setCidade(parsed.cidade || 'Franca');
        }
      }
    } catch {
      // Foto sem GPS — operador pode definir no mapa depois.
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPinHint(null);

    if (modo === 'UNIDADE' && !pickedUnidade) {
      setError('Selecione o próprio público.');
      return;
    }

    if (!secretariaId) {
      setError('Selecione a secretaria responsável pela execução.');
      return;
    }

    if (!tipoChamadoId) {
      setError('Selecione o tipo de chamado.');
      return;
    }

    if (modo === 'ENDERECO') {
      if (!logradouro.trim()) {
        setError('Informe o logradouro.');
        return;
      }
      if (!bairro.trim()) {
        setError('Informe o bairro.');
        return;
      }
      if (!cidade.trim()) {
        setError('Informe a cidade.');
        return;
      }
      if (latitude == null || longitude == null) {
        setError(
          'Defina a localização no mapa: use a busca, “Atualizar pin no mapa” ou posicione o pin manualmente.',
        );
        return;
      }
      if (!isWithinFrancaMunicipio(latitude, longitude)) {
        setError('O pin precisa estar dentro do município de Franca.');
        return;
      }
    }

    setBusy(true);
    try {
      const chamado = await createChamado({
        modoLocalizacao: modo,
        unidadeId: pickedUnidade?.id,
        secretariaId,
        latitude: modo === 'ENDERECO' ? latitude ?? undefined : undefined,
        longitude: modo === 'ENDERECO' ? longitude ?? undefined : undefined,
        enderecoTexto: modo === 'ENDERECO' ? enderecoComposto : undefined,
        enderecoBairro: modo === 'ENDERECO' ? bairro.trim() || undefined : undefined,
        tipoChamadoId,
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
          <Chip
            active={modo === 'ENDERECO'}
            onClick={() => {
              setModo('ENDERECO');
              setPickedUnidade(null);
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Por endereço
            </span>
          </Chip>
        </div>
      </div>

      {modo === 'UNIDADE' ? (
        pickedUnidade ? (
          <div className="space-y-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <p className="text-[13px] text-[var(--ink-3)]">
              Próprio: <strong className="text-[var(--ink)]">{pickedUnidade.nome}</strong>{' '}
              <button
                type="button"
                className="font-semibold text-[var(--brand)] hover:underline"
                onClick={() => {
                  setPickedUnidade(null);
                  setSecretariaId('');
                }}
              >
                Trocar
              </button>
            </p>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
                Secretaria responsável pelo próprio
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--ink-2)]">
                {pickedUnidade.secretaria
                  ? `${pickedUnidade.secretaria.sigla} — ${pickedUnidade.secretaria.nome}`
                  : '—'}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                Informação cadastral do próprio (somente consulta).
              </p>
            </div>
          </div>
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
                    onClick={() => {
                      setPickedUnidade({
                        id: item.id,
                        nome: item.nome,
                        secretaria: item.secretaria,
                      });
                      setSecretariaId(item.secretaria.id);
                    }}
                    className="flex w-full flex-col rounded-[var(--r-sm)] px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  >
                    <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{item.codigoPatrimonial}</span>
                    <span className="text-[13px] font-semibold text-[var(--ink)]">{item.nome}</span>
                    <span className="text-[11px] text-[var(--ink-3)]">
                      {item.secretaria.sigla} — {item.secretaria.nome}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      ) : null}

      {modo === 'ENDERECO' ? (
        <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] p-3">
          <div className="flex flex-wrap gap-2">
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
            <Button
              type="button"
              variant={pinNeedsRefresh ? 'filled' : 'outlined'}
              size="sm"
              disabled={busy || pinUpdating || !logradouro.trim()}
              onClick={() => void handleUpdatePinFromAddress()}
            >
              {pinUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Localizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {pinNeedsRefresh ? 'Atualizar pin (número mudou)' : 'Atualizar pin no mapa'}
                </>
              )}
            </Button>
          </div>
          {pinNeedsRefresh ? (
            <p className="text-[12px] text-[var(--warn)]">
              O número foi alterado depois da última localização. Clique em “Atualizar pin no mapa” para recalcular.
            </p>
          ) : null}
          {pinHint ? <p className="text-[12px] text-[var(--warn)]">{pinHint}</p> : null}

          <Field
            label="Buscar endereço"
            hint="Facilita a localização. Se não achar, preencha os campos e posicione o pin no mapa."
          >
            <Input
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              placeholder="Ex.: Rua Frederico Moura"
              disabled={busy}
            />
          </Field>
          {addressSearching ? <p className="text-[12px] text-[var(--ink-3)]">Buscando endereços...</p> : null}
          {addressResults.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-[var(--r-sm)] border border-[var(--line-2)] p-1">
              {addressResults.map((item) => (
                <button
                  key={`${item.latitude}-${item.longitude}-${item.label}`}
                  type="button"
                  onClick={() => applyAddressFields(item)}
                  className="block w-full rounded-[var(--r-sm)] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Logradouro">
              <Input
                value={logradouro}
                onChange={(event) => setLogradouro(event.target.value)}
                placeholder="Rua, avenida..."
                disabled={busy}
                required
              />
            </Field>
            <Field label="Número" hint="Obrigatório para posicionar o pin no imóvel. Opcional só se usar complementar/pin manual.">
              <Input
                value={numero}
                onChange={(event) => setNumero(event.target.value)}
                placeholder="Ex.: 1000 ou S/N"
                disabled={busy}
              />
            </Field>
            <Field label="Complemento" hint="Referência, ponto conhecido, sem numeração etc.">
              <Input
                value={complemento}
                onChange={(event) => setComplemento(event.target.value)}
                placeholder="Apto, bloco, referência..."
                disabled={busy}
              />
            </Field>
            <Field label="Bairro">
              <Input
                value={bairro}
                onChange={(event) => setBairro(event.target.value)}
                placeholder="Bairro"
                disabled={busy}
                required
              />
            </Field>
            <Field label="Cidade" className="sm:col-span-2">
              <Input
                value={cidade}
                onChange={(event) => setCidade(event.target.value)}
                placeholder="Franca"
                disabled={busy}
                required
              />
            </Field>
          </div>

          {enderecoComposto ? (
            <p className="text-[12px] text-[var(--ink-3)]">
              Endereço registrado: <strong className="text-[var(--ink)]">{enderecoComposto}</strong>
              {bairro.trim() ? ` · ${bairro.trim()}` : ''}
            </p>
          ) : null}

          {latitude != null && longitude != null ? (
            <p className="mono text-[12px] text-[var(--ink-3)]">
              Pin: {latitude.toFixed(6)}, {longitude.toFixed(6)}
              {reverseGeocodingPin ? ' · Completando campos vazios pelo pin...' : ''}
            </p>
          ) : (
            <p className="text-[12px] text-[var(--warn)]">
              Defina o pin no mapa (arraste/clique), use a busca ou “Atualizar pin no mapa”.
            </p>
          )}

          <ChamadoLocationMapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={handlePinChange}
          />
          <p className="text-[11px] text-[var(--ink-3)]">
            O pin tem prioridade na localização. Campos que você já preencheu não são sobrescritos ao mover o pin.
            É possível abrir o chamado em qualquer ponto válido do município de Franca.
          </p>
        </div>
      ) : null}

      {(modo === 'ENDERECO' || (modo === 'UNIDADE' && pickedUnidade)) ? (
        <Field
          label="Secretaria responsável pela execução"
          hint="Secretaria que irá tratar e executar o chamado (obrigatório)."
        >
          <Select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)} disabled={busy} required>
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
          <Field label="Tipo de chamado" hint="Obrigatório. Será usado como título principal do chamado.">
            <TipoChamadoSelect
              value={tipoChamadoId}
              onChange={setTipoChamadoId}
              tipos={tiposChamado}
              disabled={busy}
              required
            />
          </Field>
          <Field label="Descrição" hint="Mínimo 10 caracteres. Detalha a ocorrência (não é o título).">
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
            !tipoChamadoId ||
            !secretariaId ||
            descricao.trim().length < 10
          }
        >
          {busy ? 'Registrando...' : 'Abrir chamado'}
        </Button>
      </div>
    </form>
  );
}
