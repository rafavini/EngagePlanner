import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type BrowserContext } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { SETTINGS_PADRAO, type Post } from '../shared/types'

const CHROME = process.env.TEST_CHROME ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engage-test-'))
let ctx: BrowserContext

vi.mock('electron', () => ({ app: { getPath: () => tmp, isPackaged: true } }))
vi.mock('../electron/engage/browser', () => ({ obterContexto: async () => ctx }))

const URL_FAKE = 'https://fake-engage.test/comunidade'

// Página que imita (de forma simplificada) o fluxo do Viva Engage
const paginaFalsa = (dinamico: boolean) => `<!doctype html><html><body>
<h1>Comunidade GEPOE</h1>
<input type="file" id="banner" style="display:none" onchange="window.__banner = Array.from(this.files).map(f=>f.name)">
<button id="abrir">Iniciar uma conversa</button>
<div id="feed"></div>
<script>
const feed = document.getElementById('feed');
document.getElementById('abrir').onclick = () => {
  const d = document.createElement('div'); d.setAttribute('role','dialog'); d.id='dlg';
  d.innerHTML = '<div role="textbox" contenteditable="true" id="ed" style="border:1px solid #000;min-height:80px"></div>'
    + '<button id="anexar">Anexar foto ou vídeo</button><ul id="anexos"></ul>'
    + '<button id="pub">Publicar</button>';
  document.body.appendChild(d);
  const mostrar = (files) => { for (const f of files) { const li=document.createElement('li'); li.textContent=f.name; document.getElementById('anexos').appendChild(li); setTimeout(()=>{ const im=document.createElement('img'); im.alt=f.name; im.width=10; im.height=10; d.appendChild(im); }, ${dinamico ? 4000 : 0});} };
  ${dinamico
    ? `document.getElementById('anexar').onclick = () => { const i=document.createElement('input'); i.type='file'; i.multiple=true; i.onchange=()=>mostrar(i.files); i.click(); };`
    : `const i=document.createElement('input'); i.type='file'; i.multiple=true; i.onchange=()=>mostrar(i.files); d.appendChild(i);`}
  document.getElementById('pub').onclick = () => {
    const p = document.createElement('article'); p.innerHTML = document.getElementById('ed').innerHTML;
    p.dataset.anexos = document.getElementById('anexos').innerText; feed.prepend(p); d.remove();
  };
};
</script></body></html>`

const post: Post = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  criadoEm: '', atualizadoEm: '', status: 'pronta',
  entrada: { dataISO: '2026-07-14', turma: '2026.1.4', uc: 'UC I', relato: 'x' },
  campos: {
    dataAula: '14 de julho de 2026',
    ferramentas: 'Microsoft PowerPoint e Microsoft Teams',
    turma: '2026.1.4',
    uc: 'Unidade de Extensão I',
    descricao: 'No contexto da Unidade de Extensão I, foi realizada a apresentação dos artigos.\n\nA atividade teve como objetivo X.',
  },
  midias: [{ id: '1', nome: 'foto.png', rel: 'x/foto.png', tipo: 'imagem', tamanho: 10 }],
}

const foto = path.join(tmp, 'foto.png')
const foto2 = path.join(tmp, 'foto2.jpg')

beforeAll(async () => {
  if (!fs.existsSync(CHROME)) return
  fs.writeFileSync(foto, Buffer.from('iVBORw0KGgo=', 'base64'))
  fs.writeFileSync(foto2, Buffer.from('/9j/4AAQ', 'base64'))
  ctx = await (await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })).newContext()
})
afterAll(async () => {
  await ctx?.browser()?.close()
})

async function rodar(dinamico: boolean, parar: boolean) {
  await ctx.unroute('**/*').catch(() => {})
  await ctx.route('https://fake-engage.test/**', (r) => r.fulfill({ contentType: 'text/html', body: paginaFalsa(dinamico) }))
  const { VivaEngageAdapter } = await import('../electron/engage/adapter')
  const confirmar = vi.fn(async () => 'nao-publicada' as const)
  const s = { ...SETTINGS_PADRAO, comunidadeUrl: URL_FAKE, pararAntesDePublicar: parar }
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  const adapter = new VivaEngageAdapter()
  const resultado = await adapter.publicar(post, s, { arquivos: [foto, foto2], confirmarPublicacaoManual: confirmar }).then(() => null, (e: Error) => e)
  return { page, confirmar, resultado }
}

describe.skipIf(!fs.existsSync(CHROME))('adaptador do Engage (página simulada)', () => {
  it('publica texto com rótulos em negrito e anexa arquivos (campo de arquivo existente)', async () => {
    const { page, resultado } = await rodar(false, false)
    expect(resultado).toBeNull()
    const art = page.locator('article').first()
    const html = await art.innerHTML()
    expect(html).toMatch(/<(b|strong)[^>]*>Data da aula:<\/(b|strong)>/)
    expect(html).toMatch(/<(b|strong)[^>]*>Descrição da situação de aprendizagem:<\/(b|strong)>/)
    expect(await art.innerText()).toContain('Microsoft PowerPoint e Microsoft Teams')
    expect(await art.innerText()).toContain('A atividade teve como objetivo X.')
    expect(await art.getAttribute('data-anexos')).toContain('foto.png')
    expect(await art.getAttribute('data-anexos')).toContain('foto2.jpg')
    // armadilha: o campo de arquivo "de fora" (como o da capa da comunidade) NÃO pode receber nada
    expect(await page.evaluate(() => (window as any).__banner)).toBeUndefined()
  })

  it('anexa via janela de escolha de arquivos quando o campo só aparece ao clicar', async () => {
    const { page, resultado } = await rodar(true, false)
    expect(resultado).toBeNull()
    expect(await page.locator('article').first().getAttribute('data-anexos')).toContain('foto2.jpg')
    expect(await page.evaluate(() => (window as any).__banner)).toBeUndefined()
  })

  it('modo "parar antes de publicar": preenche, pergunta e NÃO clica em publicar', async () => {
    const { page, confirmar, resultado } = await rodar(false, true)
    expect(confirmar).toHaveBeenCalledOnce()
    expect(resultado?.message).toMatch(/escolheu não publicar/)
    expect(await page.locator('article').count()).toBe(0)
    expect(await page.locator('#ed').innerText()).toContain('Turma: 2026.1.4')
  })

  it('falha com mensagem clara quando o botão de nova postagem não existe', async () => {
    await ctx.unroute('**/*').catch(() => {})
    await ctx.route('https://fake-engage.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>vazio</h1>' }))
    const { VivaEngageAdapter } = await import('../electron/engage/adapter')
    const s = { ...SETTINGS_PADRAO, comunidadeUrl: URL_FAKE, pararAntesDePublicar: false }
    await expect(new VivaEngageAdapter().publicar(post, s, { arquivos: [], confirmarPublicacaoManual: async () => 'publicada' })).rejects.toThrow(/botão para começar/)
    expect(fs.readdirSync(path.join(tmp, 'logs', 'capturas')).some((f) => f.endsWith('.png'))).toBe(true)
    expect(fs.readdirSync(path.join(tmp, 'logs', 'capturas')).some((f) => f.endsWith('-estrutura.txt'))).toBe(true)
  }, 60_000)
})
