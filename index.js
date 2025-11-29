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

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

const embedStates = new Map();     // Estado principal do embed (EmbedBuilder)
const buttonStates = new Map();    // Botões adicionados pelo usuário (array)
const fontStates = new Map();      // Fonte do embed (string)

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/* ===========================================================
   UTILITÁRIAS DE SEGURANÇA / VALIDAÇÃO
   ===========================================================*/

// Códigos de erro para feedback
const ERROR_CODES = {
    INVALID_COLOR: 1,
    INVALID_JSON: 2,
    SESSION_MISSING: 3,
    GENERIC: 4
};

function sanitizeColor(input) {
    // Aceita: "#RRGGBB" ou número decimal (string ou number)
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
    // Retorna um EmbedBuilder sempre válido (nunca vazio)
    try {
        let embed;
        if (!embedOrBuilder) embed = new EmbedBuilder();
        else if (typeof embedOrBuilder.toJSON === 'function') embed = embedOrBuilder;
        else embed = EmbedBuilder.from(embedOrBuilder);

        // Garantir descrição mínima para evitar "description[BASE_TYPE_REQUIRED]"
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
        // Fallback embed
        return new EmbedBuilder()
            .setTitle('Embed inválido')
            .setDescription('Ocorreu um erro ao montar o embed.');
    }
}

/* ===========================================================
   COMPONENTES DO PAINEL
   ===========================================================*/

const createMenu = () => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId('embed_editor_menu')
        .setPlaceholder('Selecione o que deseja editar...')
        .addOptions([
            { label: "Título", value: "edit_title" },
            { label: "Descrição", value: "edit_description" },
            { label: "Cor", value: "edit_color" },
            { label: "Imagem", value: "edit_image" },
            { label: "Adicionar Campo", value: "add_field" },
            { label: "Remover Campo", value: "remove_field" },
            { label: "Adicionar Botão", value: "add_button" },
            { label: "Remover Botão", value: "remove_button" },
            { label: "Alterar Label do Botão", value: "edit_button_label" },
            { label: "Adicionar Emoji ao Botão", value: "add_button_emoji" },
            { label: "Remover Emoji do Botão", value: "remove_button_emoji" },
            { label: "Cor do Botão", value: "edit_button_style" },
            { label: "Alterar Fonte (Link)", value: "edit_font" },
            { label: "Exportar JSON", value: "export_json" },
            { label: "Importar JSON", value: "import_json" },
            { label: "Timestamp", value: "toggle_timestamp" }
        ])
);

