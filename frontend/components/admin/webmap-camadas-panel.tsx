'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  aplicarWebmapCamadas,
  downloadWebmapCamadasErrosCsv,
  getWebmapCamadasHistorico,
  getWebmapCamadasStatus,
  simularWebmapCamadas,
} from '@/lib/api';
import type { WebmapCamadasHistoricoItem, WebmapCamadasResumo, WebmapCamadasSimulacao, WebmapCamadasStatus } from '@/lib/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** 296: até 50 erros na tela; o CSV traz todos. */
export const MAX_ERROS_TELA = 50;
const POLL_MS = 2000;

const FASE_LABEL: Record<string, string> = {
  lendo_fonte: 'Lendo a fonte do Webmap…',
  comparando: 'Comparando com as camadas já importadas…',
  gravando: 'Gravando as camadas…',
  ativando: 'Ativando a nova versão…',
  limpando: 'Removendo a versão anterior…',
};

const RESULTADO_LABEL: Record<string, string> = { SUCESSO: 'Sucesso', OK_COM_AVISOS: 'OK com avisos', PARCIAL: 'Parcial', FALHA: 'Falha', EM_ANDAMENTO: 'Em andamento' };

const STATUS_LABEL: Record<string, string> = {
  nova: 'Nova',
  atualizada: 'Atualizada',
  sem_mudanca: 'Sem mudança',
  reativada: 'Reativada',
  removida_origem: 'Removida da origem',
};

/** Pacote (a): texto do diálogo; só existe quando N > 0. */
export function textoConfirmacaoAplicar(invalidos: number): string | null {
  if (!invalidos || invalidos <= 0) return null;
  const n = invalidos.toLocaleString('pt-BR');
  return `Aplicar importação? ${n} elementos serão gravados como inválidos e não aparecerão no mapa (detalhes no CSV).`;
}

/** Pacote (d): "Parcial · 20/10/2026 15:40 (BRT) · Tester Importação" (resultado · dd/mm/aaaa HH:mm (BRT) · usuário). */
export function linhaUltimaAplicacao(status: string, dataHoraBrt: string, usuario: string): string {
  // aceita o formato do backend com ou sem a vírgula do Intl e sem segundos
  const quando = dataHoraBrt.replace(/(\d{4}),\s*/, '$1 ').replace(/(\d{2}:\d{2}):\d{2}/, '$1');
  return `${RESULTADO_LABEL[status] ?? status} · ${quando} · ${usuario}`;
}

