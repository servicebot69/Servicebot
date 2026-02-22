require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the service panel"),

  new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Mark an order as completed")
    .addStringOption(option =>
      option.setName("orderid")
        .setDescription("Order ID")
        .setRequired(true)
    )

].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Slash commands registered successfully!");
  } catch (error) {
    console.error(error);
  }
})();