const createControlButtons = (ownerId) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId(`publish_embed|${ownerId}`)
        .setLabel('✅ Publicar')
        .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
        .setCustomId(`cancel_embed|${ownerId}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
);

/* ===========================================================
   REGISTRO DO COMANDO
   ===========================================================*/

client.once("ready", async () => {
    console.log(`Bot logado como ${client.user.tag}`);

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

/* ===========================================================
   SISTEMA PRINCIPAL DE INTERAÇÃO
   ===========================================================*/

client.on("interactionCreate", async interaction => {
    try {
        // ---------- Slash command: abrir painel ----------
        if (interaction.isCommand() && interaction.commandName === "embed-builder") {
            if (ADMIN_ROLE_ID && (!interaction.member || !interaction.member.roles || !interaction.member.roles.cache.has(ADMIN_ROLE_ID))) {
                return interaction.reply({ content: "❌ Apenas administradores podem usar isso.", ephemeral: true });
            }

            const userId = interaction.user.id;

            const baseEmbed = new EmbedBuilder()
                .setTitle("✨ Novo Embed em Construção")
                .setDescription("Use o menu abaixo para editar.")
                .setColor(0x7B1FA2);

            embedStates.set(userId, baseEmbed);
            buttonStates.set(userId, []);
            fontStates.set(userId, null);

            await interaction.reply({
                content: "Painel carregado!",
                embeds: [buildSafeEmbed(baseEmbed)],
                components: [createMenu(), createControlButtons(userId)],
                ephemeral: true
            });

            return;
        }

        // ---------- Menu principal (select) ----------
        if (interaction.isStringSelectMenu() && interaction.customId === "embed_editor_menu") {
            const userId = interaction.user.id;
            const embed = embedStates.get(userId);
            const buttons = buttonStates.get(userId) || [];

            if (!embed) return interaction.reply({ content: "Sessão expirada!", ephemeral: true });

            const action = interaction.values[0];

            // Toggle timestamp
            if (action === "toggle_timestamp") {
                if (embed.data.timestamp) embed.data.timestamp = null;
                else embed.setTimestamp();

                return interaction.update({
                    content: "Timestamp atualizado!",
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

                return interaction.reply({
                    content: "📤 **Seu JSON está pronto:**\n```json\n" + json + "\n```",
                    ephemeral: true
                });
            }

            // Import JSON (show modal)
            if (action === "import_json") {
                const modal = new ModalBuilder()
                    .setCustomId("import_json_modal")
                    .setTitle("Importar JSON");

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
                    .setTitle("Alterar Fonte via Link");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("font_url")
                            .setLabel("URL da Fonte (Google Fonts)")
                            .setStyle(TextInputStyle.Short)
                    )
                );

                return interaction.showModal(modal);
            }

            // Add button -> open a modal for button creation (no free-text collector)
            if (action === "add_button") {
                const modal = new ModalBuilder()
                    .setCustomId(`add_button_modal|${userId}`)
                    .setTitle("Adicionar Botão");

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

            // Remove button -> show select menu (NEVER asks for text)
            if (action === "remove_button") {
                const currentButtons = buttonStates.get(userId) || [];
                if (!currentButtons.length) return interaction.reply({ content: 'Nenhum botão para remover.', ephemeral: true });

                const options = currentButtons.map((b, i) => ({
                    label: b.label || `Botão ${i + 1}`,
                    value: `removebtn_${i}`
                }));

                const selectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`remove_button_select|${userId}`)
                        .setPlaceholder('Escolha o botão para remover')
                        .addOptions(options)
                );

                return interaction.reply({ content: 'Selecione o botão para remover:', components: [selectRow], ephemeral: true });
            }

            // For other simple edits (title, description, color, image, add_field, remove_field, edit_button_label, add_button_emoji, etc.)
            // we use a prompt via awaitMessages (not a collector) so we avoid duplicate collectors.
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
                return interaction.reply({ content: 'Ação desconhecida.', ephemeral: true });
            }

            // Prompt user via update and then await a single message response
            const prompts = {
                edit_title: 'Digite o novo título:',
                edit_description: 'Digite a nova descrição:',
                edit_color: 'Digite a cor (hex #RRGGBB ou número):',
                edit_image: 'Cole a URL da imagem:',
                add_field: 'Digite: Nome | Valor',
                remove_field: 'Digite o índice do campo (ex: 1)',
                edit_button_label: 'Digite: índice | novo label (ex: 1 | Comprar)',
                add_button_emoji: 'Digite: índice | emoji (ex: 1 | 😄)',
                remove_button_emoji: 'Digite: índice (ex: 1)',
                edit_button_style: 'Digite: índice | style (primary/secondary/success/danger/link)'
            };

            await interaction.update({
                content: prompts[action] || 'Digite o valor:',
                embeds: [buildSafeEmbed(embed)],
                components: []
            });

            try {
                const filter = m => m.author.id === interaction.user.id;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 180000, errors: ['time'] });
                const msg = collected.first();
                const txt = msg.content.trim();

                // perform action
                try {
                    applyTextEdit(action, txt, embed, buttons, userId);
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

                // update panel
                await interaction.editReply({
                    content: "Atualizado!",
                    embeds: [buildSafeEmbed(embed)],
                    components: [createMenu(), createControlButtons(userId)]
                }).catch(() => { });

            } catch (err) {
                // timeout or other
                return interaction.followUp({ content: 'Tempo esgotado — operação cancelada.', ephemeral: true });
            }

            return;
        }

        // ---------- Remove button select handler ----------
        if (interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('remove_button_select|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Apenas o criador pode usar isso.', ephemeral: true });

            const val = interaction.values[0];
            if (!val || !val.startsWith('removebtn_')) return interaction.reply({ content: 'Valor inválido.', ephemeral: true });

            const idx = Number(val.split('_')[1]);
            const arr = buttonStates.get(ownerId) || [];
            if (isNaN(idx) || idx < 0 || idx >= arr.length) return interaction.reply({ content: 'Índice inválido.', ephemeral: true });

            arr.splice(idx, 1);
            buttonStates.set(ownerId, arr);

            const embed = embedStates.get(ownerId);
            await interaction.update({
                content: 'Botão removido!',
                embeds: [buildSafeEmbed(embed)],
                components: [createMenu(), createControlButtons(ownerId)],
            }).catch(() => { });

            return;
        }

        // ---------- Modal submit: import JSON ----------
        if (interaction.isModalSubmit() && interaction.customId === "import_json_modal") {
            const userId = interaction.user.id;
            try {
                const data = JSON.parse(interaction.fields.getTextInputValue("json_data"));
                if (!data.embed) throw Object.assign(new Error('Estrutura inválida: falta campo embed'), { code: ERROR_CODES.INVALID_JSON });

                let emb;
                try {
                    emb = EmbedBuilder.from(data.embed);
                    // normalize color if string
                    const emj = emb.toJSON();
                    if (emj.color && typeof emj.color === 'string') {
                        const ncolor = sanitizeColor(emj.color);
                        emb.setColor(ncolor);
                    }
                } catch (err) {
                    throw Object.assign(new Error('Embed inválido no JSON'), { code: ERROR_CODES.INVALID_JSON });
                }

                embedStates.set(userId, emb);
                if (Array.isArray(data.buttons)) buttonStates.set(userId, data.buttons.slice(0, 25)); // keep reasonable limit

                return interaction.reply({
                    content: "✅ JSON importado!",
                    embeds: [buildSafeEmbed(emb)],
                    components: [createMenu(), createControlButtons(userId)],
                    ephemeral: true
                });

            } catch (e) {
                const code = e.code || ERROR_CODES.INVALID_JSON;
                return interaction.reply({ content: `❌ JSON inválido (Erro ${code}): ${e.message}`, ephemeral: true });
            }
        }

        // ---------- Modal submit: edit font ----------
        if (interaction.isModalSubmit() && interaction.customId === "font_modal") {
            const userId = interaction.user.id;
            fontStates.set(userId, interaction.fields.getTextInputValue("font_url"));
            return interaction.reply({ content: "Fonte atualizada!", ephemeral: true });
        }

        // ---------- Modal submit: add button ----------
        if (interaction.isModalSubmit() && interaction.customId && interaction.customId.startsWith('add_button_modal|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Apenas o criador pode usar este modal.', ephemeral: true });

            const b_label = interaction.fields.getTextInputValue('b_label')?.slice(0, 80) || 'Botão';
            const b_emoji = interaction.fields.getTextInputValue('b_emoji')?.trim() || null;
            const b_type = (interaction.fields.getTextInputValue('b_type') || 'link').toLowerCase().trim();
            const b_dest = (interaction.fields.getTextInputValue('b_dest') || '').trim();

            const arr = buttonStates.get(ownerId) || [];
            try {
                if (!['link', 'channel', 'normal'].includes(b_type)) throw Object.assign(new Error('Tipo inválido (use: link/channel/normal)'), { code: ERROR_CODES.GENERIC });
                if (arr.length >= 25) throw Object.assign(new Error('Máximo de botões atingido'), { code: ERROR_CODES.GENERIC });

                let url = null;
                if (b_type === 'link') {
                    if (!/^https?:\/\//.test(b_dest)) throw Object.assign(new Error('URL inválida para link'), { code: ERROR_CODES.GENERIC });
                    url = b_dest;
                } else if (b_type === 'channel') {
                    if (!/^[0-9]{17,19}$/.test(b_dest)) throw Object.assign(new Error('ID de canal inválido'), { code: ERROR_CODES.GENERIC });
                    url = b_dest;
                }

                arr.push({ label: b_label, emoji: b_emoji, type: b_type, url, guildId: interaction.guildId });
                buttonStates.set(ownerId, arr);

                const emb = embedStates.get(ownerId);
                await interaction.update({
                    content: '✅ Botão adicionado!',
                    embeds: [buildSafeEmbed(emb)],
                    components: [createMenu(), createControlButtons(ownerId)]
                });
            } catch (err) {
                return interaction.reply({ content: `Erro: ${err.message}`, ephemeral: true });
            }

            return;
        }

        // ---------- Publish button (protected by owner id in customId) ----------
        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('publish_embed|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Apenas o criador pode publicar.', ephemeral: true });

            const embed = embedStates.get(ownerId);
            const buttons = buttonStates.get(ownerId) || [];

            if (!embed) return interaction.reply({ content: "Sessão expirada!", ephemeral: true });

            // build rows from user buttons (link buttons produce link style, others primary)
            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder();
                for (let j = i; j < i + 5 && j < buttons.length; j++) {
                    const b = buttons[j];
                    const isLink = b.type === 'link' || b.type === 'channel';
                    const btn = new ButtonBuilder().setLabel(b.label || 'Botão');
                    if (b.emoji) btn.setEmoji(b.emoji);
                    if (isLink) {
                        const url = (b.type === 'channel') ? `https://discord.com/channels/${b.guildId || interaction.guildId}/${b.url}` : b.url;
                        btn.setStyle(ButtonStyle.Link).setURL(url);
                    } else {
                        btn.setStyle(ButtonStyle.Primary).setCustomId(`userbtn|${ownerId}|${j}`);
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }

            // send embed without any automatic verification button
            await interaction.channel.send({
                embeds: [buildSafeEmbed(embed)],
                components: rows
            }).catch(err => console.error('Erro ao enviar embed:', err));

            // cleanup session
            embedStates.delete(ownerId);
            buttonStates.delete(ownerId);
            fontStates.delete(ownerId);

            return interaction.update({ content: "🎉 Publicado!", embeds: [], components: [], ephemeral: true });
        }

        // ---------- Cancel button (protected) ----------
        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('cancel_embed|')) {
            const [, ownerId] = interaction.customId.split('|');
            if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Apenas o criador pode cancelar.', ephemeral: true });

            embedStates.delete(ownerId);
            buttonStates.delete(ownerId);
            fontStates.delete(ownerId);

            return interaction.update({ content: "❌ Sessão cancelada.", embeds: [], components: [], ephemeral: true });
        }

        // ---------- User-button clicked (non-link) ----------
        if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('userbtn|')) {
            // customId format: userbtn|ownerId|index
            const parts = interaction.customId.split('|');
            if (parts.length !== 3) return interaction.reply({ content: 'Ação inválida.', ephemeral: true });
            const ownerId = parts[1];
            // Only allow the owner or anyone? Here we reply ephemeral to the clicker
            return interaction.reply({ content: '🔘 Botão do embed acionado (sem ação automática).', ephemeral: true });
        }

    } catch (err) {
        console.error('Erro no handler de interações:', err);
        if (interaction && interaction.replied === false && interaction.deferred === false) {
            try { await interaction.reply({ content: '❌ Ocorreu um erro interno.', ephemeral: true }); } catch {}
        }
    }
});

