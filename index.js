const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");
const PDFDocument = require("pdfkit");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= CONFIG ================= //
const TOKEN = process.env.TOKEN;
const CATEGORY_ID = "1490745798391103580";
const STAFF_ROLE_ID = "1490742871374954648";
const ADMIN_ROLE_ID = "1490742893424545952";
const PANEL_CHANNEL_ID = "1490746266261524562";
const REVIEW_CHANNEL_ID = "1490746270145315006";
const TRANSCRIPT_CHANNEL_ID = "1490746163689947136"; // 🔥 ADDED

// ================= DATA ================= //
const ticketOwners = new Map();
const ticketData = new Map();
const pendingReviews = new Map();
const transcriptCache = new Map(); // 🔥 ADDED

// ================= MESSAGE LOGGER ================= //
client.on("messageCreate", async (message) => {
  if (!message.guild) return;

  const channelId = message.channel.id;

  if (!transcriptCache.has(channelId)) {
    transcriptCache.set(channelId, []);
  }

  transcriptCache.get(channelId).push({
    user: message.author.tag,
    content: message.content,
    time: new Date().toLocaleString()
  });
});

// ================= READY ================= //
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("𝑳𝒐𝒔 𝐌𝐞𝐝𝐢𝐚𝐭𝐨𝐫 | الـوسـطاء")
    .setDescription("اضغط على الزر في الادنى لطلب وسيط")
    .setColor("#FFF44F");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("𝐌𝐞𝐝𝐢𝐚𝐭𝐨𝐫")
         .setEmoji("1492925097684500530")
      .setStyle(ButtonStyle.Primary)
  );

  channel.send({ embeds: [embed], components: [row] });
});

// ================= INTERACTIONS ================= //
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton()) return;

  const channelId = interaction.channel?.id;

  // 🔥 منع فتح أكثر من تكت
  if (interaction.customId === "open_ticket") {

    const existingTicket = [...ticketData.entries()].find(
      t => t[1].client === interaction.user.id
    );

    if (existingTicket) {
      return interaction.reply({
        content: `❌ لديك تذكرة مفتوحة بالفعل <#${existingTicket[0]}>`,
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    ticketOwners.set(channel.id, null);
    ticketData.set(channel.id, {
      client: interaction.user.id,
      mediator: null
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("take").setLabel("استلام").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("request_permission").setLabel("طلب إذن").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("close").setLabel("اغلاق").setStyle(ButtonStyle.Danger)
    );

    channel.send({
      content: `<@&${STAFF_ROLE_ID}> | ${interaction.user}`,
      components: [row]
    });

    interaction.reply({ content: `تم فتح التكت ${channel}`, ephemeral: true });
  }

  if (interaction.customId === "take") {

    if (ticketOwners.get(channelId))
      return interaction.reply({ content: "❌ التكت مستلم", ephemeral: true });

    ticketOwners.set(channelId, interaction.user.id);
    ticketData.get(channelId).mediator = interaction.user.id;

    interaction.reply(`🟢 تم الاستلام بواسطة ${interaction.user}`);
  }

  if (interaction.customId === "request_permission") {

    const owner = ticketOwners.get(channelId);

    if (owner !== interaction.user.id && !interaction.member.roles.cache.has(ADMIN_ROLE_ID))
      return interaction.reply({ content: "❌ فقط المستلم", ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${interaction.user.id}`)
        .setLabel("قبول")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${interaction.user.id}`)
        .setLabel("رفض")
        .setStyle(ButtonStyle.Danger)
    );

    interaction.reply({
      content: `<@&${ADMIN_ROLE_ID}> طلب إذن`,
      components: [row]
    });
  }

  if (interaction.customId.startsWith("accept_")) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
      return interaction.reply({ content: "❌ للأدمن فقط", ephemeral: true });

    const userId = interaction.customId.split("_")[1];

    interaction.update({ content: "✅ تم القبول", components: [] });

    interaction.channel.send(`🟢 <@${userId}> تم قبول طلبك`);
  }

  if (interaction.customId.startsWith("reject_")) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
      return interaction.reply({ content: "❌ للأدمن فقط", ephemeral: true });

    const userId = interaction.customId.split("_")[1];

    interaction.update({ content: "❌ تم الرفض", components: [] });

    interaction.channel.send(`🔴 <@${userId}> تم الرفض`);
  }

  if (interaction.customId === "close") {

    ticketOwners.delete(channelId);
    ticketData.delete(channelId);

    await interaction.reply("🔒 يتم الإغلاق...");
    setTimeout(() => interaction.channel.delete(), 3000);
  }
});

// ================= COMMANDS ================= //
client.on("messageCreate", async (message) => {

  if (!message.content.startsWith("$")) return;

  const args = message.content.split(" ");
  const cmd = args[0];
  const channelId = message.channel.id;

  // ================= منع تكت ثاني ================= //
  if (cmd === "$ticket" || cmd === "$open") {

    const existingTicket = [...ticketData.entries()].find(
      t => t[1].client === message.author.id
    );

    if (existingTicket) {
      return message.reply(`❌ لديك تذكرة مفتوحة بالفعل <#${existingTicket[0]}>`);
    }
  }

  // ================= $trans ================= //
  if (cmd === "$trans") {

    const messages = transcriptCache.get(channelId) || [];

    const doc = new PDFDocument();
    const fileName = `transcript-${channelId}.pdf`;

    doc.pipe(fs.createWriteStream(fileName));

    doc.fontSize(18).text("Ticket Transcript", { align: "center" });
    doc.moveDown();

    messages.forEach(m => {
      doc.fontSize(10).text(`[${m.time}] ${m.user}: ${m.content}`);
    });

    doc.end();

    setTimeout(() => {

      const guild = message.guild;
      const transcriptChannel = guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

      if (transcriptChannel) {
        transcriptChannel.send({
          content: `📄 ترانسكربت التكت: ${message.channel.name}`,
          files: [fileName]
        });
      }

      message.channel.send("✅ تم إرسال الترانسكربت");

      transcriptCache.delete(channelId);

    }, 2000);
  }

});

client.login(TOKEN);
