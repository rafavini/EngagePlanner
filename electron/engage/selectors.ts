import type { Locator, Page } from 'playwright-core'

/** Onde procurar: a página inteira ou só a janela de nova postagem. */
export type Escopo = Page | Locator

/**
 * TUDO que depende da tela do Viva Engage fica neste arquivo.
 * Cada item é uma lista de tentativas, da mais confiável para a menos: o programa
 * usa a primeira que estiver visível. Se a Microsoft mudar a tela (ou o teste real
 * mostrar um nome diferente), é só ajustar aqui.
 */
export type Candidato = (escopo: Escopo) => Locator

export const SELETORES: Record<string, Candidato[]> = {
  // botão/caixa que abre o editor de nova postagem na página da comunidade
  abrirEditor: [
    (p) => p.getByRole('button', { name: /(iniciar|começar|criar|nova).{0,20}(conversa|postagem|publica[cç][aã]o|discuss)/i }),
    (p) => p.getByRole('button', { name: /(start|new).{0,15}(conversation|post|discussion)/i }),
    (p) => p.getByPlaceholder(/(conversa|postagem|compartilh|share|post)/i),
    (p) => p.getByText(/^(iniciar uma conversa|iniciar uma postagem|compartilhe|start a conversation)/i),
  ],
  // área onde o texto é digitado
  editor: [
    (p) => p.getByRole('dialog').getByRole('textbox').first(),
    (p) => p.locator('[contenteditable="true"][role="textbox"]').first(),
    (p) => p.getByRole('textbox').first(),
    (p) => p.locator('[contenteditable="true"]').first(),
  ],
  // botão de anexar foto/vídeo (procurado SÓ dentro da janela de nova postagem)
  anexar: [
    (p) => p.getByRole('button', { name: /(anexar|adicionar|carregar|enviar|inserir).{0,20}(foto|imagem|v[ií]deo|m[ií]dia|arquivo)/i }),
    (p) => p.getByRole('button', { name: /(attach|add|upload|insert).{0,15}(photo|image|video|media|file)/i }),
    (p) => p.getByRole('button', { name: /^(foto|fotos|imagem|imagens|m[ií]dia|v[ií]deo|arquivo|anexo|image|photo|attach)/i }),
    (p) => p.getByRole('button', { name: /(imagem|foto|image|photo|picture)/i }),
    (p) => p.getByRole('button', { name: /^(mais|more|adicionar|add)/i }),
  ],
  // item de menu "do computador", caso o botão de anexar abra um menu
  anexarMenuItem: [
    (p) => p.getByRole('menuitem', { name: /(computador|dispositivo|upload|carregar|this device|computer)/i }),
    (p) => p.getByText(/(do computador|do dispositivo|from (this )?(computer|device))/i),
  ],
  // botão final de publicar
  publicar: [
    (p) => p.getByRole('button', { name: /^(publicar|postar|enviar)$/i }),
    (p) => p.getByRole('button', { name: /^(post|publish|submit)$/i }),
  ],
}

export const SELETOR_ENTRADA_ARQUIVO = 'input[type="file"]'

/** Endereços que indicam tela de login da Microsoft */
export const HOSTS_DE_LOGIN = ['login.microsoftonline.com', 'login.live.com', 'login.microsoft.com']

/** Espera até um dos candidatos ficar visível; devolve o localizador ou null. */
export async function primeiroVisivel(
  page: Page,
  candidatos: Candidato[],
  timeoutMs = 8000,
  escopo: Escopo = page,
): Promise<Locator | null> {
  const fim = Date.now() + timeoutMs
  while (Date.now() < fim) {
    for (const c of candidatos) {
      const loc = c(escopo).first()
      try {
        if (await loc.isVisible()) return loc
      } catch {
        /* página navegando: tenta de novo */
      }
    }
    await page.waitForTimeout(300)
  }
  return null
}
