import { dataIsoValida, definirParam, idUrl, mesAtualIso, mesIsoValido } from '@/lib/estado-url';

export type EstadoCronograma = {
  mes: string | null;
  secretaria: string;
  unidade: string;
  dia: string | null;
};

export function lerEstadoCronograma(sp: URLSearchParams, agora = new Date()): { estado: EstadoCronograma; canonico: URLSearchParams } {
  const estado: EstadoCronograma = {
    mes: mesIsoValido(sp.get('mes')),
    secretaria: idUrl(sp.get('secretaria')) ?? '',
    unidade: idUrl(sp.get('unidade')) ?? '',
    dia: dataIsoValida(sp.get('dia')),
  };
  if (estado.mes === mesAtualIso(agora)) estado.mes = null;
  return { estado, canonico: serializarEstadoCronograma(estado, agora) };
}

export function serializarEstadoCronograma(estado: EstadoCronograma, agora = new Date()) {
  const params = new URLSearchParams();
  if (estado.mes && estado.mes !== mesAtualIso(agora)) params.set('mes', estado.mes);
  definirParam(params, 'secretaria', estado.secretaria);
  definirParam(params, 'unidade', estado.unidade);
  if (estado.dia) params.set('dia', estado.dia);
  return params;
}

export function dataDoMes(mes: string) {
  const [ano, mesNum] = mes.split('-').map(Number);
  return new Date(ano, mesNum - 1, 1);
}
