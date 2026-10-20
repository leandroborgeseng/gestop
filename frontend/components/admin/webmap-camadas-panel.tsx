'use client';

import { useCallback, useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  aplicarWebmapCamadas,
  downloadWebmapCamadasErrosCsv,
  getWebmapCamadasHistorico,
  getWebmapCamadasStatus,
  simularWebmapCamadas,
} from '@/lib/api';
import type { WebmapCamadasAplicacao, WebmapCamadasHistoricoItem, WebmapCamadasSimulacao, WebmapCamadasStatus } from '@/lib/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** 296: até 50 erros na tela; o CSV traz todos. */
export const MAX_ERROS_TELA = 50;

const FASE_LABEL: Record<string, string> = {
  lendo_fonte: 'Lendo a fonte do Webmap…',
  comparando: 'Comparando com as camadas já importadas…',
  gravando: 'Gravando as camadas…',
};

const STATUS_LABEL: Record<string, string> = {
  nova: 'Nova',
  atualizada: 'Atualizada',
  sem_mudanca: 'Sem mudança',
  reativada: 'Reativada',
  removida_origem: 'Removida da origem',
};

function horaBrt(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function WebmapCamadasPanel({ canExec }: { canExec: boolean }) {
  const [status, setStatus] = useState<WebmapCamadasStatus | null>(null);
  const [historico, setHistorico] = useState<WebmapCamadasHistoricoItem[]>([]);
  const [simulacao, setSimulacao] = useState<WebmapCamadasSimulacao | null>(null);
  const [aplicacao, setAplicacao] = useState<WebmapCamadasAplicacao | null>(null);
  const [executando, setExecutando] = useState<'simular' | 'aplicar' | null>(null);
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

  // Fase real vinda do servidor enquanto há execução (sem % falso).
  useEffect(() => {
    if (!executando) return;
    const t = window.setInterval(() => void getWebmapCamadasStatus().then(setStatus).catch(() => undefined), 1500);
    return () => window.clearInterval(t);
  }, [executando]);

  async function simular() {
    setErro(null);
    setAplicacao(null);
    setExecutando('simular');
    try {
      setSimulacao(await simularWebmapCamadas());
    } catch (e) {
      setSimulacao(null);
      setErro(e instanceof Error ? e.message : 'Falha na simulação.');
    } finally {
      setExecutando(null);
      void carregar();
    }
  }

  async function aplicar() {
    if (!simulacao) return;
    setErro(null);
    setExecutando('aplicar');
    try {
      setAplicacao(await aplicarWebmapCamadas(simulacao.simulacaoId));
      setSimulacao(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na aplicação. Nada foi alterado.');
    } finally {
      setExecutando(null);
      void carregar();
    }
  }

  const resumo = aplicacao ?? simulacao;
  const expirada = simulacao ? Date.now() > new Date(simulacao.expiraEm).getTime() : false;
  const ocupado = Boolean(executando || status?.emAndamento);

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

        {status?.emAndamento ? (
          <Alert variant="warning" role="status" title="Importação de camadas em andamento">
            {status.emAndamento.usuario} desde {status.emAndamento.desdeBrt}. {FASE_LABEL[status.emAndamento.fase] ?? ''}
          </Alert>
        ) : null}

        {status ? (
          <p className="md-body-md text-[var(--md-on-surface-variant)]">
            {status.ativas} camada(s) ativa(s) · {status.removidasOrigem} removida(s) da origem
            {status.ultima ? ` · Última operação: ${status.ultima.tipo === 'SIMULACAO' ? 'simulação' : 'aplicação'} em ${status.ultima.dataHoraBrt}, ${status.ultima.resultado}` : ''}
          </p>
        ) : null}

        {canExec ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="filled" className="min-h-11" disabled={ocupado} onClick={() => void simular()}>
              <Layers className="h-4 w-4" aria-hidden />
              {executando === 'simular' ? 'Simulando…' : 'Importar apenas camadas Webmap'}
            </Button>
            {simulacao ? (
              <Button variant="tonal" className="min-h-11" disabled={ocupado || expirada} onClick={() => void aplicar()}>
                {executando === 'aplicar' ? 'Aplicando…' : 'Aplicar'}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div role="status" aria-live="polite" className="md-body-md">
          {executando ? FASE_LABEL[status?.emAndamento?.fase ?? 'lendo_fonte'] : null}
          {simulacao && !executando ? (expirada ? 'A simulação expirou. Simule de novo.' : `Simulação válida até ${horaBrt(simulacao.expiraEm)} (BRT).`) : null}
        </div>

        {resumo ? (
          <section aria-label={aplicacao ? 'Resultado da importação' : 'Resultado da simulação'} className="space-y-3">
            <h3 className="md-title-md">
              {aplicacao ? `Importação aplicada: ${aplicacao.resultado}` : `Simulação: ${simulacao!.resultadoPrevisto}`}
            </h3>
            <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Grupos', resumo.grupos],
                ['Camadas', resumo.camadas],
                ['Pontos', resumo.elementos.pontos],
                ['Linhas', resumo.elementos.linhas],
                ['Polígonos', resumo.elementos.poligonos],
                ['Erros de leitura', resumo.totalErros],
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

            {resumo.camadasDetalhe.some((c) => c.status !== 'sem_mudanca') ? (
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
                  Erros de leitura ({Math.min(resumo.totalErros, MAX_ERROS_TELA)} de {resumo.totalErros})
                </h4>
                <ul className="md-body-md list-disc pl-5">
                  {resumo.erros.slice(0, MAX_ERROS_TELA).map((e, i) => (
                    <li key={i}>
                      {e.camada}
                      {e.elemento ? ` (elemento ${e.elemento})` : ''}: {e.motivo}
                    </li>
                  ))}
                </ul>
                {simulacao ? (
                  <Button variant="ghost" className="min-h-11" onClick={() => void downloadWebmapCamadasErrosCsv(simulacao.simulacaoId)}>
                    Baixar CSV com todos os erros
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {historico.length ? (
          <details>
            <summary className="md-label-lg cursor-pointer">Histórico</summary>
            <ul className="md-body-md mt-2 space-y-1">
              {historico.map((h) => (
                <li key={h.id}>
                  {h.dataHoraBrt}: {h.tipo === 'SIMULACAO' ? 'Simulação' : 'Aplicação'} {h.resultado} por {h.usuario}
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
