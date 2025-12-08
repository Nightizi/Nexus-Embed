require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai'); 

// ===========================================================
// CONFIGURAÇÃO E VARIÁVEIS DE AMBIENTE
// ===========================================================

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const MONGO_URI = process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

if (!GEMINI_API_KEY) {
    console.error("❌ ERRO: GEMINI_API_KEY não definida no .env. O comando /ai-embed não funcionará.");
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); 

// ===========================================================
// EMOJIS CUSTOMIZADOS (PREMIUM UX) - COMPLETO
// ===========================================================
const EMOJIS = {
    SUCCESS: "<:CORRETO:1445291463398129805>",
    ERROR: "<:ERRO:1445291466036351037>",
    WARNING: "<:AVISO:1445291371693998207>",
    LIXEIRA: "<:lixeira:1445291381999538206>",
    FERRAMENTAS: "<:Ferramentas:1445291360780554300>",
    LUPA: "<:Lupa:1445291400865517679>",
    PAGINA: "<:Page:1445291385098862694>",
    CONFIG: "<:config:1445291490124501036>",
    UPLOAD: "<:Enviar:1445291365867982911>",
    COROA: "<:Coroa:1445291394875916349>",
    TRANQUEADO: "<:Trancado:1445291492863250524>",
    DISCLOUD_WHITE: "<:DiscloudWhite:1445291357781626972>",
    CARREGANDO: "<:Carregando:1445291363376824423>",
    DISCORD_LOGO: "<:DiscordLogo:1445291374390935594>",
    ANUNCIO: "<:Anuncio:1445291388391395379>",
    DESCONTO: "<:Desconto:1445291391336058890>",
    SINO: "<:Sino:1445291398692868191>",
    ATENCAO: "<:atencao:1445291403243556967>",
    DEPLOY: "<:Deploy:1445291406339084380>",
    CALENDARIO: "<:calendario:1445291408968781948>",
    CART: "<:cart:1445291411598741536>",
    CHAVE: "<:chave:1445291414127902855>",
    ESCUDO: "<:escudo:1445291417340612639>",
    FECHADURA: "<:fechadura:1445291419982889050>",
    HOME: "<:home:1445291422638145566>",
    IDENTIDADE: "<:identidade:1445291425125367941>",
    LAMPADA: "<:lampada:1445291429210488862>",
    MAIS_UM: "<:mais1:1445291431718551643>",
    PIN: "<:pin:1445291435958997083>",
    PONTO_BRANCO: "<:pontobranco:1445291439482212386>",
    SACAR: "<:sacar:1445291442762289174>",
    SIRENE: "<:sirene:1445291445157105781>",
    USUARIO: "<:usuario:1445291449384960090>",
    PONTO_AMARELO: "<:PONTOAMARELO:1445291451935359027>",
    PONTO_VERDE: "<:PONTOVERDE:1445291454112075931>",
    PONTO_VERMELHO: "<:PONTOVERMELHO:1445291457941344386>",
    Z_FELIZ: "<a:zfeliz:1445291460625825893>",
    SALVAR: "<:SALVAR:1445291485263298581>",
    APPS: "<:Apps:1445291496579272895>",
    LEGAL: "<:legal:1445568459575656520>",
    LOGO_NEXUS: "<:LogoNexus:1446977242830737641>"
};

// ===========================================================
// FUNÇÃO DE GERAÇÃO DE EMBED POR IA (INTEGRAÇÃO GEMINI)
// ===========================================================

/**
 * Chama o modelo Gemini para gerar o JSON do embed.
 *
 * @param {string} prompt O texto do usuário.
 * @returns {{ embed: Object, buttons: Array }} JSON com embed e botões (formatos discord.js).
 */
