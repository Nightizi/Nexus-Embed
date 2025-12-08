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

// ===========================================================
// CONFIGURAÇÃO E VARIÁVEIS DE AMBIENTE
// ===========================================================

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const MONGO_URI = process.env.MONGO_URI;

// ===========================================================
// EMOJIS CUSTOMIZADOS (PREMIUM UX) - ASSUMIMOS QUE OS IDS SÃO VÁLIDOS
// O uso destes emojis foi LIMITADO aos campos 'emoji' dos componentes.
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
};


// ===========================================================
// BANCO DE DADOS (MONGOOSE)
// ===========================================================

// 1. Esquema para armazenar o estado de edição do usuário
const EmbedSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    embedData: { type: Object, default: {} }, // Estado do EmbedBuilder (JSON)
    buttons: { type: Array, default: [] },    // Botões
    fontUrl: { type: String, default: null }, // Link da Fonte
    createdAt: { type: Date, default: Date.now, expires: '7d' } // Expira a sessão após 7 dias
});

const SessionModel = mongoose.model('EmbedSession', EmbedSessionSchema);


// ===========================================================
// CLIENTE DISCORD
// ===========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// ===========================================================
// UTILITÁRIAS DE SEGURANÇA / VALIDAÇÃO
// ===========================================================

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

// ===========================================================
// FUNÇÕES DE PERSISTÊNCIA (Substituindo os Mapas)
// ===========================================================

/**
 * Busca a sessão do usuário no MongoDB.
 * @param {string} userId 
 * @returns {{ embed: EmbedBuilder, buttons: Array, fontUrl: string }}
 */
async function getSession(userId) {
    const session = await SessionModel.findOne({ userId });
    if (!session) return null;

    let embed;
    try {
        // Tenta reconstruir o EmbedBuilder a partir dos dados salvos
        embed = EmbedBuilder.from(session.embedData);
    } catch (e) {
        // Se falhar, retorna um embed base para não quebrar a sessão
        console.error(`Erro ao restaurar embed para ${userId}:`, e);
        // Usa unicode simples aqui, pois está em um embed de erro que deve ser robusto
        embed = new EmbedBuilder().setTitle("❌ Sessão Corrompida").setDescription("Por favor, comece uma nova sessão.");
    }
    
    return { 
        embed, 
        buttons: session.buttons || [], 
        fontUrl: session.fontUrl || null 
    };
}

/**
 * Salva ou atualiza a sessão do usuário.
 */
async function saveSession(userId, embed, buttons, fontUrl) {
    const data = {
        userId,
        embedData: embed.toJSON(),
        buttons: buttons || [],
        fontUrl: fontUrl || null,
    };
    // Usa upsert: true para criar se não existir, ou atualizar se existir.
    await SessionModel.findOneAndUpdate({ userId }, { $set: data }, { upsert: true, new: true });
}

/**
 * Deleta a sessão do usuário.
 */
async function deleteSession(userId) {
    await SessionModel.deleteOne({ userId });
}

// ===========================================================
// COMPONENTES DO PAINEL
// ===========================================================

const createMenu = () => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId('embed_editor_menu')
        // CORRIGIDO: Removido EMOJI do placeholder para evitar falha de parse
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

// ===========================================================
// REGISTRO E CONEXÃO
// ===========================================================

client.once("ready", async () => {
    console.log(`Bot logado como ${client.user.tag}`);

    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log("✅ MongoDB conectado com sucesso.");
        } catch (err) {
            console.error("❌ Erro de conexão com MongoDB:", err);
            // O bot pode continuar, mas as sessões não serão persistentes.
        }
    } else {
        console.warn("⚠️ MONGO_URI não definida. As sessões NÃO serão persistentes.");
    }

    const command = new SlashCommandBuilder()
        .setName("embed-builder")
        .setDescription("Construtor interativo de embeds.");

    try {
        await client.application.commands.create(command);
        console.log("Comando /embed-builder registrado.");
    } catch (err) {
        console.warn("Falha ao registrar comando:", err);
    }
});

// ===========================================================
// SISTEMA PRINCIPAL DE INTERAÇÃO
// ===========================================================

