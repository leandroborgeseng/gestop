/**
 * 285 — D-285c: o que cada perfil perde e ganha com a matriz, em relação à main atual.
 * A regra da main é o decorador (@RequirePermissions/@RequireAnyPermissions) com a exceção
 * pelo NOME "Administrador do Sistema". A regra nova é a matriz, com a exceção pelo flag
 * `Perfil.administradorSistema` do perfil ativo. Não consulta banco.
 *
 * Uso: npx tsx scripts/relatorio-d285c.ts
 * Grava docs/d-285c.md e imprime o mesmo texto.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { avaliarEntrada } from '../src/auth/matriz/avaliar-matriz';
import { PERMISSOES_MATRIZ, type EntradaMatriz } from '../src/auth/matriz/permissoes-matriz';
import { descobrirRotas, type RotaDescoberta } from '../src/auth/matriz/rotas-descoberta';
import type { JwtPayload } from '../src/auth/jwt';
import { expandSessionPermissionKeys, REQUIRED_ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from '../src/auth/permissions';
import { ADMINISTRADOR_SISTEMA_NOME } from '../src/domain/permissions-catalog';

const SEED_LEGADO = [
  'usuarios.gerenciar', 'secretarias.gerenciar', 'unidades.gerenciar', 'checklists.gerenciar', 'fiscalizacoes.executar',
  'chamados.gerenciar', 'chamados.abrir', 'chamados.executar', 'chamados.editar_abertura', 'chamados.execucao_manual',
  'meus_chamados.visualizar', 'documentos.visualizar', 'documentos.criar_avulso', 'documentos.editar_vinculo',
  'documentos.gerar_pdf', 'documentos.coletar_assinatura', 'documentos.cancelar_assinado', 'documentos.administrar',
  'dashboard.visualizar', 'auditoria.visualizar',
];
const NOVAS = [
  'chamados.editar_abertura', 'chamados.execucao_manual', 'meus_chamados.visualizar', 'documentos.visualizar',
  'documentos.criar_avulso', 'documentos.editar_vinculo', 'documentos.gerar_pdf', 'documentos.coletar_assinatura',
  'documentos.cancelar_assinado', 'documentos.cancelar', 'documentos.administrar',
];
const GESTOR_SECRETARIA = [
  'secretaria.gerenciar', 'chamados.gerenciar', 'chamados.executar', 'chamados.editar_abertura', 'chamados.execucao_manual',
  'dashboard.visualizar', 'documentos.visualizar', 'documentos.gerar_pdf', 'documentos.coletar_assinatura',
];
const uniq = (xs: string[]) => [...new Set(xs)].sort();

const PERFIS: Array<{ nome: string; nomePerfil: string; origem: string; chaves: string[]; adminFlag?: boolean }> = [
  { nome: 'Administrador do Sistema', nomePerfil: ADMINISTRADOR_SISTEMA_NOME, origem: 'seed.ts + sync-rbac.ts (flag ligado)', chaves: uniq([...SEED_LEGADO, ...NOVAS]), adminFlag: true },
  { nome: 'Administrador do Sistema (sem o flag)', nomePerfil: ADMINISTRADOR_SISTEMA_NOME, origem: 'mesmo perfil, se o sync-rbac não rodou', chaves: uniq([...SEED_LEGADO, ...NOVAS]), adminFlag: false },
  { nome: 'Gestor CCO', nomePerfil: 'Gestor CCO', origem: 'seed.ts + sync-rbac.ts', chaves: uniq([...SEED_LEGADO.filter((k) => k !== 'usuarios.gerenciar'), ...NOVAS]) },
  { nome: 'Gestor de Secretaria', nomePerfil: 'Gestor de Secretaria', origem: 'sync-rbac.ts', chaves: uniq([...GESTOR_SECRETARIA, ...NOVAS]) },
  { nome: 'Agente de Campo', nomePerfil: 'Agente de Campo', origem: 'seed.ts', chaves: ['fiscalizacoes.executar'] },
  { nome: 'Operador de Manutencao', nomePerfil: 'Operador de Manutencao', origem: 'seed.ts', chaves: ['chamados.executar'] },
  {
    nome: 'Solicitação', nomePerfil: 'Solicitação', origem: 'sync-rbac.ts', chaves: [
      'matriz.chamados.abrir_chamado.visualizar', 'matriz.chamados.abrir_chamado.inserir', 'chamados.abrir',
      'matriz.meus_chamados._tela.visualizar', 'matriz.meus_chamados.consultar.visualizar', 'meus_chamados.visualizar',
    ],
  },
];

const PADROES_DIRETOS: Array<{ nome: string; chaves: string[] }> = [
  ...uniq([...SEED_LEGADO, ...GESTOR_SECRETARIA, 'documentos.cancelar']).map((k) => ({ nome: `Só a chave legada direta \`${k}\``, chaves: [k] })),
  {
    nome: 'Perfil legado (Gestor CCO) + 1 permissão direta da matriz (`matriz.relatorios.exportar.executar`)',
    chaves: uniq([...SEED_LEGADO.filter((k) => k !== 'usuarios.gerenciar'), ...NOVAS, 'matriz.relatorios.exportar.executar']),
  },
];

/** Rotas que a main acrescentou e que esta branch passou a decidir na matriz. */
const ROTAS_NOVAS = [
  'POST /auth/refresh',
  'POST /admin/email/diagnostico',
  'POST /admin/importacao/webmap-camadas/simular',
  'POST /admin/importacao/webmap-camadas/aplicar',
  'GET /admin/importacao/webmap-camadas/erros.csv',
  'GET /admin/importacao/webmap-camadas/status',
  'GET /admin/importacao/webmap-camadas/historico',
  'GET /chamados/secretarias/destino-execucao',
  'GET /checklists/resumo',
  'POST /checklists/:id/inativar',
  'POST /checklists/:id/reativar',
  'GET /cronograma/responsaveis/opcoes',
  'GET /cronograma/responsaveis/situacao',
  'POST /cronograma/:id/reativar',
  'POST /documentos/pendencias-abertura-diaria',
  'POST /documentos/:id/cancelar',
  'POST /fiscalizacoes/:id/exclusao',
  'GET /operacional/chamados-mapa/tipos-chamado-disponiveis',
  'GET /operacional/tipos-chamado-disponiveis',
  'GET /operacional/categorias-nota-disponiveis',
  'GET /operacional/tipos-proprio-disponiveis',
  'GET /mapa/camadas',
  'GET /mapa/camadas/status',
  'GET /mapa/camadas/:id/geojson',
];

