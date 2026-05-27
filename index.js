require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { loadCommands, registerCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

// ── MANEJO GLOBAL DE ERRORES ──
// Evita que el bot se apague completamente por un error no capturado.
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [Global Error] Rechazo de promesa no manejado:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('💥 [Global Error] Excepción no capturada:', error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

(async () => {
  await loadCommands(client);
  await loadEvents(client);
  await registerCommands(client);
  client.login(process.env.TOKEN);
})();
