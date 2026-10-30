# Postagens Engage

Assistente para professores criarem o registro de aula (Data da aula, Ferramentas utilizadas, Turma, UC, Descrição da situação de aprendizagem) e publicarem no Viva Engage com fotos e vídeos.

## Como rodar (primeira vez)

Precisa do **Node.js 20 ou mais novo** e do **Microsoft Edge ou Google Chrome** instalados.

```bash
cd engage-posts
npm install      # baixa as dependências (inclui o Electron, ~100 MB)
npm run dev      # abre o app em modo de desenvolvimento
```

Para abrir sem o modo de desenvolvimento: `npm start`.

## Como testar o Engage (passo a passo)

1. **Configurações → 1.** cole o link da sua comunidade **de teste** e clique em *Salvar link*.
2. **Configurações → 2.** clique em *Entrar no Engage*. Abre uma janela do navegador: entre com a conta da escola (e o MFA, se pedir). Esse login fica guardado no perfil do app.
3. Clique em *Testar conexão*. Deve dizer que achou o botão de nova postagem.
4. Em **Postagens**, crie uma postagem, escreva o relato, anexe uma foto, gere/cole o texto, revise e clique em **Marcar como pronta** → **Publicar só esta**.
5. Com *“Eu mesmo clico em Publicar”* ligado (padrão), o app preenche texto e anexos e **para**; você confere, clica em *Publicar* no Engage e depois em *Já publiquei* no app.

Se algo falhar, o app guarda uma **foto da tela** e um arquivo `...-estrutura.txt` com os nomes dos botões, na pasta aberta por **Configurações → Abrir pasta de registros e capturas de tela**. É com isso que se ajustam os seletores.

## Onde ajustar quando o Engage mudar

Tudo que depende da tela do Engage está em **`electron/engage/selectors.ts`** (nomes dos botões, caixa de texto, anexar, publicar). Cada item é uma lista de tentativas, da mais confiável para a menos.
A lógica do passo a passo (abrir editor → digitar → anexar → publicar) está em `electron/engage/adapter.ts`.

## Estrutura

```
shared/      formato do post, pedido para a IA e leitor da resposta (com testes)
electron/    app (processo principal), armazenamento local, IA, Playwright
  engage/    navegador, seletores e adaptador do Viva Engage
src/         interface (React + Tailwind)
tests/       teste do adaptador contra uma página que simula o Engage
```

Comandos úteis: `npm test` (testes), `npm run typecheck`, `npm run build`.

## Privacidade e segurança

- Só o **texto do relato** vai para a IA (e só se o professor usar). Fotos e vídeos ficam no computador e só vão para o Engage.
- A senha da escola nunca é salva; só o perfil de navegador do app.
- A chave do Gemini (opcional) é guardada criptografada pelo sistema operacional e nunca aparece na interface nem nos registros.
- Uma postagem que ficou “publicando” quando o app fechou **não é reenviada sozinha**: aparece como “Não publicou” pedindo para conferir o Engage antes.

## O que ainda não foi feito

- Instalador (`.exe`/`.dmg`) para distribuir aos professores.
- Validação contra o Viva Engage real (os seletores são uma primeira tentativa).
- Apps assinados digitalmente (o Windows/Mac vão mostrar aviso em apps sem assinatura).