function sessao(chaves: string[], nomePerfil = '', adminFlag = false): JwtPayload {
  return {
    sub: 'zzteste',
    email: 'zzteste@aion.local',
    nome: 'ZZTESTE',
    perfis: nomePerfil ? [nomePerfil] : [],
    permissoes: chaves,
    secretariaId: 'sec-1',
    secretariasIds: ['sec-1'],
    acessoTodasSecretarias: false,
    administradorSistema: adminFlag,
  };
}

function regraAntiga(r: RotaDescoberta) {
  const todas = (Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, r.handler) ?? Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, r.controller) ?? []) as string[];
  const qualquer = (Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, r.handler) ?? Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, r.controller) ?? []) as string[];
  return { todas, qualquer };
}

/** O que a main permite: exceção pelo nome do perfil, senão os decoradores (matriz → legado). */
function mainPermite(r: RotaDescoberta, u: JwtPayload) {
  if ((u.perfis ?? []).includes(ADMINISTRADOR_SISTEMA_NOME)) return true;
  const { todas, qualquer } = regraAntiga(r);
  const expanded = expandSessionPermissionKeys(u.permissoes ?? []);
  const tem = (p: string) => expanded.has(p) || (u.permissoes ?? []).includes(p);
  if (todas.length && !todas.every(tem)) return false;
  if (qualquer.length && !qualquer.some(tem)) return false;
  return true;
}

