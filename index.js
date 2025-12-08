const fileContentFetcher = tool('file_content_fetcher');

// Fetch the complete, final index.js code to ensure all parts (including auxiliaries) are present
const indexJsContent = await fileContentFetcher.fetch({
    source_references: ['uploaded:__ALL__']
});

// Assuming the user accepts the previously provided final structure with Gemini integration logic.
// The integration logic needs to be inserted into the final complete index.js.
// Since the user is explicitly confirming the Gemini integration and API knowledge, 
// I will provide the complete code combining all the successful steps (bug fixes, emoji update, AI logic).

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
// CLIENTE DISCORD E UTILITÁRIAS (Incluindo todas as auxiliares)
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

function buildSafeEmbed(embedOrBuilder) {
    try {
        let embed;
        if (!embedOrBuilder) embed = new EmbedBuilder();
        else if (typeof embedOrBuilder.toJSON === 'function') embed = embedOrBuilder;
        else embed = EmbedBuilder.from(embedOrBuilder);

        const em = embed.toJSON();
        const hasSomething = (em.title && String(em.title).trim()) ||
            (em.description && String(em.description).trim()) ||
            (em.fields && em.fields.length) ||
            em.image?.url ||
            em.footer?.text ||
            em.author?.name ||
            em.color;
        if (!hasSomething) {
            embed.setDescription('\u200b');
        }
        return embed;
    } catch (err) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.ERROR} Embed inválido`)
            .setDescription('Ocorreu um erro ao montar o embed. Tente recomeçar com /embed-builder.');
    }
}

async function getSession(userId) {
    const session = await SessionModel.findOne({ userId });
    if (!session) return null;

    let embed;
    try {
        embed = EmbedBuilder.from(session.embedData);
    } catch (e) {
        console.error(`Erro ao restaurar embed para ${userId}:`, e);
        embed = new EmbedBuilder().setTitle(`${EMOJIS.ERROR} Sessão Corrompida`).setDescription("Por favor, comece uma nova sessão.");
    }
    
    return { 
        embed, 
        buttons: session.buttons || [], 
        fontUrl: session.fontUrl || null 
    };
}

async function saveSession(userId, embed, buttons, fontUrl) {
    const data = {
        userId,
        embedData: embed.toJSON(),
        buttons: buttons || [],
        fontUrl: fontUrl || null,
    };
    await SessionModel.findOneAndUpdate({ userId }, { $set: data }, { upsert: true, new: true });
}

async function deleteSession(userId) {
    await SessionModel.deleteOne({ userId });
}

const createMenu = () => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId('embed_editor_menu')
        .setPlaceholder(`Selecione o que deseja editar...`) 
        .addOptions([
            { label: "Título", value: "edit_title", emoji: EMOJIS.PAGINA },
            { label: "Descrição", value: "edit_description", emoji: EMOJIS.LUPA },
            { label: "Cor", value: "edit_color", emoji: EMOJIS.CONFIG },
            { label: "Imagem", value: "edit_image", emoji: EMOJIS.UPLOAD },
            { label: "Adicionar Campo", value: "add_field", emoji: EMOJIS.SUCCESS },
            { label: "Remover Campo", value: "remove_field", emoji: EMOJIS.LIXEIRA },
            { label: "Adicionar Botão", value: "add_button", emoji: EMOJIS.UPLOAD },
            { label: "Remover Botão", value: "remove_button", emoji: EMOJIS.LIXEIRA },
            { label: "Alterar Label do Botão", value: "edit_button_label", emoji: EMOJIS.PAGINA },
            { label: "Adicionar Emoji ao Botão", value: "add_button_emoji", emoji: EMOJIS.SUCCESS },
            { label: "Remover Emoji do Botão", value: "remove_button_emoji", emoji: EMOJIS.ERROR },
            { label: "Cor do Botão", value: "edit_button_style", emoji: EMOJIS.CONFIG },
            { label: "Exportar JSON", value: "export_json", emoji: EMOJIS.LUPA },
            { label: "Importar JSON", value: "import_json", emoji: EMOJIS.UPLOAD },
            { label: "Timestamp", value: "toggle_timestamp", emoji: EMOJIS.CONFIG }
        ])
);

const createControlButtons = (ownerId) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId(`publish_embed|${ownerId}`)
        .setLabel('Publicar')
        .setStyle(ButtonStyle.Success)
        .setEmoji(EMOJIS.SUCCESS),
    new ButtonBuilder()
        .setCustomId(`cancel_embed|${ownerId}`)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.ERROR)
);

function mapStyleStringToButtonStyle(s) {
    switch (String(s).toLowerCase()) {
        case 'primary': return ButtonStyle.Primary;
        case 'secondary': return ButtonStyle.Secondary;
        case 'success': return ButtonStyle.Success;
        case 'danger': return ButtonStyle.Danger;
        case 'link': return ButtonStyle.Link;
        default: return ButtonStyle.Primary;
    }
}

function applyTextEdit(action, value, embed, buttons = [], ownerId) {
    switch (action) {
        case "edit_title":
            embed.setTitle(value);
            break;
        case "edit_description":
            embed.setDescription(value);
            break;
        case "edit_color": {
            const sanitized = sanitizeColor(value);
            embed.setColor(sanitized);
            break;
        }
        case "edit_image":
            if (!value) embed.data.image = undefined;
            else embed.setImage(value);
            break;
        case "add_field": {
            const fields = embed.data.fields || [];
            if (fields.length >= 25) throw new Error('Máximo de 25 campos atingido.');

            const parts = value.split("|");
            if (parts.length < 2) throw new Error('Formato inválido para add_field. Use: Nome | Valor');
            const name = parts[0].trim();
            const val = parts.slice(1).join('|').trim();
            embed.addFields({ name, value: val, inline: false }); 
            break;
        }
        case "remove_field": {
            const idx = parseInt(value, 10) - 1;
            if (isNaN(idx)) throw new Error('Índice inválido');
            if (!Array.isArray(embed.data.fields) || !embed.data.fields[idx]) throw new Error('Campo não existe');
            embed.data.fields.splice(idx, 1);
            break;
        }
        case "edit_button_label": {
            const arr = buttons;
            const parts = value.split('|');
            if (parts.length < 2) throw new Error('Use: índice | novo label');
            const idx = parseInt(parts[0].trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            arr[idx].label = parts.slice(1).join('|').trim();
            break;
        }
        case "add_button_emoji": {
            const arr = buttons;
            const parts = value.split('|');
            if (parts.length < 2) throw new Error('Use: índice | emoji');
            const idx = parseInt(parts[0].trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            arr[idx].emoji = parts.slice(1).join('|').trim();
            break;
        }
        case "remove_button_emoji": {
            const arr = buttons;
            const idx = parseInt(value.trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            arr[idx].emoji = null;
            break;
        }
        case "edit_button_style": {
            const arr = buttons;
            const parts = value.split('|');
            if (parts.length < 2) throw new Error('Use: índice | style');
            const idx = parseInt(parts[0].trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            const style = parts[1].trim().toLowerCase();
            if (!['primary', 'secondary', 'success', 'danger', 'link'].includes(style)) throw new Error('Style inválido');
            arr[idx].style = style;
            break;
        }
        default:
            throw new Error('Ação desconhecida');
    }
}


// ===========================================================
// REGISTRO DE COMANDOS
// ===========================================================

client.once("ready", async () => {
    console.log(`Bot logado como ${client.user.tag}`);

    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log("✅ MongoDB conectado com sucesso.");
        } catch (err) {
            console.error("❌ Erro de conexão com MongoDB:", err);
        }
    } else {
        console.warn("⚠️ MONGO_URI não definida. As sessões NÃO serão persistentes.");
    }

    const command = new SlashCommandBuilder()
        .setName("embed-builder")
        .setDescription("Construtor interativo de embeds.");

    const aiCommand = new SlashCommandBuilder()
        .setName("ai-embed")
        .setDescription("Gera um embed automaticamente usando IA.")
        .addStringOption(option =>
            option.setName("prompt")
            .setDescription("O que você deseja que a IA gere (ex: 'Um anúncio de desconto de 50%').")
            .setRequired(true)
        );

    try {
        await client.application.commands.create(command);
        await client.application.commands.create(aiCommand); 
        console.log("Comandos /embed-builder e /ai-embed registrados.");
    } catch (err) {
        console.warn("Falha ao registrar comandos:", err);
    }
});

// ===========================================================
// SISTEMA PRINCIPAL DE INTERAÇÃO
// ===========================================================

client.on("interactionCreate", async interaction => {
    // Verificação de acesso: ADMIN_ROLE_ID
    if (ADMIN_ROLE_ID && interaction.member && !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({ content: `Apenas administradores podem usar esta ferramenta.`, ephemeral: true });
    }

    try {
        const userId = interaction.user.id;
        let session = await getSession(userId);


        // ---------- Slash command: /ai-embed ----------
        if (interaction.isCommand() && interaction.commandName === "ai-embed") {
            const prompt = interaction.options.getString("prompt");
            
            await interaction.deferReply({ ephemeral: true });

            let generatedData;
            try {
                // CHAMADA PARA A FUNÇÃO DE IA (GEMINI)
                generatedData = await generateAIEmbed(prompt); 
            } catch (err) {
                console.error('Erro na geração da IA:', err);
                return interaction.editReply({ content: `${EMOJIS.ERROR} Erro ao gerar embed com IA: O serviço falhou ou retornou um formato JSON inválido.` });
            }

            const embedData = generatedData.embed;
            const buttonData = generatedData.buttons || [];
            
            // Corrige e garante estilos padrão para botões gerados
            buttonData.forEach(b => {
                if (b.type === 'link' && !b.style) b.style = 'link';
                if (!b.style) b.style = 'primary';
            });
            
            let emb;
            try {
                emb = EmbedBuilder.from(embedData);
                if (embedData.color && typeof embedData.color === 'string') {
                    emb.setColor(sanitizeColor(embedData.color));
                }
            } catch (err) {
                 return interaction.editReply({ content: `${EMOJIS.ERROR} A IA gerou um objeto Embed inválido. Verifique o JSON.` });
            }

            await saveSession(userId, emb, buttonData, null); 
            session = await getSession(userId);

            await interaction.editReply({
                content: `Embed gerado pela IA! Edite a partir daqui.`,
                embeds: [buildSafeEmbed(session.embed)],
                components: [createMenu(), createControlButtons(userId)]
            });

            return;
        }


        // ---------- Slash command: /embed-builder ----------
        if (interaction.isCommand() && interaction.commandName === "embed-builder") {
            const baseEmbed = new EmbedBuilder()
                .setTitle(`Novo Embed em Construção`)
                .setDescription("Use o menu abaixo para editar.")
                .setColor(0x7B1FA2);

            if (!session) {
                await saveSession(userId, baseEmbed, [], null);
                session = await getSession(userId);
            }

            await interaction.reply({
                content: `Painel carregado! Seu rascunho foi recuperado ou iniciado.`,
                embeds: [buildSafeEmbed(session.embed)],
                components: [createMenu(), createControlButtons(userId)],
                ephemeral: true
            });

            return;
        }

        if (!session) {
            return interaction.reply({ content: `Sessão expirada ou não encontrada. Use \`/embed-builder\` para começar.`, ephemeral: true });
        }
        
        const { embed, buttons, fontUrl } = session;


        // ---------- Menu principal (select) ----------
        if (interaction.isStringSelectMenu() && interaction.customId === "embed_editor_menu") {
            const action = interaction.values[0];

            if (action === "toggle_timestamp") {
                if (embed.data.timestamp) embed.data.timestamp = null;
                else embed.setTimestamp();

                await saveSession(userId, embed, buttons, fontUrl);

                return interaction.update({
                    content: `Timestamp atualizado!`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                });
            }

            if (action === "export_json") {
                const json = JSON.stringify({
                    embed: embed.toJSON(),
                    buttons
                }, null, 4);

                return interaction.reply({
                    content: `**Seu JSON está pronto:**\n\`\`\`json\n${json}\n\`\`\``,
                    ephemeral: true
                });
            }

            if (action === "import_json") {
                const modal = new ModalBuilder()
                    .setCustomId("import_json_modal")
                    .setTitle(`Importar JSON`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("json_data")
                            .setLabel("Cole o JSON aqui")
                            .setStyle(TextInputStyle.Paragraph)
                    )
                );

                return interaction.showModal(modal);
            }

            if (action === "edit_font") {
                const modal = new ModalBuilder()
                    .setCustomId("font_modal")
                    .setTitle(`Alterar Fonte via Link (Experimental)`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("font_url")
                            .setLabel("URL da Fonte (Google Fonts)")
                            .setStyle(TextInputStyle.Short)
                            .setValue(fontUrl || "")
                    )
                );

                return interaction.showModal(modal);
            }

            if (action === "add_button") {
                const modal = new ModalBuilder()
                    .setCustomId(`add_button_modal|${userId}`)
                    .setTitle(`Adicionar Botão`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("b_label").setLabel("Label").setStyle(TextInputStyle.Short)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("b_emoji").setLabel("Emoji (opcional)").setStyle(TextInputStyle.Short).setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("b_type").setLabel("Tipo (link/channel/normal)").setStyle(TextInputStyle.Short).setPlaceholder("link")
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId("b_dest").setLabel("URL ou ID do canal (se aplicável)").setStyle(TextInputStyle.Short).setRequired(false)
                    )
                );

                return interaction.showModal(modal);
            }

            if (action === "remove_button") {
                if (!buttons.length) return interaction.reply({ content: `Nenhum botão para remover.`, ephemeral: true });

                const options = buttons.map((b, i) => ({
                    label: b.label || `${i + 1} — Botão sem Label`,
                    value: `removebtn_${i}`,
                    emoji: b.emoji ? b.emoji : EMOJIS.LIXEIRA
                }));

                const selectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`remove_button_select|${userId}`)
                        .setPlaceholder(`Escolha o botão para remover`)
                        .addOptions(options)
                );

                return interaction.reply({ content: `Selecione o botão para remover:`, components: [selectRow], ephemeral: true });
            }

            const allowedTextActions = new Set([
                "edit_title",
                "edit_description",
                "edit_color",
                "edit_image",
                "add_field",
                "remove_field",
                "edit_button_label",
                "add_button_emoji",
                "remove_button_emoji",
                "edit_button_style"
            ]);

            if (!allowedTextActions.has(action)) {
                return interaction.reply({ content: `Ação desconhecida.`, ephemeral: true });
            }

            const prompts = {
                edit_title: `${EMOJIS.PAGINA} Digite o novo título:`,
                edit_description: `${EMOJIS.LUPA} Digite a nova descrição:`,
                edit_color: `${EMOJIS.CONFIG} Digite a cor (hex #RRGGBB ou número):`,
                edit_image: `${EMOJIS.UPLOAD} Cole a URL da imagem:`,
                add_field: `${EMOJIS.SUCCESS} Digite: Nome | Valor`,
                remove_field: `${EMOJIS.LIXEIRA} Digite o índice do campo (ex: 1)`,
                edit_button_label: `${EMOJIS.PAGINA} Digite: índice | novo label (ex: 1 | Comprar)`,
                add_button_emoji: `${EMOJIS.SUCCESS} Digite: índice | emoji (ex: 1 | 😄)`,
                remove_button_emoji: `${EMOJIS.LIXEIRA} Digite: índice (ex: 1)`,
                edit_button_style: `${EMOJIS.CONFIG} Digite: índice | style (primary/secondary/success/danger/link)`
            };

            await interaction.update({
                content: prompts[action] || `Digite o valor:`,
                embeds: [buildSafeEmbed(embed)],
                components: []
            });

            try {
                const filter = m => m.author.id === userId;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 180000, errors: ['time'] });
                const msg = collected.first();
                const txt = msg.content.trim();

                try {
                    applyTextEdit(action, txt, embed, buttons, userId);
                    await saveSession(userId, embed, buttons, fontUrl); 

                } catch (err) {
                    const code = err.code || ERROR_CODES.GENERIC;
                    await interaction.editReply({
                        content: `⚠️ Ocorreu um erro (Código ${code}):\n\`${err.message}\``,
                        embeds: [buildSafeEmbed(embed)],
                        components: [createMenu(), createControlButtons(userId)]
                    }).catch(() => { });
                    await msg.delete().catch(() => { });
                    return;
                }

                await msg.delete().catch(() => { });

                await interaction.editReply({
                    content: `Atualizado!`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                }).catch(() => { });

            } catch (err) {
                await interaction.editReply({
                    content: `Tempo esgotado — operação cancelada.`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                }).catch(() => { });
            }

            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('remove_button_select|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode usar isso.`, ephemeral: true });

            const val = interaction.values[0];
            if (!val || !val.startsWith('removebtn_')) return interaction.reply({ content: `Valor inválido.`, ephemeral: true });

            const idx = Number(val.split('_')[1]);
            
            if (isNaN(idx) || idx < 0 || idx >= buttons.length) return interaction.reply({ content: `Índice inválido.`, ephemeral: true });

            buttons.splice(idx, 1);
            await saveSession(userId, embed, buttons, fontUrl); 

            await interaction.update({
                content: `Botão removido!`,
                embeds: [buildSafeEmbed(embed)],
                components: [createMenu(), createControlButtons(ownerId)],
            }).catch(() => { });

            return;
        }

        if (interaction.isModalSubmit() && interaction.customId === "import_json_modal") {
            try {
                const rawData = interaction.fields.getTextInputValue("json_data");
                const data = JSON.parse(rawData);
                
                let embedJson = data.embed;
                let newButtons = Array.isArray(data.buttons) ? data.buttons.slice(0, 25) : [];

                if (!embedJson) {
                    if (Array.isArray(data.embeds) && data.embeds.length > 0) {
                        embedJson = data.embeds[0];
                    } else if (data.title || data.description || Array.isArray(data.fields) || data.color) {
                        embedJson = data; 
                    }
                }

                if (!embedJson) throw Object.assign(new Error('Estrutura inválida: Não foi encontrado o objeto embed'), { code: ERROR_CODES.INVALID_JSON });

                let emb;
                try {
                    emb = EmbedBuilder.from(embedJson);
                    const emj = emb.toJSON();
                    if (emj.color && typeof emj.color === 'string') {
                        const ncolor = sanitizeColor(emj.color);
                        emb.setColor(ncolor);
                    }
                } catch (err) {
                    throw Object.assign(new Error('Embed inválido no JSON'), { code: ERROR_CODES.INVALID_JSON });
                }

                newButtons.forEach(b => {
                    if (!b.style && b.type === 'link') b.style = 'link';
                    else if (!b.style) b.style = 'primary';
                });

                await saveSession(userId, emb, newButtons, fontUrl); 

                return interaction.reply({
                    content: `JSON importado!`,
                    embeds: [buildSafeEmbed(emb)],
                    components: [createMenu(), createControlButtons(userId)],
                    ephemeral: true
                });

            } catch (e) {
                const code = e.code || ERROR_CODES.INVALID_JSON;
                return interaction.reply({ content: `JSON inválido (Erro ${code}): ${e.message}`, ephemeral: true });
            }
        }

        if (interaction.isModalSubmit() && interaction.customId === "font_modal") {
            const newFontUrl = interaction.fields.getTextInputValue("font_url");
            await saveSession(userId, embed, buttons, newFontUrl); 
            return interaction.reply({ content: `Fonte atualizada!`, ephemeral: true });
        }

        if (interaction.isModalSubmit() && interaction.customId && interaction.customId.startsWith('add_button_modal|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode usar este modal.`, ephemeral: true });

            const b_label = interaction.fields.getTextInputValue('b_label')?.slice(0, 80) || 'Botão';
            const b_emoji = interaction.fields.getTextInputValue('b_emoji')?.trim() || null;
            const b_type = (interaction.fields.getTextInputValue('b_type') || 'link').toLowerCase().trim();
            const b_dest = (interaction.fields.getTextInputValue('b_dest') || '').trim();

            try {
                if (!['link', 'channel', 'normal'].includes(b_type)) throw Object.assign(new Error('Tipo inválido (use: link/channel/normal)'), { code: ERROR_CODES.GENERIC });
                if (buttons.length >= 25) throw Object.assign(new Error('Máximo de botões atingido'), { code: ERROR_CODES.GENERIC });

                let url = null;
                let style = 'primary'; 
                
                if (b_type === 'link') {
                    if (!/^https?:\/\//.test(b_dest)) throw Object.assign(new Error('URL inválida para link'), { code: ERROR_CODES.GENERIC });
                    url = b_dest;
                    style = 'link'; 
                } else if (b_type === 'channel') {
                    if (!/^[0-9]{17,19}$/.test(b_dest)) throw Object.assign(new Error('ID de canal inválido'), { code: ERROR_CODES.GENERIC });
                    url = b_dest;
                }

                buttons.push({ label: b_label, emoji: b_emoji, type: b_type, url, guildId: interaction.guildId, style });
                await saveSession(userId, embed, buttons, fontUrl); 

                await interaction.update({
                    content: `Botão adicionado!`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(ownerId)]
                });
            } catch (err) {
                return interaction.reply({ content: `Erro: ${err.message}`, ephemeral: true });
            }

            return;
        }

        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('publish_embed|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode publicar.`, ephemeral: true });

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder();
                for (let j = i; j < i + 5 && j < buttons.length; j++) {
                    const b = buttons[j];
                    const style = mapStyleStringToButtonStyle(b.style);
                    const isLink = style === ButtonStyle.Link;

                    const btn = new ButtonBuilder().setLabel(b.label || 'Botão');
                    if (b.emoji) btn.setEmoji(b.emoji);
                    
                    if (isLink) {
                        const url = (b.type === 'channel' && b.url) ? `https://discord.com/channels/${b.guildId || interaction.guildId}/${b.url}` : b.url;
                        if (!url) {
                            console.error(`Botão Link sem URL: ${b.label}`);
                            continue;
                        }
                        btn.setStyle(ButtonStyle.Link).setURL(url);
                    } else {
                        btn.setStyle(style).setCustomId(`userbtn|${ownerId}|${j}`);
                    }
                    row.addComponents(btn);
                }
                if (row.components.length > 0) rows.push(row);
            }

            await interaction.channel.send({
                embeds: [buildSafeEmbed(embed)],
                components: rows
            }).catch(err => console.error('Erro ao enviar embed:', err));

            await deleteSession(ownerId);

            return interaction.update({ content: `🎉 Publicado!`, embeds: [], components: [], ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('cancel_embed|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode cancelar.`, ephemeral: true });

            await deleteSession(ownerId); 

            return interaction.update({ content: `Sessão cancelada.`, embeds: [], components: [], ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('userbtn|')) {
            return interaction.reply({ content: `Botão do embed acionado (sem ação automática).`, ephemeral: true });
        }

    } catch (err) {
        console.error('Erro no handler de interações:', err);
        if (interaction && interaction.replied === false && interaction.deferred === false) {
            try { 
                await interaction.reply({ content: `Ocorreu um erro interno.`, ephemeral: true }); 
            } catch {}
        }
    }
});

// ===========================================================
// PREVENIR CRASH GLOBAL (logs úteis em produção)
// ===========================================================
process.on('unhandledRejection', err => {
    console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', err => {
    console.error('Uncaught exception:', err);
});

client.login(TOKEN).catch(err => console.error('Erro ao logar o bot:', err));