/* ===========================================================
   FUNÇÃO AUXILIAR: Aplicar Edição (text-based actions)
   - action: string
   - value: user text
   - embed: EmbedBuilder (from embedStates)
   - buttons: array (from buttonStates)
   - ownerId: string (user id) - optional, needed for button edits
   ===========================================================*/
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
            // Accept empty to remove
            if (!value) embed.data.image = undefined;
            else embed.setImage(value);
            break;
        case "add_field": {
            const parts = value.split("|");
            if (parts.length < 2) throw new Error('Formato inválido para add_field. Use: Nome | Valor');
            const name = parts[0].trim();
            const val = parts.slice(1).join('|').trim();
            embed.addFields({ name, value: val });
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
            // format: "index | new label"
            if (!ownerId) throw new Error('OwnerId necessário');
            const arr = buttonStates.get(ownerId) || [];
            const parts = value.split('|');
            if (parts.length < 2) throw new Error('Use: índice | novo label');
            const idx = parseInt(parts[0].trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            arr[idx].label = parts.slice(1).join('|').trim();
            buttonStates.set(ownerId, arr);
            break;
        }
        case "add_button_emoji": {
            if (!ownerId) throw new Error('OwnerId necessário');
            const arr = buttonStates.get(ownerId) || [];
            const parts = value.split('|');
            if (parts.length < 2) throw new Error('Use: índice | emoji');
            const idx = parseInt(parts[0].trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            arr[idx].emoji = parts.slice(1).join('|').trim();
            buttonStates.set(ownerId, arr);
            break;
        }
        case "remove_button_emoji": {
            if (!ownerId) throw new Error('OwnerId necessário');
            const arr = buttonStates.get(ownerId) || [];
            const idx = parseInt(value.trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            arr[idx].emoji = null;
            buttonStates.set(ownerId, arr);
            break;
        }
        case "edit_button_style": {
            if (!ownerId) throw new Error('OwnerId necessário');
            const arr = buttonStates.get(ownerId) || [];
            const parts = value.split('|');
            if (parts.length < 2) throw new Error('Use: índice | style');
            const idx = parseInt(parts[0].trim(), 10) - 1;
            if (isNaN(idx) || !arr[idx]) throw new Error('Índice inválido');
            const style = parts[1].trim().toLowerCase();
            if (!['primary', 'secondary', 'success', 'danger', 'link'].includes(style)) throw new Error('Style inválido');
            // store as style string; when publishing we map to ButtonStyle
            arr[idx].style = style;
            buttonStates.set(ownerId, arr);
            break;
        }
        default:
            throw new Error('Ação desconhecida');
    }
}

/* ===========================================================
   MAP style strings to ButtonStyle when publishing
   (helper used in publish flow if needed)
   ===========================================================*/
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

/* ===========================================================
   PREVENIR CRASH GLOBAL (logs úteis em produção)
   ===========================================================*/
process.on('unhandledRejection', err => {
    console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', err => {
    console.error('Uncaught exception:', err);
});

client.login(TOKEN).catch(err => console.error('Erro ao logar o bot:', err));
