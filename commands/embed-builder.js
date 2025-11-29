const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    EmbedBuilder
} = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Estados
const embedStates = new Map();
const buttonStates = new Map();
const awaitingInput = new Map();

// Corrige URLs inválidas
function normalizeURL(input) {
    let url = input.trim();

    if (url.startsWith("sandbox:/")) url = url.replace("sandbox:", "");

    if (url.startsWith("/mnt/data/")) return url;

    if (/^https?:\/\//.test(url)) return url;

    return null;
}

// Constrói embed seguro
function buildSafeEmbed(data) {
    const e = new EmbedBuilder();

    if (data.title) e.setTitle(data.title);
    if (data.description) e.setDescription(data.description);
    if (data.color) e.setColor(data.color);
    if (data.image) e.setImage(data.image);
    if (data.thumbnail) e.setThumbnail(data.thumbnail);
    if (data.footer?.text) e.setFooter({ text: data.footer.text });
    if (data.timestamp) e.setTimestamp();

    return e;
}

function createMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("embed_menu")
            .setPlaceholder("Escolha o que editar")
            .addOptions([
                { label: "Editar Título", value: "edit_title" },
                { label: "Editar Descrição", value: "edit_description" },
                { label: "Editar Cor", value: "edit_color" },
                { label: "Editar Imagem", value: "edit_image" },
                { label: "Editar Thumbnail", value: "edit_thumbnail" },
                { label: "Editar Footer", value: "edit_footer" },

                { label: "Adicionar Botão", value: "add_button" },
                { label: "Remover Botão", value: "remove_button" },

                { label: "Ativar/Desativar Timestamp", value: "toggle_timestamp" },

                { label: "Exportar JSON", value: "export_json" },
                { label: "Importar JSON", value: "import_json" },
            ])
    );
}

function createButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("finish_embed")
            .setLabel("Finalizar")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("cancel_embed")
            .setLabel("Cancelar")
            .setStyle(ButtonStyle.Danger)
    );
}

// Comando principal
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "embed-builder") return;

    const userId = interaction.user.id;

    embedStates.set(userId, { title: null, description: null, color: null, footer: { text: null } });
    buttonStates.set(userId, []);

    await interaction.reply({
        content: "✨ **Novo Embed em Construção**\nUse o menu abaixo para editar.",
        embeds: [new EmbedBuilder().setDescription("Use o menu para configurar o embed.")],
        components: [createMenu(), createButtons()],
        ephemeral: true
    });
});

// MENU DE EDIÇÃO
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== "embed_menu") return;

    const userId = interaction.user.id;
    const action = interaction.values[0];
    const embed = embedStates.get(userId);
    const buttons = buttonStates.get(userId);

    // Remover botão
    if (action === "remove_button") {
        if (!buttons.length) {
            return interaction.reply({
                content: "⚠ Não existem botões para remover.",
                ephemeral: true
            });
        }

        const selector = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("remove_button_select")
                .setPlaceholder("Selecione o botão para remover")
                .addOptions(
                    buttons.map((btn, i) => ({
                        label: `${i + 1} — ${btn.label}`,
                        value: String(i)
                    }))
                )
        );

        return interaction.update({
            content: "Selecione o botão que deseja remover:",
            embeds: [buildSafeEmbed(embed)],
            components: [selector, createButtons()]
        });
    }

    // Adicionar botão
    if (action === "add_button") {
        awaitingInput.set(userId, "add_button");

        return interaction.update({
            content: "Digite o **texto** do botão:",
            embeds: [buildSafeEmbed(embed)],
            components: []
        });
    }

    // Exportar JSON
    if (action === "export_json") {
        return interaction.reply({
            content: "```json\n" + JSON.stringify({ embed, buttons }, null, 2) + "\n```",
            ephemeral: true
        });
    }

    // Importar JSON
    if (action === "import_json") {
        awaitingInput.set(userId, "import_json");

        return interaction.update({
            content: "Envie o JSON para importar:",
            embeds: [],
            components: []
        });
    }

    // Edição normal
    awaitingInput.set(userId, action);

    return interaction.update({
        content: `Digite o novo valor para **${action.replace("edit_", "")}**:`,
        embeds: [buildSafeEmbed(embed)],
        components: []
    });
});

// Selecionar botão para remover
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "remove_button_select") return;

    const userId = interaction.user.id;
    const index = Number(interaction.values[0]);

    const buttons = buttonStates.get(userId);
    const embed = embedStates.get(userId);

    buttons.splice(index, 1);

    return interaction.update({
        content: "Botão removido!",
        embeds: [buildSafeEmbed(embed)],
        components: [createMenu(), createButtons()]
    });
});

// INPUT de texto
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const action = awaitingInput.get(userId);
    if (!action) return;

    const embed = embedStates.get(userId);
    const buttons = buttonStates.get(userId);

    // Import JSON
    if (action === "import_json") {
        try {
            const data = JSON.parse(message.content);

            embedStates.set(userId, data.embed || {});
            buttonStates.set(userId, data.buttons || []);

            awaitingInput.delete(userId);

            return message.reply({
                content: "JSON importado com sucesso!",
                embeds: [buildSafeEmbed(data.embed)],
                components: [createMenu(), createButtons()]
            });
        } catch {
            return message.reply("⚠ JSON inválido.");
        }
    }

    // ADD BUTTON
    if (action === "add_button") {
        buttons.push({
            label: message.content,
            style: ButtonStyle.Primary,
            customId: "btn_" + Date.now()
        });

        awaitingInput.delete(userId);

        return message.reply({
            content: "Botão adicionado!",
            embeds: [buildSafeEmbed(embed)],
            components: [createMenu(), createButtons()]
        });
    }

    // PATCH de URL
    if (action === "edit_image" || action === "edit_thumbnail") {
        const clean = normalizeURL(message.content);

        if (!clean)
            return message.reply("⚠ **URL inválida.** Use:\n• http(s)://...\n• /mnt/data/arquivo.png\n• sandbox:/mnt/data/arquivo.png");

        if (action === "edit_image") embed.image = clean;
        if (action === "edit_thumbnail") embed.thumbnail = clean;
    } else {
        // Outros campos
        if (action === "edit_title") embed.title = message.content;
        if (action === "edit_description") embed.description = message.content;
        if (action === "edit_color") embed.color = message.content;
        if (action === "edit_footer") embed.footer = { text: message.content };
    }

    awaitingInput.delete(userId);

    return message.reply({
        content: "Atualizado!",
        embeds: [buildSafeEmbed(embed)],
        components: [createMenu(), createButtons()]
    });
});

// Login
client.login(process.env.TOKEN);
