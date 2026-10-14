/**
 * 285 — D-285c: quem perde acesso com a matriz nova.
 * Compara, para cada rota com regra explícita (mutação/efeito), a regra ANTIGA
 * (decoradores @RequirePermissions/@RequireAnyPermissions + derivação legada) com a NOVA
 * (matriz). Perfis conforme definidos no código (prisma/seed.ts + prisma/sync-rbac.ts) e
 * padrões de permissão direta. Não consulta banco.
 *
 * Uso: npx tsx scripts/relatorio-d285c.ts > relatorio-D-285c.md
 */
import 'reflect-metadata';
import { AppModule } from '../src/app.module';
import { avaliarEntrada } from '../src/auth/matriz/avaliar-matriz';
import { PERMISSOES_MATRIZ } from '../src/auth/matriz/permissoes-matriz';
import { descobrirRotas } from '../src/auth/matriz/rotas-descoberta';
import type { JwtPayload } from '../src/auth/jwt';
import { hasAllPermissions, hasAnyPermission, REQUIRED_ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from '../src/auth/permissions';

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
  'documentos.cancelar_assinado', 'documentos.administrar',
];
const GESTOR_SECRETARIA = [
  'secretaria.gerenciar', 'chamados.gerenciar', 'chamados.executar', 'chamados.editar_abertura', 'chamados.execucao_manual',
  'dashboard.visualizar', 'documentos.visualizar', 'documentos.gerar_pdf', 'documentos.coletar_assinatura',
];
const uniq = (xs: string[]) => [...new Set(xs)].sort();

const PERFIS: Array<{ nome: string; origem: string; chaves: string[]; admin?: boolean }> = [
  { nome: 'Administrador do Sistema', origem: 'seed.ts + sync-rbac.ts', chaves: uniq([...SEED_LEGADO, ...NOVAS]), admin: true },
  { nome: 'Administrador do Sistema (sem a migração do flag)', origem: 'cenário de risco', chaves: uniq([...SEED_LEGADO, ...NOVAS]) },
  { nome: 'Gestor CCO', origem: 'seed.ts + sync-rbac.ts', chaves: uniq([...SEED_LEGADO.filter((k) => k !== 'usuarios.gerenciar'), ...NOVAS]) },
  { nome: 'Gestor de Secretaria', origem: 'sync-rbac.ts', chaves: uniq([...GESTOR_SECRETARIA, ...NOVAS]) },
  { nome: 'Agente de Campo', origem: 'seed.ts', chaves: ['fiscalizacoes.executar'] },
  { nome: 'Operador de Manutencao', origem: 'seed.ts', chaves: ['chamados.executar'] },
  {
    nome: 'Solicitação', origem: 'sync-rbac.ts', chaves: [
      'matriz.chamados.abrir_chamado.visualizar', 'matriz.chamados.abrir_chamado.inserir', 'chamados.abrir',
      'matriz.meus_chamados._tela.visualizar', 'matriz.meus_chamados.consultar.visualizar', 'meus_chamados.visualizar',
    ],
  },
];

const PADROES_DIRETOS: Array<{ nome: string; chaves: string[] }> = [
  ...uniq([...SEED_LEGADO, ...GESTOR_SECRETARIA]).map((k) => ({ nome: `Só a chave legada direta \`${k}\``, chaves: [k] })),
  {
    nome: 'Perfil legado (Gestor CCO) + 1 permissão direta da matriz (`matriz.relatorios.exportar.executar`)',
    chaves: uniq([...SEED_LEGADO.filter((k) => k !== 'usuarios.gerenciar'), ...NOVAS, 'matriz.relatorios.exportar.executar']),
  },
];

function sessao(chaves: string[], admin = false): JwtPayload {
  return {
    sub: 'x', email: 'x@aion.local', nome: 'x', perfis: [], permissoes: chaves, secretariaId: 'sec-1',
    secretariasIds: ['sec-1'], acessoTodasSecretarias: false, administradorSistema: admin,
  };
}