function novoPermite(entrada: EntradaMatriz, r: RotaDescoberta, u: JwtPayload) {
  if (entrada.tipo === 'leitura-legada') {
    if (u.administradorSistema) return true;
    const { todas, qualquer } = regraAntiga(r);
    const expanded = expandSessionPermissionKeys(u.permissoes ?? []);
    const tem = (p: string) => expanded.has(p) || (u.permissoes ?? []).includes(p);
    if (todas.length && !todas.every(tem)) return false;
    if (qualquer.length && !qualquer.some(tem)) return false;
    return true;
  }
  return avaliarEntrada(entrada, u).permitido;
}

function descreveEntrada(e: EntradaMatriz) {
  if (e.tipo === 'permissao') return `${e.rotina} › ${e.acao}`;
  if (e.tipo === 'leitura-legada') return 'leitura (decorador da main)';
  if (e.tipo === 'sessao') return 'sessão';
  if (e.tipo === 'publico') return 'público';
  if (e.tipo === 'dono-registro') return `dono do registro (${e.verificador})`;
  return e.tipo;
}

function descreveAntiga(r: RotaDescoberta) {
  const { todas, qualquer } = regraAntiga(r);
  const partes = [
    todas.length ? `todas: ${todas.join(', ')}` : '',
    qualquer.length ? `qualquer: ${qualquer.slice(0, 4).join(', ')}${qualquer.length > 4 ? ` (+${qualquer.length - 4})` : ''}` : '',
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'sem decorador (só sessão)';
}

(async () => {
  const rotas = await descobrirRotas(AppModule);
  const faltando = ROTAS_NOVAS.filter((chave) => !PERMISSOES_MATRIZ[chave]);
  if (faltando.length) throw new Error(`Rotas novas sem entrada na matriz: ${faltando.join(', ')}`);
  const semEntrada = rotas.filter((r) => !PERMISSOES_MATRIZ[r.chave]).map((r) => r.chave);
  if (semEntrada.length) throw new Error(`Rotas descobertas sem entrada: ${semEntrada.join(', ')}`);

  const comparaveis = rotas.filter((r) => {
    const e = PERMISSOES_MATRIZ[r.chave];
    return e && e.tipo !== 'publico' && e.tipo !== 'dono-registro';
  });

  const diff = (u: JwtPayload) => {
    const perde: RotaDescoberta[] = [];
    const ganha: RotaDescoberta[] = [];
    for (const r of comparaveis) {
      const e = PERMISSOES_MATRIZ[r.chave];
      const antes = mainPermite(r, u);
      const depois = novoPermite(e, r, u);
      if (antes && !depois) perde.push(r);
      if (!antes && depois) ganha.push(r);
    }
    return {
      perde: perde.sort((a, b) => a.chave.localeCompare(b.chave)),
      ganha: ganha.sort((a, b) => a.chave.localeCompare(b.chave)),
    };
  };

  const out: string[] = [];
  out.push('# D-285c — Perdas e ganhos de acesso em relação à main atual', '');
  out.push(`Gerado por \`scripts/relatorio-d285c.ts\` em ${new Date().toISOString().slice(0, 10)}, no código da branch \`factory/285-matriz-permissoes\` já com a main integrada. Nenhum banco foi consultado. Usuários fictícios (\`zzteste@aion.local\`).`, '');
  out.push('**Main:** decorador da rota (`@RequirePermissions` / `@RequireAnyPermissions`). Sem decorador, basta sessão. O perfil ativo de nome `Administrador do Sistema` passa em tudo.', '');
  out.push('**Esta branch:** `src/auth/matriz/permissoes-matriz.ts`. A exceção é o flag `administradorSistema` do perfil ativo. Leitura sem efeito continua no decorador. Mutação e GET com efeito usam a chave da matriz. `GET /storage` confere o registro dono.', '');
  out.push('**Uso nos últimos 30 dias:** sem dado. O repositório não traz log de acesso por rota e esta lista não consulta produção. A fonte possível é `LogAuditoria` (`tela` / `funcao` / `createdAt`).', '');
out.push('**Quando a main diz "sem decorador":** o guard deixava passar e o serviço podia recusar. A perda no guard é certa. A perda na prática só existe se o serviço também deixava passar.', '');

  const linha = (r: RotaDescoberta) => {
    const e = PERMISSOES_MATRIZ[r.chave];
    return `| \`${r.chave}\` | ${descreveEntrada(e)} | ${descreveAntiga(r)} | sem dado |`;
  };
  const tabela = (titulo: string, origem: string, u: JwtPayload) => {
    const { perde, ganha } = diff(u);
    out.push(`## ${titulo}`, '', `Origem: ${origem}. Perfil ativo: \`${u.perfis[0] ?? '—'}\`. Flag administradorSistema: \`${u.administradorSistema === true}\`. Chaves: \`${u.permissoes.join('`, `') || '—'}\`.`, '');
    out.push('### Perde', '');
    if (perde.length === 0) out.push('Não perde nenhuma rota em relação à main.', '');
    else {
      out.push('| Rota / tela (API) | Regra nova | O que a main aceitava | Usado nos últimos 30 dias |', '|---|---|---|---|');
      for (const r of perde) out.push(linha(r));
      out.push('');
    }
    out.push('### Ganha', '');
    if (ganha.length === 0) out.push('Não ganha nenhuma rota em relação à main.', '');
    else {
      out.push('| Rota / tela (API) | Regra nova | O que a main exigia | Usado nos últimos 30 dias |', '|---|---|---|---|');
      for (const r of ganha) out.push(linha(r));
      out.push('');
    }
    const storage = u.administradorSistema
      ? 'GET /storage: não perde. O flag continua liberando qualquer arquivo.'
      : 'GET /storage: perde o download que na main bastava estar logado. Passa só com permissão de visualizar a rotina dona (chamado, tarefa, vistoria ou documento) e o registro no escopo de Secretaria. Arquivo sem dono: 403.';
    out.push(`### Storage`, '', storage, '');
    return { perde: perde.length, ganha: ganha.length };
  };

  const resumo: string[] = [];
  out.push('# Por perfil (como definido em seeds/código)', '');
  for (const p of PERFIS) {
    const r = tabela(p.nome, p.origem, sessao(p.chaves, p.nomePerfil, p.adminFlag));
    resumo.push(`- **${p.nome}:** perde ${r.perde} rota(s), ganha ${r.ganha}.`);
  }
  out.push('# Por padrão de permissão direta', '');
  for (const p of PADROES_DIRETOS) {
    const r = tabela(p.nome, 'padrão de permissão direta (não é perfil de sistema)', sessao(p.chaves));
    resumo.push(`- **${p.nome}:** perde ${r.perde} rota(s), ganha ${r.ganha}.`);
  }

  out.push('# Rotas e telas novas da main — decisão na matriz', '');
  out.push('321 (barra do mapa) não cria rota. 311 (vistoria só-leitura na barra do CCO) usa `GET /fiscalizacoes/:id` e `GET /storage`, já decididos. 322-A8 (navegação, sessão, filtros na URL) acrescenta `POST /auth/refresh`.', '');
  out.push('| Rota | Decisão | Quem passa |', '|---|---|---|');
  for (const chave of ROTAS_NOVAS) {
    const e = PERMISSOES_MATRIZ[chave];
    const quem = e.tipo === 'permissao' ? e.chaves.join(', ') : e.tipo === 'leitura-legada' ? 'o mesmo decorador da main' : e.tipo === 'sessao' ? 'qualquer sessão' : e.tipo;
    const nota = 'nota' in e && e.nota ? e.nota : descreveEntrada(e);
    out.push(`| \`${chave}\` | ${nota} | ${quem} |`);
  }
  out.push('');
  out.push('Leitura sem efeito não muda quem entra: o guard global continua aplicando o decorador da main. Mutação e GET com efeito (CSV) passam a exigir a chave da matriz, com a expansão legado → matriz quando o perfil não tem nenhuma chave `matriz.*`.', '');

  const texto = ['# Resumo', '', ...resumo, '', ...out].join('\n');
  const destino = join(__dirname, '..', 'docs', 'd-285c.md');
  writeFileSync(destino, texto);
  console.log(texto);
  console.error(`\nGravado em ${destino}`);
})();
