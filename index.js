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
const TOKEN = process.env.TOKEN;
const CATEGORY_ID = "1490745798391103580";
const STAFF_ROLE_ID = "1490742871374954648";
const ADMIN_ROLE_ID = "1490742893424545952";
const PANEL_CHANNEL_ID = "1490746266261524562";
const REVIEW_CHANNEL_ID = "1490746270145315006";

// ================= DATA ================= //
const ticketOwners = new Map();
const ticketData = new Map();
const pendingReviews = new Map();
const reviewStep = new Map();

// ================= READY ================= //
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const embed = new EmbedBuilder()
  .setTitle("𝑳𝒐𝒔 𝐌𝐞𝐝𝐢𝐚𝐭𝐨𝐫 | الـوسـطاء")
  .setDescription("من أجـل الحـفـاظ عـلـى أمـان التـبـادل وفـرنا لكم خـدمـة الـوسيـط نحن هنا لمساعدتكم و حمايتكم من عمليات النصب و الى غيرها من العمليات الاحتياليه")
  .setColor(0xFFF200)
  .setThumbnail("https://cdn.discordapp.com/attachments/1490745859753644284/1495248904919449651/standard_5.gif?ex=69eec90f&is=69ed778f&hm=aad05a3722f888388eb36c244c0ed4e00d2dc57333a5c6acedd83c4a3bc7efc1") // الصورة الصغيرة
  .setImage("https://cdn.discordapp.com/attachments/1490745859753644284/1491130300221231384/standard_10.gif?ex=69eef68f&is=69eda50f&hm=c2ae5a559372e910eac64bd1979c607aba0b2ba4c5dd9553b2c1aceac81ff6b9");     // الصورة الكبيرة

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("𝐌𝐞𝐝𝐢𝐚𝐭𝐨𝐫")
          .setEmoji("⚖️")
      .setStyle(ButtonStyle.Secondary)
  );

  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);

if (messages) {
  const alreadySent = messages.find(
    (m) =>
      m.author.id === client.user.id &&
      m.components.length > 0
  );

  if (alreadySent) return;

  await channel.send({ embeds: [embed], components: [row] });
}
});