(async () => {
  const rotas = await descobrirRotas(AppModule);
  const alvo = rotas.filter((r) => {
    const e = PERMISSOES_MATRIZ[r.chave];
    return e && (e.tipo === 'permissao' || e.tipo === 'dono-registro');
  });

  const regraAntiga = (r: (typeof rotas)[number]) => {
    const todas = (Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, r.handler) ?? Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, r.controller) ?? []) as string[];
    const qualquer = (Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, r.handler) ?? Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, r.controller) ?? []) as string[];
    return { todas, qualquer };
  };
  const antigoPermite = (r: (typeof rotas)[number], u: JwtPayload) => {
    const { todas, qualquer } = regraAntiga(r);
    if (todas.length && !hasAllPermissions(u, todas)) return false;
    if (qualquer.length && !hasAnyPermission(u, qualquer)) return false;
    return true;
  };
  const descreveAntiga = (r: (typeof rotas)[number]) => {
    const { todas, qualquer } = regraAntiga(r);
    const partes = [
      todas.length ? `todas: ${todas.join(', ')}` : '',
      qualquer.length ? `qualquer: ${qualquer.slice(0, 4).join(', ')}${qualquer.length > 4 ? ` (+${qualquer.length - 4})` : ''}` : '',
    ].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'sem decorador (só sessão; serviço decidia)';
  };

  const perdas = (u: JwtPayload) =>
    alvo.filter((r) => {
      const e = PERMISSOES_MATRIZ[r.chave];
      if (e.tipo === 'dono-registro') return false; // depende do registro: tratado à parte
      return antigoPermite(r, u) && !avaliarEntrada(e, u).permitido;
    });

  const out: string[] = [];
  out.push('# D-285c — Quem perde acesso com a matriz de permissões (285 fase 1)', '');
  out.push(`Gerado por \`scripts/relatorio-d285c.ts\` em ${new Date().toISOString().slice(0, 10)}, a partir do código da branch \`factory/285-matriz-permissoes\`. Nenhum banco foi consultado.`, '');
  out.push('**Como ler:** a regra antiga é a dos decoradores (`@RequirePermissions`/`@RequireAnyPermissions`) com a derivação matriz→legado. A regra nova é a matriz (`src/auth/matriz/permissoes-matriz.ts`). As permissões efetivas são as do perfil ATIVO mais as diretas, expandidas como na tela de Permissões (`resolveEffectiveMatrixKeys`). Só entram as rotas com regra explícita (mutação ou GET com efeito). As leituras sem efeito não mudam na fase 1.', '');
  out.push('**Perdas certas × prováveis:** "certa" quer dizer que o decorador antigo permitia. "Provável" quer dizer que a rota não tinha decorador e a checagem era só no serviço; ali a perda é real apenas se o serviço também permitia. Exemplo: em `POST /chamado-tarefas` o serviço exigia `chamados.gerenciar` ou `tarefas.inserir`, então quem só tinha `auditoria.visualizar` já não conseguia antes.', '');
  out.push('**Uso nos últimos 30 dias:** "sem dado" em todas as linhas. O repositório não traz logs de acesso, e a regra do lote proíbe consultar o banco de produção. A fonte possível é `LogAuditoria` (`tela`/`funcao`/`createdAt`), consultada em homologação ou pelo Leandro.', '');

  const semDecorador = (r: (typeof rotas)[number]) => {
    const { todas, qualquer } = regraAntiga(r);
    return todas.length === 0 && qualquer.length === 0;
  };
  const tabela = (titulo: string, origem: string, u: JwtPayload) => {
    const lista = perdas(u).sort((a, b) => Number(semDecorador(a)) - Number(semDecorador(b)));
    out.push(`## ${titulo}`, '', `Origem: ${origem}. Chaves: \`${u.permissoes.join('`, `') || '—'}\`.`, '');
    if (lista.length === 0) {
      out.push('Não perde nenhuma ação.', '');
      return 'nenhuma ação perdida';
    }
    out.push('| Ação perdida (rota) | Rotina/ação nova exigida | Permissão legada que permitia | Usado nos últimos 30 dias |', '|---|---|---|---|');
    for (const r of lista) {
      const e = PERMISSOES_MATRIZ[r.chave];
      const nova = e.tipo === 'permissao' ? `${e.rotina} › ${e.acao}` : e.tipo;
      out.push(`| \`${r.chave}\` | ${nova} | ${descreveAntiga(r)} | sem dado |`);
    }
    out.push('');
    const n = lista.filter((r) => !semDecorador(r)).length;
    return `${n} certas (o decorador permitia) + ${lista.length - n} prováveis (rota sem decorador, em que o serviço decidia)`;
  };

  const resumo: string[] = [];
  out.push('# Por perfil (como definido em seeds/código)', '');
  for (const p of PERFIS) resumo.push(`- **${p.nome}:** ${tabela(p.nome, p.origem, sessao(p.chaves, p.admin))} `);
  out.push('# Por padrão de permissão direta', '');
  for (const p of PADROES_DIRETOS) resumo.push(`- **${p.nome}:** ${tabela(p.nome, 'padrão de permissão direta', sessao(p.chaves))} `);

  out.push('# Casos que dependem do registro', '');
  out.push('- `GET /storage/{*splat}`: antes bastava estar logado. Agora exige permissão de visualizar a rotina dona do arquivo (chamado, tarefa, vistoria ou documento) e o registro no escopo de Secretaria. Quem só tinha sessão perde o download de arquivos fora do seu escopo ou da sua rotina. Arquivos sem registro dono indexado (prefixos `evidencias/` e `documentos/`) exigem a permissão da rotina e alguma Secretaria no escopo. Outros prefixos sem dono dão 403.', '');
  out.push('- **Perfil com chaves legadas e alguma chave da matriz:** como na tela de Permissões, quando existe ao menos uma chave `matriz.*` as legadas deixam de ser expandidas. Veja o último padrão direto acima.', '');

  console.log(['# Resumo', '', ...resumo, '', ...out].join('\n'));
})();
