# Nexus Embed Builder (Puppeteer preview) — Deploy na Discloud

Este projeto fornece um comando `/embed-builder` com preview real de fontes (render HTML + screenshot via Puppeteer).

## Requisitos
- Node.js >= 18 (ou compatível com discord.js v14)
- Conta na Discloud
- Token do bot (no .env)

## Arquivos importantes
- `commands/embed-builder.js` — comando principal (cole na pasta commands)
- `index.js` — seu index principal que carrega comandos (já preparado para usar `handleInteraction`)
- `.env` — variáveis de ambiente
- `package.json` — dependências (`puppeteer`, `node-fetch`, `discord.js`)

## Instalação local (testes)
1. `npm install`
2. Crie `.env` com as variáveis (copie `.env.example`)
3. `node index.js`

## Deploy na Discloud
1. Suba o repositório para o GitHub (ou use upload direto).
2. No painel da Discloud, crie um novo app apontando para o seu repo.
3. Configure variáveis de ambiente (em Settings → Environment Variables):
   - `BOT_TOKEN` (obrigatório)
   - `ADMIN_ROLE_ID` (opcional)
   - `VERIFICATION_URL` (opcional)
   - `CHROME_EXECUTABLE_PATH` (geralmente vazio na Discloud — deixe em branco)
4. **Puppeteer na Discloud**:
   - A Discloud geralmente permite `puppeteer` rodar com as flags `--no-sandbox --disable-setuid-sandbox`. O código já passa essas flags.
   - Se ocorrer erro de execução do Chromium, verifique logs do deploy (console) e considere:
     - usar `puppeteer-core` + apontar `CHROME_EXECUTABLE_PATH` para um binário válido
     - ou usar fallback (o painel continua funcionando sem screenshot)
5. Start command: `npm start` (ou `node index.js`)

## Dicas e troubleshooting
- Se ver erro `Failed to launch the browser process`, verifique logs; experimente:
  - adicionar `CHROME_EXECUTABLE_PATH` para um Chrome/Chromium no sistema (se disponível)
  - usar `puppeteer-core` e instalar chrome no ambiente (mais avançado)
- Puppeteer baixa Chromium (~150MB) durante `npm install`. Em builds automáticos isso pode demorar.
- Se você hospedar em um ambiente que bloqueia execução de executáveis, o código faz fallback — o painel continua, mas sem a imagem com a fonte aplicada.

## Segurança
- Nunca comite o `.env`.
- Use role checks (`ADMIN_ROLE_ID`) para limitar quem pode usar `/embed-builder`.

## Uso
1. No Discord, execute `/embed-builder`.
2. Use o menu para editar título, descrição, cor, campos, botões, fonte.
3. Ao definir uma `Fonte via link` (p.ex. CSS ou link que carrega @font-face), o bot tentará renderizar a prévia com essa fonte e gerar um PNG.
4. Quando satisfeito, clique em **Publicar**.

## Suporte
Se quiser que eu:
- gere um `index.js` compatível com este módulo (loader de commands + roteamento `handleInteraction`), eu gero agora;
- ou ajuste para `puppeteer-core + CHROME_EXECUTABLE_PATH` (recomendado para ambientes customizados), eu adapto.