client.on("interactionCreate", async interaction => {
    // Verificação de acesso: ADMIN_ROLE_ID
    // CORRIGIDO: Removido EMOJI do content
    if (ADMIN_ROLE_ID && interaction.member && !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({ content: `Apenas administradores podem usar esta ferramenta.`, ephemeral: true });
    }

    try {
        const userId = interaction.user.id;
        let session = await getSession(userId);

        // ---------- Slash command: abrir painel ----------
        if (interaction.isCommand() && interaction.commandName === "embed-builder") {
            const baseEmbed = new EmbedBuilder()
                .setTitle(`Novo Embed em Construção`)
                .setDescription("Use o menu abaixo para editar.")
                .setColor(0x7B1FA2);

            // Se já tem sessão, carrega a antiga. Senão, salva a nova.
            if (!session) {
                await saveSession(userId, baseEmbed, [], null);
                session = await getSession(userId); // Recarrega a sessão salva
            }

            // CORRIGIDO: Removido EMOJI do content
            await interaction.reply({
                content: `Painel carregado! Seu rascunho foi recuperado ou iniciado.`,
                embeds: [buildSafeEmbed(session.embed)],
                components: [createMenu(), createControlButtons(userId)],
                ephemeral: true
            });

            return;
        }

        // Se não for o comando inicial e não houver sessão, a sessão expirou.
        // CORRIGIDO: Removido EMOJI do content
        if (!session) {
            return interaction.reply({ content: `Sessão expirada ou não encontrada. Use \`/embed-builder\` para começar.`, ephemeral: true });
        }
        
        const { embed, buttons, fontUrl } = session;


        // ---------- Menu principal (select) ----------
        if (interaction.isStringSelectMenu() && interaction.customId === "embed_editor_menu") {
            const action = interaction.values[0];

            // Toggle timestamp
            if (action === "toggle_timestamp") {
                if (embed.data.timestamp) embed.data.timestamp = null;
                else embed.setTimestamp();

                await saveSession(userId, embed, buttons, fontUrl);

                // CORRIGIDO: Removido EMOJI do content
                return interaction.update({
                    content: `Timestamp atualizado!`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                });
            }

            // Export JSON
            if (action === "export_json") {
                const json = JSON.stringify({
                    embed: embed.toJSON(),
                    buttons
                }, null, 4);

                // CORRIGIDO: Removido EMOJI do content
                return interaction.reply({
                    content: `**Seu JSON está pronto:**\n\`\`\`json\n${json}\n\`\`\``,
                    ephemeral: true
                });
            }

            // Import JSON (show modal)
            if (action === "import_json") {
                const modal = new ModalBuilder()
                    // CORRIGIDO: Removido EMOJI do title (embora modais sejam mais tolerantes, é mais seguro)
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

            // Edit font (modal)
            if (action === "edit_font") {
                const modal = new ModalBuilder()
                    .setCustomId("font_modal")
                    // CORRIGIDO: Removido EMOJI do title
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

            // Add button -> open a modal for button creation
            if (action === "add_button") {
                const modal = new ModalBuilder()
                    .setCustomId(`add_button_modal|${userId}`)
                    // CORRIGIDO: Removido EMOJI do title
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

            // Remove button -> show select menu
            if (action === "remove_button") {
                // CORRIGIDO: Removido EMOJI do content
                if (!buttons.length) return interaction.reply({ content: `Nenhum botão para remover.`, ephemeral: true });

                const options = buttons.map((b, i) => ({
                    // Usa LIXEIRA como fallback se o botão não tiver label, mantendo a originalidade
                    label: b.label || `${i + 1} — Botão sem Label`,
                    value: `removebtn_${i}`,
                    // Usa o emoji do botão, ou LIXEIRA como fallback
                    emoji: b.emoji ? b.emoji : EMOJIS.LIXEIRA
                }));

                const selectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`remove_button_select|${userId}`)
                        // CORRIGIDO: Removido EMOJI do placeholder
                        .setPlaceholder(`Escolha o botão para remover`)
                        .addOptions(options)
                );

                // CORRIGIDO: Removido EMOJI do content
                return interaction.reply({ content: `Selecione o botão para remover:`, components: [selectRow], ephemeral: true });
            }

            // For other simple edits (require message input)
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

            // CORRIGIDO: Removido EMOJI do content
            if (!allowedTextActions.has(action)) {
                return interaction.reply({ content: `Ação desconhecida.`, ephemeral: true });
            }

            // Prompt user and await a single message response
            // CORRIGIDO: Removido EMOJI do content (mantido apenas no prompt descritivo)
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

            // Edita a mensagem do painel para o prompt e remove os botões de edição
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

                // perform action
                try {
                    applyTextEdit(action, txt, embed, buttons, userId);
                    await saveSession(userId, embed, buttons, fontUrl); // Salva a alteração no DB

                } catch (err) {
                    const code = err.code || ERROR_CODES.GENERIC;
                    // CORRIGIDO: Removido EMOJI do content
                    await interaction.editReply({
                        content: `⚠️ Ocorreu um erro (Código ${code}):\n\`${err.message}\``,
                        embeds: [buildSafeEmbed(embed)],
                        components: [createMenu(), createControlButtons(userId)]
                    }).catch(() => { });
                    await msg.delete().catch(() => { });
                    return;
                }

                await msg.delete().catch(() => { });

                // update panel
                // CORRIGIDO: Removido EMOJI do content
                await interaction.editReply({
                    content: `Atualizado!`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                }).catch(() => { });

            } catch (err) {
                // timeout or other
                // Volta o painel ao estado normal
                // CORRIGIDO: Removido EMOJI do content
                await interaction.editReply({
                    content: `Tempo esgotado — operação cancelada.`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                }).catch(() => { });
            }

            return;
        }

        // ---------- Remove button select handler ----------
        if (interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('remove_button_select|')) {
            const [, ownerId] = interaction.customId.split('|');
            // CORRIGIDO: Removido EMOJI do content
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode usar isso.`, ephemeral: true });

            const val = interaction.values[0];
            // CORRIGIDO: Removido EMOJI do content
            if (!val || !val.startsWith('removebtn_')) return interaction.reply({ content: `Valor inválido.`, ephemeral: true });

            const idx = Number(val.split('_')[1]);
            
            // CORRIGIDO: Removido EMOJI do content
            if (isNaN(idx) || idx < 0 || idx >= buttons.length) return interaction.reply({ content: `Índice inválido.`, ephemeral: true });

            buttons.splice(idx, 1);
            await saveSession(userId, embed, buttons, fontUrl); // Salva a remoção no DB

            // CORRIGIDO: Removido EMOJI do content
            await interaction.update({
                content: `Botão removido!`,
                embeds: [buildSafeEmbed(embed)],
                components: [createMenu(), createControlButtons(ownerId)],
            }).catch(() => { });

            return;
        }

        // ---------- Modal submit: import JSON ----------
        if (interaction.isModalSubmit() && interaction.customId === "import_json_modal") {
            try {
                const data = JSON.parse(interaction.fields.getTextInputValue("json_data"));
                // CORRIGIDO: Removido EMOJI do content
                if (!data.embed) throw Object.assign(new Error('Estrutura inválida: falta campo embed'), { code: ERROR_CODES.INVALID_JSON });

                let emb;
                try {
                    emb = EmbedBuilder.from(data.embed);
                    const emj = emb.toJSON();
                    if (emj.color && typeof emj.color === 'string') {
                        const ncolor = sanitizeColor(emj.color);
                        emb.setColor(ncolor);
                    }
                } catch (err) {
                    throw Object.assign(new Error('Embed inválido no JSON'), { code: ERROR_CODES.INVALID_JSON });
                }

                const newButtons = Array.isArray(data.buttons) ? data.buttons.slice(0, 25) : [];
                
                await saveSession(userId, emb, newButtons, fontUrl); // Salva a importação no DB

                // CORRIGIDO: Removido EMOJI do content
                return interaction.reply({
                    content: `JSON importado!`,
                    embeds: [buildSafeEmbed(emb)],
                    components: [createMenu(), createControlButtons(userId)],
                    ephemeral: true
                });

            } catch (e) {
                const code = e.code || ERROR_CODES.INVALID_JSON;
                // CORRIGIDO: Removido EMOJI do content
                return interaction.reply({ content: `JSON inválido (Erro ${code}): ${e.message}`, ephemeral: true });
            }
        }

        // ---------- Modal submit: edit font ----------
        if (interaction.isModalSubmit() && interaction.customId === "font_modal") {
            const newFontUrl = interaction.fields.getTextInputValue("font_url");
            await saveSession(userId, embed, buttons, newFontUrl); // Salva o URL da fonte no DB
            // CORRIGIDO: Removido EMOJI do content
            return interaction.reply({ content: `Fonte atualizada!`, ephemeral: true });
        }

        // ---------- Modal submit: add button ----------
        if (interaction.isModalSubmit() && interaction.customId && interaction.customId.startsWith('add_button_modal|')) {
            const [, ownerId] = interaction.customId.split('|');
            // CORRIGIDO: Removido EMOJI do content
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode usar este modal.`, ephemeral: true });

            const b_label = interaction.fields.getTextInputValue('b_label')?.slice(0, 80) || 'Botão';
            const b_emoji = interaction.fields.getTextInputValue('b_emoji')?.trim() || null;
            const b_type = (interaction.fields.getTextInputValue('b_type') || 'link').toLowerCase().trim();
            const b_dest = (interaction.fields.getTextInputValue('b_dest') || '').trim();

            try {
                if (!['link', 'channel', 'normal'].includes(b_type)) throw Object.assign(new Error('Tipo inválido (use: link/channel/normal)'), { code: ERROR_CODES.GENERIC });
                if (buttons.length >= 25) throw Object.assign(new Error('Máximo de botões atingido'), { code: ERROR_CODES.GENERIC });

                let url = null;
                let style = 'primary'; // Padrão
                
                if (b_type === 'link') {
                    if (!/^https?:\/\//.test(b_dest)) throw Object.assign(new Error('URL inválida para link'), { code: ERROR_CODES.GENERIC });
                    url = b_dest;
                    style = 'link'; // CORREÇÃO: Define o estilo como link
                } else if (b_type === 'channel') {
                    if (!/^[0-9]{17,19}$/.test(b_dest)) throw Object.assign(new Error('ID de canal inválido'), { code: ERROR_CODES.GENERIC });
                    url = b_dest;
                }

                buttons.push({ label: b_label, emoji: b_emoji, type: b_type, url, guildId: interaction.guildId, style });
                await saveSession(userId, embed, buttons, fontUrl); // Salva o novo botão no DB

                // CORRIGIDO: Removido EMOJI do content
                await interaction.update({
                    content: `Botão adicionado!`,
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(ownerId)]
                });
            } catch (err) {
                // CORRIGIDO: Removido EMOJI do content
                return interaction.reply({ content: `Erro: ${err.message}`, ephemeral: true });
            }

            return;
        }

        // ---------- Publish button (protected by owner id in customId) ----------
        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('publish_embed|')) {
            const [, ownerId] = interaction.customId.split('|');
            // CORRIGIDO: Removido EMOJI do content
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode publicar.`, ephemeral: true });

            // build rows from user buttons
            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder();
                for (let j = i; j < i + 5 && j < buttons.length; j++) {
                    const b = buttons[j];
                    const style = mapStyleStringToButtonStyle(b.style);
                    const isLink = style === ButtonStyle.Link;

                    const btn = new ButtonBuilder().setLabel(b.label || 'Botão');
                    if (b.emoji) btn.setEmoji(b.emoji);
                    
                    // A lógica aqui estava correta, mas a correção na criação (style: 'link') garante o fluxo
                    if (isLink) {
                        const url = (b.type === 'channel') ? `https://discord.com/channels/${b.guildId || interaction.guildId}/${b.url}` : b.url;
                        btn.setStyle(ButtonStyle.Link).setURL(url);
                    } else {
                        btn.setStyle(style).setCustomId(`userbtn|${ownerId}|${j}`);
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }

            // send embed
            await interaction.channel.send({
                embeds: [buildSafeEmbed(embed)],
                components: rows
            }).catch(err => console.error('Erro ao enviar embed:', err));

            // cleanup session
            await deleteSession(ownerId);

            // CORRIGIDO: Removido EMOJI do content
            return interaction.update({ content: `🎉 Publicado!`, embeds: [], components: [], ephemeral: true });
        }

        // ---------- Cancel button (protected) ----------
        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('cancel_embed|')) {
            const [, ownerId] = interaction.customId.split('|');
            // CORRIGIDO: Removido EMOJI do content
            if (userId !== ownerId) return interaction.reply({ content: `Apenas o criador pode cancelar.`, ephemeral: true });

            await deleteSession(ownerId); // Deleta a sessão do DB

            // CORRIGIDO: Removido EMOJI do content
            return interaction.update({ content: `Sessão cancelada.`, embeds: [], components: [], ephemeral: true });
        }

        // ---------- User-button clicked (non-link) ----------
        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('userbtn|')) {
            // CORRIGIDO: Removido EMOJI do content
            return interaction.reply({ content: `Botão do embed acionado (sem ação automática).`, ephemeral: true });
        }

    } catch (err) {
        console.error('Erro no handler de interações:', err);
        if (interaction && interaction.replied === false && interaction.deferred === false) {
            try { 
                // CORRIGIDO: Removido EMOJI do content
                await interaction.reply({ content: `Ocorreu um erro interno.`, ephemeral: true }); 
            } catch {}
        }
    }
});

// ===========================================================
// FUNÇÃO AUXILIAR: Aplicar Edição (text-based actions)
// ===========================================================
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
            if (fields.length >= 25) throw new Error('Máximo de 25 campos ating
