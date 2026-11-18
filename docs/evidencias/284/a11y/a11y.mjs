import { chromium } from '/workspace/gestop/frontend/node_modules/playwright/index.mjs';
const B='http://localhost:3000', OUT='/workspace/gestop/docs/evidencias/284/a11y', DOC='d0321160-095c-4b93-ab6c-8048b748d0cd', CH='13712206-7a8a-4360-a666-ca4a6827938f';
const res=[]; const ok=(id,pass,det)=>{res.push({id,pass,det}); console.log((pass?'PASS':'FAIL'),id,JSON.stringify(det));};
const br=await chromium.launch(); const page=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();
await page.goto(B+'/login'); await page.locator('input:not([type=password])').first().fill('zzteste.admin@aion.local');
await page.locator('input[type=password]').fill('zzteste-admin-0123'); await page.getByRole('button',{name:'Entrar'}).click(); await page.waitForURL(u=>!u.pathname.startsWith('/login'));
const dlg=()=>page.getByRole('dialog',{name:'Preencher documento'});
async function abrirDoc(){ await page.goto(`${B}/documentos?id=${DOC}`); const b=page.getByRole('button',{name:'Preencher documento',exact:true}).locator('visible=true').first(); await b.waitFor(); await b.evaluate(e=>e.setAttribute('data-zz-opener','1')); await b.focus(); await page.keyboard.press('Enter'); await dlg().waitFor(); await page.waitForTimeout(600); }
async function abrirCh(){ await page.goto(`${B}/chamados?id=${CH}`); await page.waitForTimeout(4000); await page.getByText('Documentos relacionados',{exact:true}).locator('visible=true').first().click(); await page.waitForTimeout(1500);
  const b=page.getByRole('button',{name:/^Preencher/}).locator('visible=true').first(); await b.evaluate(e=>e.setAttribute('data-zz-opener','1')); await b.focus(); await page.keyboard.press('Enter'); await dlg().waitFor(); await page.waitForTimeout(600); }
const focoNoOpener=()=>page.evaluate(()=>document.activeElement?.getAttribute('data-zz-opener')==='1');
// (3) atributos
await abrirDoc();
const a=await page.evaluate(()=>{const d=document.querySelector('[role=dialog]');const t=document.getElementById(d.getAttribute('aria-labelledby'));return {role:d.getAttribute('role'),ariaModal:d.getAttribute('aria-modal'),labelledby:d.getAttribute('aria-labelledby'),titulo:t?.textContent, noBody:d.closest('main')===null}});
ok('3-role-aria', a.role==='dialog'&&a.ariaModal==='true'&&a.titulo==='Preencher documento', a);
await page.screenshot({path:OUT+'/1280x800-aberto.png'});
// (1) foco preso
const focos=[]; for(let i=0;i<80;i++){ await page.keyboard.press(i%10===9?'Shift+Tab':'Tab'); focos.push(await page.evaluate(()=>{const e=document.activeElement;const d=document.querySelector('[role=dialog]');return {dentro:!!d&&d.contains(e), sidebar:!!e?.closest('aside,nav'), txt:(e?.getAttribute('aria-label')||e?.textContent||e?.tagName||'').trim().slice(0,30)}}));}
const fora=focos.filter(f=>!f.dentro);
ok('1-foco-preso-80-tabs', fora.length===0, {tabs:80, fora:fora.length, sidebar:focos.filter(f=>f.sidebar).length, amostra:[...new Set(focos.map(f=>f.txt))].slice(0,12)});
await page.screenshot({path:OUT+'/1280x800-foco-apos-tabs.png'});
// (4) fundo não rola
const s0=await page.evaluate(()=>{const d=document.querySelector('[role=dialog]');let t=0;for(const e of document.querySelectorAll('body *')){if(!d.contains(e))t+=e.scrollTop;}return t+window.scrollY}); const r=await page.evaluate(()=>({pos:document.body.style.position, y0:window.scrollY, htmlH:document.documentElement.scrollHeight}));
await page.mouse.move(40,400); await page.mouse.wheel(0,1500); await page.waitForTimeout(300); await page.keyboard.press('End').catch(()=>{});
const r2=await page.evaluate(()=>{const m=document.querySelector('main');return {y:window.scrollY, mainTop:m?.getBoundingClientRect().top, bodyTop:document.body.style.top}});
const s1=await page.evaluate(()=>{const d=document.querySelector('[role=dialog]');let t=0;for(const e of document.querySelectorAll('body *')){if(!d.contains(e))t+=e.scrollTop;}return t+window.scrollY}); ok('4-fundo-travado', r.pos==='fixed' && r2.y===r.y0 && s0===s1, {...r,...r2,somaScrollForaAntes:s0,somaScrollForaDepois:s1});
// (5) centralizado
const bb=await dlg().boundingBox(); const mw=await dlg().evaluate(e=>getComputedStyle(e).maxWidth);
ok('5-centralizado-1280', Math.abs((bb.x+bb.width/2)-640)<=1 && mw==='768px', {x:bb.x,y:bb.y,w:bb.width,h:bb.height,maxWidth:mw,centroX:bb.x+bb.width/2});
// (2a) Esc
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
ok('2a-esc-fecha-e-devolve-foco-documentos', (await dlg().count())===0 && await focoNoOpener(), {aberto:await dlg().count(), focoNoOpener:await focoNoOpener()});
ok('4b-posicao-restaurada', (await page.evaluate(()=>document.body.style.position))==='', {});
// (2b) botão Fechar
await abrirDoc(); await dlg().getByRole('button',{name:'Fechar'}).click(); await page.waitForTimeout(400);
ok('2b-fechar-devolve-foco-documentos', (await dlg().count())===0 && await focoNoOpener(), {focoNoOpener:await focoNoOpener()});
// (2c/2d) Chamados
await abrirCh(); await page.screenshot({path:OUT+'/1280x800-chamados-aberto.png'}); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
ok('2c-esc-devolve-foco-chamados', (await dlg().count())===0 && await focoNoOpener(), {focoNoOpener:await focoNoOpener()});
await abrirCh(); await dlg().getByRole('button',{name:'Fechar'}).click(); await page.waitForTimeout(400);
ok('2d-fechar-devolve-foco-chamados', (await dlg().count())===0 && await focoNoOpener(), {focoNoOpener:await focoNoOpener()});
await br.close();
const fs=await import('node:fs'); fs.writeFileSync(OUT+'/resultado-'+(process.argv[2]||'depois')+'.json', JSON.stringify(res,null,1));
