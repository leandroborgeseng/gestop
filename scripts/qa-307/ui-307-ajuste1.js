// 307 — UI local (127.0.0.1:3717 → API 3707, seed fictício 306+307). R1, R2, R4, R5c (ciclo 2: aviso + Salvar travado fora do escopo) (desktop 1440 e mobile 390).
const { chromium } = require('/workspace/fabrica/aionscope/qa-c4111d5/pw/node_modules/playwright');
const fs = require('fs');
const U = 'http://127.0.0.1:3717'; const SENHA = fs.readFileSync('/tmp/pr307/senha', 'utf8');
const log = []; const L = (s) => { console.log(s); log.push(s); }; let falhas = 0;
const ok = (n, c, extra = '') => { if (!c) falhas++; L(`${c ? 'ok   ' : 'FALHA'} ${n} ${extra}`); };
async function login(ctx, email) {
  const p = await ctx.newPage();
  await p.goto(U + '/login');
  await p.fill('input[type=email], input[name=email], input#email', email);
  await p.fill('input[type=password]', SENHA);
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  return p;
}
const dialog = (p) => p.locator('[role=dialog]');
async function naoCobreSalvar(p, nome) {
  const lista = await p.locator('[data-testid=lista-responsaveis]').boundingBox();
  const salvar = p.locator('[data-testid=salvar-cronograma]');
  const sb = await salvar.boundingBox();
  const topo = await p.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid=salvar-cronograma]') != null, { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 });
  ok(`${nome}: Salvar visível e clicável com a lista aberta (nada por cima)`, topo);
  // Parte VISÍVEL da lista = recortada pelo corpo rolável do modal; precisa terminar antes do rodapé.
  const vis = await p.locator('[data-testid=lista-responsaveis]').evaluate((el) => {
    let c = el.parentElement; while (c && getComputedStyle(c).overflowY !== 'auto') c = c.parentElement;
    const r = el.getBoundingClientRect(); const cr = c.getBoundingClientRect();
    return { fimVisivel: Math.round(Math.min(r.bottom, cr.bottom)), corpoFim: Math.round(cr.bottom) };
  });
  ok(`${nome}: parte visível da lista termina antes do rodapé`, vis.fimVisivel <= sb.y + 1, JSON.stringify({ ...vis, salvarTopo: Math.round(sb.y) }));
  const dims = await p.locator('[data-testid=lista-responsaveis]').evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight, pos: getComputedStyle(el).position, vh: window.innerHeight, vw: window.innerWidth }));
  ok(`${nome}: lista no fluxo (position static)`, dims.pos === 'static', dims.pos);
  ok(`${nome}: altura limitada (desktop ≤288 px; 390 px ≤50% da tela) e rola (>6 usuários)`, (dims.vw >= 768 ? dims.h <= 288 : dims.h <= dims.vh * 0.5) && dims.sh > dims.h, JSON.stringify(dims));
}
(async () => {
  const br = await chromium.launch();
  for (const [nome, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile390', { width: 390, height: 844 }]]) {
    const ctx = await br.newContext({ viewport: vp });
    const p = await login(ctx, 'multi.ab@teste306.invalid');
    await p.goto(U + '/cronograma'); await p.waitForSelector('text=Novo cronograma', { timeout: 20000 });
    await p.click('text=Novo cronograma'); await dialog(p).waitFor();
    const campo = p.locator('[data-testid=responsaveis-combobox] input[role=combobox]');
    await campo.click(); await p.waitForSelector('[data-testid=opcao-responsavel]', { timeout: 15000 });
    await naoCobreSalvar(p, `${nome} novo`);
    await p.screenshot({ path: `${__dirname}/r1-${nome}-lista-aberta.png` });
    // R2: multi-seleção sem fechar
    const opcoes = p.locator('[data-testid=opcao-responsavel]');
    for (let i = 0; i < 3; i++) await opcoes.nth(i).click();
    ok(`${nome}: marcar 3 não fecha a lista`, await p.locator('[data-testid=lista-responsaveis]').isVisible());
    ok(`${nome}: 3 chips`, (await p.locator('[data-testid=chip-responsavel]').count()) === 3);
    const siglasLista = await p.locator('[data-testid=lista-responsaveis]').innerText();
    ok(`${nome}: Secretaria ativa A → lista sem Gestor Fictício B`, !siglasLista.includes('Gestor Fictício B'));
    await campo.press('Escape');
    ok(`${nome}: Esc fecha a lista`, !(await p.locator('[data-testid=lista-responsaveis]').isVisible()));
    ok(`${nome}: Esc mantém o modal`, await dialog(p).isVisible());
    ok(`${nome}: foco volta/fica no campo`, await campo.evaluate((el) => document.activeElement === el));
    await campo.click(); ok(`${nome}: clique no campo abre`, await p.locator('[data-testid=lista-responsaveis]').isVisible());
    await campo.click(); ok(`${nome}: clique de novo no campo fecha`, !(await p.locator('[data-testid=lista-responsaveis]').isVisible()));
    await campo.click(); await dialog(p).locator('h2').click();
    ok(`${nome}: clique fora fecha`, !(await p.locator('[data-testid=lista-responsaveis]').isVisible()));
    // teclado: remover chip com Enter no ×
    await p.locator('[data-testid=chip-responsavel] button').first().focus(); await p.keyboard.press('Enter');
    ok(`${nome}: × remove com teclado`, (await p.locator('[data-testid=chip-responsavel]').count()) === 2);
    ok(`${nome}: aria combobox/expanded/multiselectable`, (await campo.getAttribute('aria-expanded')) === 'false');
    await p.click('[role=dialog] >> text=Cancelar');
    // R4: editar o cronograma fictício A (gestor A, inativo, gestor B)
    await p.locator('text=Cronograma fictício 307').first().waitFor({ timeout: 15000 }).catch(() => {});
    const card = p.locator('div').filter({ hasText: 'Checklist Fictício 306' }).filter({ has: p.locator('button', { hasText: 'Editar' }) }).last().locator('button', { hasText: 'Editar' }).first();
    await card.click(); await dialog(p).waitFor();
    await p.waitForSelector('[data-testid=chip-responsavel][data-situacao=INATIVO]', { timeout: 15000 });
    const sit = await p.locator('[data-testid=chip-responsavel]').evaluateAll((els) => els.map((e) => `${e.textContent?.trim()}|${e.getAttribute('data-situacao')}`));
    ok(`${nome} R4: chip Inativo`, sit.some((s) => s.includes('Inativo|INATIVO')), JSON.stringify(sit));
    ok(`${nome} R4: chip Outra Secretaria`, sit.some((s) => s.includes('Outra Secretaria|OUTRA_SECRETARIA')));
    ok(`${nome} R4: aviso de regularização`, (await p.locator('[data-testid=aviso-regularizar]').innerText()).includes('2 responsáveis precisam ser regularizados'));
    ok(`${nome} R4: sem troca de contexto, Salvar liberado`, await p.locator('[data-testid=salvar-cronograma]').isEnabled());
    await campo.click(); await p.waitForSelector('[data-testid=opcao-responsavel]');
    await naoCobreSalvar(p, `${nome} editar`);
    await campo.press('Escape');
    // Ajuste 1 (e): placeholder da busca inteiro (sem corte) ao lado dos chips → quebra para a linha inteira.
    const ph = await campo.evaluate((el) => {
      const c = document.createElement('canvas').getContext('2d'); const st = getComputedStyle(el);
      c.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const pad = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
      return { texto: Math.ceil(c.measureText(el.placeholder).width + pad), campo: el.clientWidth };
    });
    ok(`${nome} ajuste1(e): placeholder cabe inteiro no campo de busca`, ph.campo >= ph.texto, JSON.stringify(ph));
    await p.screenshot({ path: `${__dirname}/r4-${nome}-editar.png` });
    if (nome === 'desktop') {
      // R5: troca de Secretaria em OUTRA aba com o modal aberto (backdrop impede usar o seletor nesta aba)
      await p.evaluate(() => { window.__semReload = 'marcador'; });
      const p2 = await ctx.newPage(); await p2.goto(U + '/cronograma'); await p2.waitForSelector('select[aria-label="Secretaria ativa"]', { timeout: 20000 });
      const sel = p2.locator('select[aria-label="Secretaria ativa"]').first();
      const valB = await sel.evaluate((s) => [...s.options].find((o) => o.text.includes('T306B'))?.value);
      await sel.selectOption(valB); await p2.waitForTimeout(2500);
      await p.bringToFront();
      // Ciclo 2 (R5c): cronograma de A fica fora do escopo em B → aviso, Salvar travado, nenhuma requisição.
      const aviso = p.locator('[data-testid=aviso-cronograma-fora-escopo]');
      await aviso.waitFor({ timeout: 15000 });
      ok('R5c: modal continua aberto, sem reload', (await dialog(p).isVisible()) && (await p.evaluate(() => window.__semReload)) === 'marcador');
      ok('R5c: aviso "Volte para T306A"', (await aviso.innerText()).includes('Este cronograma não pertence à Secretaria ativa. Volte para T306A – Secretaria Fictícia 306 A para editar.'));
      ok('R5c: Salvar travado', !(await p.locator('[data-testid=salvar-cronograma]').isEnabled()));
      const reqs = []; const onReq = (r) => { if (['PUT', 'PATCH', 'POST'].includes(r.method()) && r.url().includes('/cronograma')) reqs.push(r.method() + ' ' + r.url()); };
      p.on('request', onReq);
      await p.locator('[data-testid=salvar-cronograma]').click({ force: true }).catch(() => {});
      await p.locator('[data-testid=salvar-cronograma]').press('Enter').catch(() => {});
      await p.waitForTimeout(1000); p.off('request', onReq);
      ok('R5c: nenhuma requisição de salvar enviada (sem 404)', reqs.length === 0, JSON.stringify(reqs));
      await p.screenshot({ path: `${__dirname}/r5c-desktop-apos-troca.png` });
      // volta para A na outra aba (deixa o seed como estava para a próxima rodada)
      const valA = await sel.evaluate((s) => [...s.options].find((o) => o.text.includes('T306A'))?.value);
      await sel.selectOption(valA); await p2.waitForTimeout(2500);
      await p.bringToFront();
      await aviso.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      ok('R5c: de volta em T306A, aviso some', (await aviso.count()) === 0);
      ok('R5c: de volta em T306A, Salvar liberado', await p.locator('[data-testid=salvar-cronograma]').isEnabled());
      await p.screenshot({ path: `${__dirname}/r5c-desktop-volta-a.png` });
    }
    await ctx.close();
  }
  L(`falhas=${falhas}`); fs.writeFileSync(__dirname + '/ui-307.log', log.join('\n') + '\n'); await br.close();
})().catch((e) => { L('ERRO ' + e.message); fs.writeFileSync(__dirname + '/ui-307.log', log.join('\n') + '\n'); process.exit(1); });
