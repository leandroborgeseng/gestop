// 307 ciclo 2 — UI local (127.0.0.1:3717 → API 3707, seed fictício 306+307). R5c (multi.ab) e R5b (todas.307), troca em OUTRA aba.
const { chromium } = require('/workspace/fabrica/aionscope/qa-c4111d5/pw/node_modules/playwright');
const fs = require('fs'); const { execFileSync } = require('child_process');
const U = 'http://127.0.0.1:3717'; const SENHA = fs.readFileSync('/tmp/pr307/senha', 'utf8');
const log = []; const L = (s) => { console.log(s); log.push(s); }; let falhas = 0;
const ok = (n, c, extra = '') => { if (!c) falhas++; L(`${c ? 'ok   ' : 'FALHA'} ${n} ${extra}`); };
const psql = (q) => execFileSync('psql', ['-h', '/tmp', '-p', '55463', '-U', 'postgres', '-d', 'g307', '-Atc', q]).toString().trim();
async function login(ctx, email) {
  const p = await ctx.newPage(); await p.goto(U + '/login');
  await p.fill('input[type=email], input[name=email], input#email', email); await p.fill('input[type=password]', SENHA);
  await p.click('button[type=submit]'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); return p;
}
const dialog = (p) => p.locator('[role=dialog]');
const salvar = (p) => p.locator('[data-testid=salvar-cronograma]');
async function editar(p, unidade) {
  await p.goto(U + '/cronograma'); await p.waitForSelector('text=Novo cronograma', { timeout: 20000 });
  const card = p.locator('div').filter({ has: p.locator('h3', { hasText: unidade }) }).filter({ has: p.locator('button', { hasText: 'Editar' }) }).last();
  await card.locator('button', { hasText: 'Editar' }).first().click(); await dialog(p).waitFor();
  await p.waitForSelector('[data-testid=chip-responsavel]', { timeout: 15000 }); await p.waitForTimeout(800);
}
async function trocar(ctx, sigla) { // outra aba (o backdrop do modal impede usar o seletor na aba do modal)
  const p2 = await ctx.newPage(); await p2.goto(U + '/cronograma');
  const sel = p2.locator('select[aria-label="Secretaria ativa"]').first(); await sel.waitFor({ timeout: 20000 });
  const v = await sel.evaluate((s, sg) => [...s.options].find((o) => o.text.includes(sg))?.value, sigla);
  if ((await sel.inputValue()) !== v) { await sel.selectOption(v); await p2.waitForTimeout(2500); }
  await p2.close();
}
const chips = (p) => p.locator('[data-testid=chip-responsavel]').evaluateAll((els) => els.map((e) => `${e.textContent?.trim()}|${e.getAttribute('data-situacao')}`));
(async () => {
  const br = await chromium.launch();
  // ---------- R5c: multi.ab edita cronograma de A; outra aba troca para B → aviso + Salvar travado; volta A → libera
  { const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await login(ctx, 'multi.ab@teste306.invalid');
    await trocar(ctx, 'T306A'); await p.bringToFront();
    await editar(p, 'Próprio Fictício A');
    ok('R5c: antes da troca, sem aviso e Salvar liberado', (await p.locator('[data-testid=aviso-cronograma-fora-escopo]').count()) === 0 && await salvar(p).isEnabled());
    await p.evaluate(() => { window.__semReload = 'm'; });
    await trocar(ctx, 'T306B'); await p.bringToFront();
    const aviso = p.locator('[data-testid=aviso-cronograma-fora-escopo]'); await aviso.waitFor({ timeout: 15000 });
    const txt = (await aviso.innerText()).trim();
    ok('R5c: modal continua ABERTO, sem reload', (await dialog(p).isVisible()) && (await p.evaluate(() => window.__semReload)) === 'm');
    ok('R5c: texto do aviso', txt.includes('Este cronograma não pertence à Secretaria ativa. Volte para T306A – Secretaria Fictícia 306 A para editar.'), JSON.stringify(txt));
    ok('R5c: Salvar travado', !(await salvar(p).isEnabled()));
    ok('R5c: checkbox "manter" oculto enquanto fora do escopo', (await p.locator('[data-testid=confirmar-manter]').count()) === 0);
    const reqs = []; p.on('request', (r) => { if (['PUT', 'PATCH'].includes(r.method())) reqs.push(r.url()); });
    await salvar(p).click({ force: true }).catch(() => {}); await p.waitForTimeout(800);
    ok('R5c: clicar em Salvar não envia requisição (sem 404)', reqs.length === 0, JSON.stringify(reqs));
    await p.screenshot({ path: `${__dirname}/r5c-aviso-salvar-travado.png` });
    await trocar(ctx, 'T306A'); await p.bringToFront();
    await aviso.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    ok('R5c: voltou para T306A → aviso some', (await aviso.count()) === 0);
    ok('R5c: voltou para T306A → Salvar liberado', await salvar(p).isEnabled());
    ok('R5c: voltou para T306A → sem exigir confirmar manter (mesmo contexto da abertura)', (await p.locator('[data-testid=confirmar-manter]').count()) === 0);
    await p.screenshot({ path: `${__dirname}/r5c-volta-a-liberado.png` });
    await ctx.close(); }
  // ---------- R5b: todas.307 (Todas) edita cronograma de B; outra aba troca para B (continua no escopo) → manter + auditoria
  { const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await login(ctx, 'todas.307@teste306.invalid');
    await trocar(ctx, 'Todas'); await p.bringToFront();
    const cronB = psql(`select id from "CronogramaChecagem" where observacoes='Cronograma fictício 307 B'`);
    const antes = Number(psql(`select count(*) from "LogAuditoria" where funcao='responsaveis.manter_fora_escopo' and "valorNovo"->>'cronogramaId'='${cronB}'`));
    await editar(p, 'Próprio Fictício B');
    const s1 = await chips(p);
    ok('R5b: em Todas, gestor A e gestor B OK', s1.filter((s) => s.endsWith('|OK')).length === 2 && s1.length === 2, JSON.stringify(s1));
    await trocar(ctx, 'T306B'); await p.bringToFront();
    await p.waitForSelector('[data-testid=confirmar-manter]', { timeout: 15000 });
    const s2 = await chips(p);
    ok('R5b: sem aviso de fora do escopo (cronograma é de B)', (await p.locator('[data-testid=aviso-cronograma-fora-escopo]').count()) === 0);
    ok('R5b: em B, Gestor A vira Outra Secretaria; Gestor B OK', s2.some((s) => s.startsWith('Gestor Fictício A') && s.endsWith('OUTRA_SECRETARIA')) && s2.some((s) => s.startsWith('Gestor Fictício B') && s.endsWith('|OK')), JSON.stringify(s2));
    ok('R5b: Salvar bloqueado até confirmar', !(await salvar(p).isEnabled()));
    await p.locator('[data-testid=confirmar-manter] input').check();
    ok('R5b: confirmar libera Salvar', await salvar(p).isEnabled());
    await p.screenshot({ path: `${__dirname}/r5b-confirmar-manter.png` });
    const resp = p.waitForResponse((r) => r.url().includes(`/cronograma/${cronB}`) && ['PUT', 'PATCH'].includes(r.request().method()), { timeout: 15000 });
    await salvar(p).click(); const r = await resp;
    ok('R5b: salvar → 2xx', r.status() < 300, String(r.status()));
    await dialog(p).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const row = psql(`select "valorNovo"::text from "LogAuditoria" where funcao='responsaveis.manter_fora_escopo' and "valorNovo"->>'cronogramaId'='${cronB}' order by "createdAt" desc limit 1`);
    const depois = Number(psql(`select count(*) from "LogAuditoria" where funcao='responsaveis.manter_fora_escopo' and "valorNovo"->>'cronogramaId'='${cronB}'`));
    const j = JSON.parse(row || '{}');
    const sB = psql(`select id from "Secretaria" where sigla='T306B'`); const gA = psql(`select id from "Usuario" where email='gestor.a@teste306.invalid'`);
    const todas = psql(`select id from "Usuario" where email='todas.307@teste306.invalid'`);
    ok('R5b: +1 registro de auditoria manter_fora_escopo', depois === antes + 1, `${antes}→${depois}`);
    ok('R5b: auditoria com quem/quando/Secretaria ativa/ids', j.confirmadoPor === todas && !!j.confirmadoEm && j.secretariaAtivaId === sB && JSON.stringify(j.responsavelIdsMantidos) === JSON.stringify([gA]), JSON.stringify(Object.keys(j)));
    await trocar(ctx, 'Todas'); await ctx.close(); }
  L(`falhas=${falhas}`); fs.writeFileSync(__dirname + '/ui-ciclo2.log', log.join('\n') + '\n'); await br.close();
})().catch((e) => { L('ERRO ' + e.message); fs.writeFileSync(__dirname + '/ui-ciclo2.log', log.join('\n') + '\n'); process.exit(1); });