async function generateAIEmbed(prompt) {
    if (!ai) throw new Error("A API do Gemini não está inicializada.");

    const availableEmojis = JSON.stringify(EMOJIS);

    const systemInstruction = `
        Você é um assistente de design de embed altamente focado em produzir JSON válido para Discord.
        Sua tarefa é criar um objeto JSON contendo um 'embed' e uma lista opcional de 'buttons', com base no prompt do usuário.
        
        REGRAS DE FORMATO:
        1. A cor ('color') deve ser um número inteiro (ex: 16711680) ou uma string HEX '#RRGGBB'.
        2. A descrição ('description') deve ser um texto conciso e formatado com Markdown.
        3. Use APENAS os seguintes emojis customizados no seu texto (se relevantes ao tema): ${availableEmojis}. Não invente outros emojis.
        4. O 'type' do botão deve ser 'link', 'channel', ou 'normal'.
        5. O 'style' do botão deve ser 'primary', 'secondary', 'success', 'danger', ou 'link'.
        6. O campo 'url' é OBRIGATÓRIO se style for 'link'. Use "https://exemplo.com" se não souber o URL.

        Responda APENAS com o objeto JSON final, sem qualquer texto adicional ou explicação.
    `;

    const model = 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    embed: {
                        type: "object",
                        description: "O objeto Embed do Discord.",
                        properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            color: { type: "integer" }
                        },
                        required: ["title", "description", "color"]
                    },
                    buttons: {
                        type: "array",
                        description: "Lista opcional de objetos Button.",
                        items: {
                            type: "object",
                            properties: {
                                label: { type: "string" },
                                style: { type: "string", enum: ["primary", "secondary", "success", "danger", "link"] },
                                type: { type: "string", enum: ["normal", "link", "channel"] },
                                url: { type: "string" }
                            },
                            required: ["label", "style"]
                        }
                    }
                }
            }
        }
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
}

// ===========================================================
// BANCO DE DADOS (MONGOOSE)
// ===========================================================

// 1. Esquema para armazenar o estado de edição do usuário
const EmbedSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    embedData: { type: Object, default: {} },
    buttons: { type: Array, default: [] },
    fontUrl: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, expires: '7d' }
});

const SessionModel = mongoose.model('EmbedSession', EmbedSessionSchema);


// ===========================================================
// CLIENTE DISCORD E UTILITÁRIAS
// ===========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const ERROR_CODES = {
    INVALID_COLOR: 1,
    INVALID_JSON: 2,
    SESSION_MISSING: 3,
    GENERIC: 4
};

function sanitizeColor(input) {
    if (!input && input !== 0) throw Object.assign(new Error('Cor vazia'), { code: ERROR_CODES.INVALID_COLOR });
    const s = String(input).trim();
    if (s.startsWith('#')) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(s)) throw Object.assign(new Error('HEX inválido. Use #RRGGBB (ex: #ff0000)'), { code: ERROR_CODES.INVALID_COLOR });
        return parseInt(s.slice(1), 16);
    }
    if (/^\d+$/.test(s)) {
        const n = Number(s);
        if (n >= 0 && n <= 0xFFFFFF) return n;
    }
    throw Object.assign(new Error('Formato de cor inválido. Use #RRGGBB ou um número.'), { code: ERROR_CODES.INVALID_COLOR });
}
// ===========================================================
// PREVENIR CRASH GLOBAL E GARANTIR LOGIN
// ===========================================================
process.on('unhandledRejection', err => {
    // Isso deve capturar erros assíncronos não tratados (promises)
    console.error('Unhandled promise rejection (Async Error):', err);
});
process.on('uncaughtException', err => {
    // Isso deve capturar a maioria dos erros síncronos, mas é o último recurso.
    console.error('Uncaught exception (Sync Error):', err);
    // IMPORTANTE: Em produção, você deve desligar o bot após um uncaughtException
    process.exit(1); 
});


// 🛑 VALIDAÇÃO DE PRÉ-LOGIN 🛑
if (!TOKEN || TOKEN.length < 50) {
    console.error("❌ ERRO FATAL: BOT_TOKEN inválida ou não encontrada. Verifique seu arquivo .env.");
    // Forçamos a saída para mostrar o erro na log, em vez de um crash silencioso.
    process.exit(1);
}

// Tenta o login (o .catch() só pega erros de Promise, não erros síncronos)
client.login(TOKEN).catch(err => {
    console.error('❌ ERRO AO CONECTAR AO DISCORD. Verifique seu Token e Intenções:', err);
    process.exit(1);
});