function horaBrt(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function Resumo({ titulo, resumo, csv }: { titulo: string; resumo: WebmapCamadasResumo; csv: () => void }) {
  return (
    <section aria-label={titulo} className="space-y-3">
      <h3 className="md-title-md">{titulo}</h3>
      <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Grupos', resumo.grupos],
          ['Camadas', resumo.camadas],
          ['Pontos', resumo.elementos.pontos],
          ['Linhas', resumo.elementos.linhas],
          ['Polígonos', resumo.elementos.poligonos],
          ['Corrigidos', resumo.corrigidos],
          ['Irreparáveis', resumo.invalidos],
          ['Novas', resumo.novas],
          ['Atualizadas', resumo.atualizadas],
          ['Sem mudança', resumo.semMudanca],
          ['Reativadas', resumo.reativadas],
          ['Removidas da origem', resumo.removidasOrigem],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
            <dt className="md-label-md text-[var(--md-on-surface-variant)]">{k}</dt>
            <dd className="md-title-md mt-1">{v}</dd>
          </div>
        ))}
      </dl>
      {resumo.reordenadas ? (
        <p className="md-body-sm text-[var(--md-on-surface-variant)]" data-testid="webmap-reordenadas">
          Reordenadas: {resumo.reordenadas} (informativo; só mudou a posição, contam como Sem mudança e a ordem nova é gravada)
        </p>
      ) : null}
      {resumo.camadasDetalhe?.some((c) => c.status !== 'sem_mudanca') ? (
        <ul className="md-body-md list-disc pl-5">
          {resumo.camadasDetalhe
            .filter((c) => c.status !== 'sem_mudanca')
            .map((c) => (
              <li key={c.chaveOrigem}>
                {STATUS_LABEL[c.status]}: {c.grupo} › {c.nomeOriginal}
              </li>
            ))}
        </ul>
      ) : null}
      {resumo.totalErros ? (
        <div className="space-y-2">
          <h4 className="md-title-sm">
            Elementos irreparáveis ({Math.min(resumo.totalErros, MAX_ERROS_TELA)} de {resumo.totalErros})
          </h4>
          <ul className="md-body-md list-disc pl-5">
            {resumo.erros.slice(0, MAX_ERROS_TELA).map((e, i) => (
              <li key={i}>
                {e.grupo ? `${e.grupo} › ` : ''}
                {e.camada}
                {e.elemento ? ` (elemento ${e.elemento})` : ''}: {e.motivo}
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="min-h-11" onClick={csv}>
            Baixar CSV com todos os erros
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function WebmapCamadasPanel({ canExec }: { canExec: boolean }) {
  const [status, setStatus] = useState<WebmapCamadasStatus | null>(null);
  const [historico, setHistorico] = useState<WebmapCamadasHistoricoItem[]>([]);
  const [simulacao, setSimulacao] = useState<WebmapCamadasSimulacao | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([getWebmapCamadasStatus(), getWebmapCamadasHistorico(10)]);
      setStatus(s);
      setHistorico(h);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o status das camadas.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // A aplicação roda no servidor: acompanha fase e resultado (também ao sair e voltar à tela). Sem % falso.
  const emAndamento = status?.emAndamento ?? null;
  useEffect(() => {
    if (!emAndamento && !simulando) return;
    const t = window.setInterval(() => void carregar(), POLL_MS);
    return () => window.clearInterval(t);
  }, [emAndamento, simulando, carregar]);

  async function simular() {
    setErro(null);
    setSimulando(true);
    try {
      setSimulacao(await simularWebmapCamadas());
    } catch (e) {
      setSimulacao(null);
      setErro(e instanceof Error ? e.message : 'Falha na simulação.');
    } finally {
      setSimulando(false);
      void carregar();
    }
  }

  const [confirmando, setConfirmando] = useState(false);
  const confirmarRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (confirmando) confirmarRef.current?.focus();
  }, [confirmando]);

  function pedirAplicar() {
    if (!simulacao) return;
    if (textoConfirmacaoAplicar(simulacao.invalidos)) setConfirmando(true);
    else void aplicar();
  }

  async function aplicar() {
    setConfirmando(false);
    if (!simulacao) return;
    setErro(null);
    try {
      await aplicarWebmapCamadas(simulacao.simulacaoId);
      setSimulacao(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar a aplicação.');
    } finally {
      void carregar();
    }
  }

  const expirada = simulacao ? Date.now() > new Date(simulacao.expiraEm).getTime() : false;
  const ocupado = Boolean(simulando || emAndamento);
  const ultima = status?.ultimaImportacao ?? null;

  return (
    <Card elevation={2} data-testid="webmap-camadas-panel">
      <CardHeader>
        <CardTitle className="md-title-lg">Camadas do Webmap</CardTitle>
        <CardDescription>
          Importa só as camadas geográficas (grupos, camadas, estilos e elementos) para os mapas do SIGMA. Não altera próprios públicos,
          Secretarias, chamados, coordenadas nem endereços.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {erro ? <Alert variant="error">{erro}</Alert> : null}

        {emAndamento ? (
          <Alert variant="warning" role="status" title="Importação de camadas em andamento">
            {emAndamento.usuario} desde {emAndamento.desdeBrt}. {FASE_LABEL[emAndamento.fase] ?? ''}
          </Alert>
        ) : null}

        {status ? (
          <p className="md-body-md text-[var(--md-on-surface-variant)]">
            {status.ativas} camada(s) ativa(s) · {status.removidasOrigem} removida(s) da origem
          </p>
        ) : null}

        {canExec ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="filled" className="min-h-11" disabled={ocupado} onClick={() => void simular()}>
              <Layers className="h-4 w-4" aria-hidden />
              {simulando ? 'Simulando…' : 'Importar apenas camadas Webmap'}
            </Button>
            {simulacao ? (
              <Button variant="tonal" className="min-h-11" disabled={ocupado || expirada} onClick={pedirAplicar}>
                Aplicar
              </Button>
            ) : null}
          </div>
        ) : null}

        {confirmando && simulacao ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="webmap-confirmar-titulo"
            aria-describedby="webmap-confirmar-texto"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setConfirmando(false);
            }}
          >
            <div className="w-full max-w-md space-y-4 rounded-[var(--md-shape-lg,16px)] bg-[var(--md-surface,#fff)] p-5 shadow-[var(--sh-md)]">
              <h3 id="webmap-confirmar-titulo" className="md-title-md">Confirmar aplicação</h3>
              <p id="webmap-confirmar-texto" className="md-body-md">{textoConfirmacaoAplicar(simulacao.invalidos)}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmando(false)}>Cancelar</Button>
                <Button ref={confirmarRef} variant="filled" className="min-h-11" onClick={() => void aplicar()}>Aplicar</Button>
              </div>
            </div>
          </div>
        ) : null}

        <div role="status" aria-live="polite" className="md-body-md">
          {simulando ? FASE_LABEL[emAndamento?.fase ?? 'lendo_fonte'] : null}
          {simulacao && !simulando ? (expirada ? 'O prazo da simulação venceu; simule novamente.' : `Simulação válida até ${horaBrt(simulacao.expiraEm)} (BRT).`) : null}
        </div>

        {simulacao ? (
          <Resumo titulo={`Simulação: ${RESULTADO_LABEL[simulacao.resultadoPrevisto]}`} resumo={simulacao} csv={() => void downloadWebmapCamadasErrosCsv(simulacao.simulacaoId)} />
        ) : null}

        {!simulacao && ultima && ultima.status !== 'EM_ANDAMENTO' ? (
          ultima.status === 'FALHA' ? (
            <Alert variant="error" title={`Última aplicação: ${linhaUltimaAplicacao('FALHA', ultima.iniciadoEmBrt, ultima.usuario)}`}>
              {ultima.motivo ?? 'Erro desconhecido'}. Nada foi alterado: a versão anterior das camadas continua ativa.
            </Alert>
          ) : ultima.resultado ? (
            <Resumo
              titulo={`Última aplicação: ${linhaUltimaAplicacao(ultima.status, ultima.concluidoEmBrt ?? ultima.iniciadoEmBrt, ultima.usuario)}`}
              resumo={ultima.resultado}
              csv={() => void downloadWebmapCamadasErrosCsv()}
            />
          ) : null
        ) : null}

        {historico.length ? (
          <details>
            <summary className="md-label-lg cursor-pointer">Histórico</summary>
            <ul className="md-body-md mt-2 space-y-1">
              {historico.map((h) => (
                <li key={h.id}>
                  {h.dataHoraBrt}: {h.tipo === 'SIMULACAO' ? 'Simulação' : 'Aplicação'} {RESULTADO_LABEL[h.resultado] ?? h.resultado} por {h.usuario}
                  {h.motivo ? `, ${h.motivo}` : ''}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
