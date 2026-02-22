require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  InteractionType,
  PermissionsBitField
} = require("discord.js");

const mongoose = require("mongoose");
const Order = require("./models/Order");
const randomWorker = require("./utils/randomWorker");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

client.once("ready", async () => {
  console.log(`${client.user.tag} is online`);

  const commands = [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Open service panel")
      .toJSON(),

    new SlashCommandBuilder()
      .setName("submit")
      .setDescription("Mark order as completed")
      .addStringOption(option =>
        option
          .setName("orderid")
          .setDescription("Order ID")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
});

client.on("interactionCreate", async interaction => {

  // PANEL COMMAND
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("🛠 Service Panel")
        .setDescription(`
Select a service:

1️⃣ Password Assistance  
2️⃣ Email + Password Assistance  

Payments: LTC | Owo | UPI
`);

      const menu = new StringSelectMenuBuilder()
        .setCustomId("service_select")
        .setPlaceholder("Choose a service")
        .addOptions([
          { label: "Password Help", value: "service1" },
          { label: "Email + Password Help", value: "service2" }
        ]);

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    // WORKER SUBMIT
    if (interaction.commandName === "submit") {

  await interaction.deferReply({ ephemeral: true });

  try {
    const orderId = interaction.options.getString("orderid");

    const order = await Order.findById(orderId);
    if (!order) {
      return interaction.editReply("Order not found.");
    }

    order.status = "completed";
    await order.save();

    const user = await client.users.fetch(order.userId);

    const payBtn = new ButtonBuilder()
      .setCustomId(`pay_${order._id}`)
      .setLabel("Pay Now")
      .setStyle(ButtonStyle.Success);

    await user.send({
      embeds: [new EmbedBuilder().setTitle("Your Service is Ready!")],
      components: [new ActionRowBuilder().addComponents(payBtn)]
    });

    return interaction.editReply("Order marked completed.");

  } catch (err) {
    console.error(err);
    return interaction.editReply("Something went wrong.");
  }
    }

  // SERVICE SELECT → MODAL
  if (interaction.isStringSelectMenu() && interaction.customId === "service_select") {

    const modal = new ModalBuilder()
      .setCustomId(interaction.values[0])
      .setTitle("Service Order Form");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Your Name")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("discordId")
          .setLabel("Discord ID")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("platform")
          .setLabel("Platform")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("issue")
          .setLabel("Describe Your Issue")
          .setStyle(TextInputStyle.Paragraph)
      )
    );

    return interaction.showModal(modal);
  }

  // MODAL SUBMIT → CREATE TICKET
  if (interaction.type === InteractionType.ModalSubmit) {

    const worker = await randomWorker(interaction.guild, process.env.WORKER_ROLE_ID);
    if (!worker) return interaction.reply({ content: "No workers available.", ephemeral: true });

    const order = await Order.create({
      userId: interaction.user.id,
      service: interaction.customId,
      name: interaction.fields.getTextInputValue("name"),
      discordId: interaction.fields.getTextInputValue("discordId"),
      platform: interaction.fields.getTextInputValue("platform"),
      issue: interaction.fields.getTextInputValue("issue"),
      workerId: worker.id
    });

    const channel = await interaction.guild.channels.create({
      name: `order-${order._id}`,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: worker.id, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

  await channel.send({
  content: `<@${worker.id}>`,
  embeds: [
    new EmbedBuilder()
      .setTitle("New Order Assigned")
      .setDescription(
        `🆔 **Order ID:** \`${order._id}\`\n\n` +
        `📦 **Service:** ${order.service}\n` +
        `👤 **User:** <@${order.userId}>`
      )
      .setColor("Green")
  ]
}); 

    return interaction.reply({ content: "Order created successfully!", ephemeral: true });
  }

  // PAYMENT SELECT
  if (interaction.isButton() && interaction.customId.startsWith("pay_")) {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("payment_select")
      .addOptions([
        { label: "LTC", value: "ltc" },
        { label: "Owo", value: "owo" },
        { label: "UPI", value: "upi" }
      ]);

    return interaction.reply({
      content: "Select Payment Method",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "payment_select") {

    let message = "Send payment and wait for confirmation.";

    if (interaction.values[0] === "upi") {
      message = `UPI ID: ${process.env.UPI_ID}\nScan QR or send manually.`;
    }

    if (interaction.values[0] === "ltc") {
      message = `LTC Address:\n${process.env.LTC_ADDRESS}`;
    }

    if (interaction.values[0] === "owo") {
      message = "Use owo send command in payment channel.";
    }

    return interaction.reply({ content: message, ephemeral: true });
  }

});

client.login(process.env.BOT_TOKEN);