// ================= INTERACTIONS ================= //
client.on("interactionCreate", async (interaction) => {

if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  const channelId = interaction.channel?.id;

  // 🔐 حماية: فقط الستاف للأزرار
  const isStaff = interaction.member?.roles?.cache?.has(STAFF_ROLE_ID) || false;

// ================= OPEN ================= //
if (interaction.customId === "open_ticket") {

  const modal = new ModalBuilder()
    .setCustomId("ticket_modal")
    .setTitle("فتح تكت");

  const otherId = new TextInputBuilder()
    .setCustomId("other_id")
    .setLabel("ايدي الطرف الآخر (اختياري)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const row = new ActionRowBuilder().addComponents(otherId);

  modal.addComponents(row);

  return interaction.showModal(modal);
}

// ================= TICKET MODAL SUBMIT ================= //
if (interaction.isModalSubmit() && interaction.customId === "ticket_modal") {

  const otherId = interaction.fields.getTextInputValue("other_id");

const hasTicket = [...ticketData.values()].some(t => t.client === interaction.user.id);

if (hasTicket) {
  return interaction.reply({
    content:
`❌ عندك تكت مفتوح بالفعل يجب قفل التكت المفتوح لفتح تكت اخر.

💡 اذا كنت تواجه مشكلة توجه الى <#1490746262834905178> واطلب الدعم الفني سوف يتم حل مشكلتك`,
    ephemeral: true
  });
}
  const permissions = [
    {
      id: interaction.guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages
      ]
    },
    {
      id: STAFF_ROLE_ID,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages
      ]
    }
  ];

  // إذا كتب آيدي الطرف الآخر
  if (otherId) {
  const user = await interaction.guild.members.fetch(otherId).catch(() => null);

  if (user) {
    permissions.push({
      id: user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages
      ]
    });
  }
}

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID,
    permissionOverwrites: permissions
  });

  ticketOwners.set(channel.id, null);

  ticketData.set(channel.id, {
    client: interaction.user.id,
    mediator: null
  });

  const ticketRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("take")
      .setLabel("استلام")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("request_permission")
      .setLabel("طلب إذن")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("close")
      .setLabel("اغلاق")
      .setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
  .setColor(0xFFF200)
  .setTitle("𝐒𝐞𝐫𝐯𝐢𝐜𝐞 𝐌𝐞𝐝𝐢𝐚𝐭𝐨𝐫 | خدمة الوسطاء")
  .setDescription("مرحبًا بك في نظام التكت، الرجاء ارسال ايدي الطرف الاخر او اليوزر و تحديد التبادل شكرا لكم لاستخدام خدمه وسطاء لوس.")
  .setThumbnail("https://cdn.discordapp.com/attachments/1490745859753644284/1495248904919449651/standard_5.gif?ex=69ef71cf&is=69ee204f&hm=582544b51211e2b4833543a4ee8df0faff68565e93169203074fb799c655f6b2")
  .setImage("https://cdn.discordapp.com/attachments/1490745859753644284/1491130300221231384/standard_10.gif?ex=69eef68f&is=69eda50f&hm=c2ae5a559372e910eac64bd1979c607aba0b2ba4c5dd9553b2c1aceac81ff6b9");

  await channel.send({
    content: `||<@&${STAFF_ROLE_ID}> ${interaction.user}${otherId ? ` <@${otherId}>` : ""}||`,
    embeds: [embed],
    components: [ticketRow]
  });

  return interaction.reply({
    content: `✅ تم فتح التكت ${channel}`,
    ephemeral: true
  });
}    
  // ================= TAKE ================= //
  if (interaction.customId === "take") {

  if (!isStaff)
    return interaction.reply({ content: "❌ لا يمكنك استخدام أزرار الوسطاء", ephemeral: true });

  if (ticketOwners.get(channelId))
    return interaction.reply({ content: "❌ التكت مستلم", ephemeral: true });

  const data = ticketData.get(channelId);

  // 🚫 منع الستاف من استلام تكت فتحه بنفسه
  if (data?.client === interaction.user.id) {
    return interaction.reply({
      content: "❌ لا يمكنك استلام التكت الذي قمت بفتحه بنفسك",
      ephemeral: true
    });
  }

  const channel = interaction.channel;

  ticketOwners.set(channelId, interaction.user.id);

  if (!data) {
    ticketData.set(channelId, {
      client: null,
      mediator: interaction.user.id
    });
  } else {
    data.mediator = interaction.user.id;
    ticketData.set(channelId, data);
  }

  await channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
    ViewChannel: true,
    SendMessages: false
  }).catch(() => {});

  await channel.permissionOverwrites.edit(ADMIN_ROLE_ID, {
    ViewChannel: true,
    SendMessages: true
  }).catch(() => {});

  return interaction.reply(`🟢 تم الاستلام بواسطة ${interaction.user}`);
}

  // ================= REQUEST ================= //
  if (interaction.customId === "request_permission") {

    if (!isStaff)
      return interaction.reply({ content: "❌ لا يمكنك استخدام أزرار الوسطاء", ephemeral: true });

    const owner = ticketOwners.get(channelId);

    if (owner !== interaction.user.id)
      return interaction.reply({ content: "❌ فقط المستلم", ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("قبول").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject_${interaction.user.id}`).setLabel("رفض").setStyle(ButtonStyle.Danger)
    );

    interaction.reply({
      content: `<@&${ADMIN_ROLE_ID}> طلب إذن`,
      components: [row]
    });
  }

  // ================= ACCEPT ================= //
  if (interaction.customId.startsWith("accept_")) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
      return interaction.reply({ content: "المراقبين فقط يستطيعون رفض و قبول الاذن", ephemeral: true });

    const userId = interaction.customId.split("_")[1];

    interaction.update({ content: "✅ تم القبول", components: [] });
    interaction.channel.send(`🟢 <@${userId}> تم قبول طلبك`);
  }

  // ================= REJECT ================= //
  if (interaction.customId.startsWith("reject_")) {

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
      return interaction.reply({ content: "المراقبين فقط يستطيعون رفض و قبول الاذن", ephemeral: true});

    const userId = interaction.customId.split("_")[1];

    interaction.update({ content: "❌ تم الرفض", components: [] });
    interaction.channel.send(`🔴 <@${userId}> تم الرفض`);
  }

  // ================= CLOSE ================= //
  if (interaction.customId === "close") {

    if (!isStaff)
      return interaction.reply({ content: "❌ لا يمكنك استخدام أزرار الوسطاء", ephemeral: true });

    ticketOwners.delete(channelId);
    ticketData.delete(channelId);

    await interaction.reply("🔒 يتم الإغلاق...");
    setTimeout(() => interaction.channel.delete(), 3000);
  }
});

// ================= REVIEW DM SYSTEM ================= //
client.on("interactionCreate", async (interaction) => {

  // ================= زر فتح الفورم ================= //
  if (interaction.isButton() && interaction.customId === "review_form") {

    const modal = new ModalBuilder()
      .setCustomId("review_modal")
      .setTitle("⭐ نموذج التقييم");

    const rating = new TextInputBuilder()
      .setCustomId("rating")
      .setLabel("التقييم")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const items = new TextInputBuilder()
      .setCustomId("items")
      .setLabel("الأغراض التي تم توسطها")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(rating);
    const row2 = new ActionRowBuilder().addComponents(items);

    modal.addComponents(row1, row2);

    return interaction.showModal(modal);
  }

  // ================= استقبال الفورم ================= //
  if (interaction.isModalSubmit() && interaction.customId === "review_modal") {

    const rating = interaction.fields.getTextInputValue("rating");
    const items = interaction.fields.getTextInputValue("items");

    const guild = client.guilds.cache.first();
const reviewChannel = guild?.channels?.cache?.get(REVIEW_CHANNEL_ID);

    if (reviewChannel) {

      await reviewChannel.send(
`**تقييم وسطاء خادم Lost**

\`-\` **العميل :** <@${interaction.user.id}>
\`-\` **الوسيط :** <@${pendingReviews.get(interaction.user.id)?.mediator || "غير معروف"}>
\`-\` **التقييم :** ${rating}
\`-\` **الأغراض التي تم توسطها :** ${items}`
);

      await reviewChannel.send(
        "https://cdn.discordapp.com/attachments/1490745859753644284/1491130300221231384/standard_10.gif"
      );
    }

    return interaction.reply({
      content: "✅ تم إرسال تقييمك",
      ephemeral: true
    });
  }

});
// ================= COMMANDS ================= //
client.on("messageCreate", async (message) => {

  if (!message.content.startsWith("$")) return;

  const args = message.content.split(" ");
  const cmd = args[0];

  const member = message.member;


const isStaff = member?.roles?.cache?.has(STAFF_ROLE_ID);
const isAdmin = member?.roles?.cache?.has(ADMIN_ROLE_ID);
const hasPerm = isStaff || isAdmin;

// 🚫 الأوامر المسموحة
const allowedCommands = ["$تم", "$add", "$rename", "$تبديل", "$استلام"];

// 🚫 لازم يكون داخل تكت
const isTicketChannel = ticketOwners.has(message.channel.id);

if (allowedCommands.includes(cmd)) {

  // ❌ منع خارج التكت
  if (!isTicketChannel) {
    return message.reply({
      content: "❌ الأوامر هذه مسموحة فقط داخل التكت",
      allowedMentions: { repliedUser: false }
    }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
  }

  // ❌ منع غير الصلاحيات
  if (!hasPerm) {
    return message.reply({
      content: "❌ هذا الأمر مخصص للستاف والإدمن فقط",
      allowedMentions: { repliedUser: false }
    }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
  }
}
  const channelId = message.channel.id;
const owner = ticketOwners.get(channelId);

// إذا التكت مستلم + الشخص مو هو المستلم => ممنوع كل الأوامر
if (owner && owner !== message.author.id) {
  return message.reply("❌ هذا التكت مستلم من شخص آخر ولا يمكنك استخدام الأوامر فيه");
}

  // ================= $تم ================= //
if (cmd === "$تم") {

  const clientUser = message.mentions.users.first();
  const mediatorUser = message.mentions.users.at(1);

  if (!clientUser || !mediatorUser)
    return message.reply("❌ استخدم: $تم @العميل1 @العميل2");

  // 🚫 منع نفس الشخص يكون عميل ووسيط
  if (clientUser.id === mediatorUser.id)
    return message.reply("❌ ما تقدر تخلي العميل نفسه وسيط");

  pendingReviews.set(clientUser.id, {
    client: clientUser.id,
    mediator: mediatorUser.id
  });

  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("review_form")
        .setLabel("⭐ فتح نموذج التقييم")
        .setStyle(ButtonStyle.Primary)
    );

    await clientUser.send({
      content: "📩 تم استلام نموذج التقييم من وسطاء Lost\n\nاضغط الزر لتعبئة التقييم:",
      components: [row]
    });

  } catch (err) {
    console.log("DM failed:", err);
  }

  message.channel.send("📩 تم إرسال رسالة التقييم للعميل");
}

  // ================= $add ================= //
  if (cmd === "$add") {
    const user = message.mentions.users.first();
    if (!user) return;

    await message.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true
    });

    message.channel.send(`✅ تم إضافة ${user}`);
  }

  // ================= $rename ================= //
  if (cmd === "$rename") {
    const name = args.slice(1).join("-");

if (!name)
  return message.reply("❌ اكتب اسم جديد");

    await message.channel.setName(name);

    message.channel.send(`✅ تم تغيير الاسم الى ${name}`);
  }

  // ================= $تبديل ================= //
  if (cmd === "$تبديل") {
    
  const owner = ticketOwners.get(channelId);

  if (!owner)
    return message.reply("❌ هذه التذكرة غير مستلمة بالفعل");


  ticketOwners.set(channelId, null);

  message.channel.send(
  `🔁 تم ترك التكت بواسطة <@${owner || "غير معروف"}>
👮 يستطيع أي وسيط استلامها الآن <@&${STAFF_ROLE_ID}>`
  );
}

  // ================= $استلام ================= //
  if (cmd === "$استلام") {

  if (ticketOwners.get(channelId))
    return message.reply("❌ التكت مستلم بالفعل");

  ticketOwners.set(channelId, message.author.id);

  
  if (!ticketData.has(channelId)) {
  ticketData.set(channelId, { client: null, mediator: null });
}

ticketData.get(channelId).mediator = message.author.id;

  message.channel.send(`🟢 تم استلام التكت بواسطة ${message.author}`);
}
});

client.login(TOKEN);
