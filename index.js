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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= CONFIG ================= //
const TOKEN = "PUT_TOKEN";
const CATEGORY_ID = "PUT_CATEGORY_ID";
const STAFF_ROLE_ID = "PUT_STAFF_ROLE_ID";
const ADMIN_ROLE_ID = "PUT_ADMIN_ROLE_ID";
const PANEL_CHANNEL_ID = "PUT_PANEL_CHANNEL_ID";
const REVIEW_CHANNEL_ID = "PUT_REVIEW_CHANNEL_ID";

// ================= DATA ================= //
const ticketOwners = new Map();
const ticketData = new Map();
const pendingReviews = new Map();

// ================= READY ================= //
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("🎫 نظام التكتات")
    .setDescription("اضغط لفتح تكت")
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("فتح تكت")
      .setStyle(ButtonStyle.Primary)
  );

  channel.send({ embeds: [embed], components: [row] });
});

// ================= INTERACTIONS ================= //
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton()) return;

  const channelId = interaction.channel?.id;

  if (interaction.customId === "open_ticket") {

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

  // 🟢 استلام
  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
  return interaction.reply({
    content: "❌ لا تستطيع استلام التذكرة، أنت لست مسؤول",
    ephemeral: true
  });
} 

    if (interaction.customId === "take") {

  // 🔥 ستاف فقط
  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
    return interaction.reply({
      content: "❌ لا تستطيع استلام التذكرة، أنت لست مسؤول",
      ephemeral: true
    });
  }

  // 🔥 إذا مستلم مسبقًا
  if (ticketOwners.get(channelId)) {
    return interaction.reply({
      content: "❌ التكت مستلم بالفعل",
      ephemeral: true
    });
  }

  ticketOwners.set(channelId, interaction.user.id);
  ticketData.get(channelId).mediator = interaction.user.id;

  interaction.reply(`🟢 تم الاستلام بواسطة ${interaction.user}`);
}
  // ================= 🔥 ADD NEW COMMAND ================= //
  if (interaction.customId === "request_permission") {

  const owner = ticketOwners.get(channelId);

  if (!owner || owner !== interaction.user.id) {
    return interaction.reply({
      content: "❌ فقط مستلم التكت يقدر يطلب إذن",
      ephemeral: true
    });
  }

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

  // 🔥 ستاف فقط
  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
    return interaction.reply({
      content: "❌ لا تستطيع إغلاق التذكرة، أنت لست مسؤول",
      ephemeral: true
    });
  }

  ticketOwners.delete(channelId);
  ticketData.delete(channelId);

  await interaction.reply("🔒 يتم الإغلاق...");
  setTimeout(() => interaction.channel.delete(), 3000);
}
});

// ================= MODAL ================= //
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "review_modal") {

    const rating = interaction.fields.getTextInputValue("rating");
    const items = interaction.fields.getTextInputValue("items");

    const data = pendingReviews.get(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle("⭐ تقييم وسطاء خادم لوست")
      .setColor("Gold")
      .setDescription(
`👤 العميل: <@${data.client}>
🤝 الوسيط: <@${data.mediator}>

⭐ التقييم: ${rating}
📦 الأغراض: ${items}`
      );

    const guild = client.guilds.cache.first();
    const reviewChannel = guild?.channels.cache.get(REVIEW_CHANNEL_ID);

    if (reviewChannel)
      reviewChannel.send({ embeds: [embed] });

    pendingReviews.delete(interaction.user.id);

    interaction.reply({ content: "✅ تم إرسال التقييم", ephemeral: true });
  }
});

// ================= COMMANDS ================= //
client.on("messageCreate", async (message) => {

  if (!message.content.startsWith("$")) return;

  const args = message.content.split(" ");
  const cmd = args[0];
  const channelId = message.channel.id;

  // ================= $تم ================= //
  if (cmd === "$تم") {

    const clientUser = message.mentions.users.first();
    const mediatorUser = message.mentions.users.last();

    if (!clientUser || !mediatorUser)
      return message.reply("❌ استخدم: $تم @العميل @الوسيط");

    pendingReviews.set(clientUser.id, {
      client: clientUser.id,
      mediator: mediatorUser.id
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_review")
        .setLabel("⭐ ابدأ التقييم")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await clientUser.send({
        content: `⭐ اضغط لبدء التقييم`,
        components: [row]
      });
    } catch {}

    message.channel.send("📩 تم إرسال التقييم");
  }

  // ================= $add ================= //
  if (cmd === "$add") {
    const user = message.mentions.users.first();
    if (!user) return;

    message.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true
    });

    message.channel.send(`✅ تم إضافة ${user}`);
  }

  // ================= $rename ================= //
  if (cmd === "$rename") {
    const name = args.slice(1).join("-");

    await message.channel.setName(name);

    message.channel.send(`✅ تم تغيير الاسم الى ${name}`);
  }

  // ================= $تبديل ================= //
  if (cmd === "$تبديل") {
    ticketOwners.set(channelId, null);
    message.channel.send("🔁 تم تفريغ التكت");
  }

  // ================= 🟢 NEW $استلام ================= //
  if (cmd === "$استلام") {

    if (ticketOwners.get(channelId))
      return message.reply("❌ التكت مستلم بالفعل");

    ticketOwners.set(channelId, message.author.id);
    ticketData.get(channelId).mediator = message.author.id;

    message.channel.send(`🟢 تم استلام التكت بواسطة ${message.author}`);
  }

});

client.login(TOKEN);
