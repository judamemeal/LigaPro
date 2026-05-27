const { ADMIN_ROLES } = require('../config');
const ficharCmd = require('../commands/fichar');
const { raidState, isWhitelisted, cmdTracker, btnTracker, track, THRESHOLDS, AR_COLORS } = require('../utils/antiraid');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── GUARD ANTIRAID (pre-procesamiento) ─────────────────────
    if (interaction.guild && interaction.member) {
      const member = interaction.member;
      const guild  = interaction.guild;
      const whitelisted = isWhitelisted(member, guild);

      if (!whitelisted) {
        // Bloquear comandos peligrosos en lockdown
        if (raidState.lockdownActive && interaction.isChatInputCommand()) {
          if (raidState.disabledCommands.has(interaction.commandName)) {
            await interaction.reply({
              embeds: [{
                color: AR_COLORS.LOCKDOWN,
                title: '🛑 COMANDO BLOQUEADO — Modo Estadio Seguro',
                description:
                  `El comando **/${interaction.commandName}** está temporalmente deshabilitado.\n\n` +
                  `🛡️ **LigaPro Ecuabet x4** se encuentra en Modo de Seguridad Máxima.`,
                footer: { text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4' },
                timestamp: new Date().toISOString(),
              }],
              ephemeral: true,
            }).catch(() => {});
            return;
          }
        }

        // Throttle: spam de comandos (respuesta rápida, el castigo está en antiraidInteractionCreate)
        if (interaction.isChatInputCommand()) {
          const count = track(cmdTracker, interaction.user.id, THRESHOLDS.CMD_SPAM_WINDOW);
          if (count > THRESHOLDS.CMD_SPAM_COUNT) return; // silenciar si ya fue advertido
        }

        // Throttle: spam de botones
        if (interaction.isButton()) {
          const count = track(btnTracker, interaction.user.id, THRESHOLDS.BTN_SPAM_WINDOW);
          if (count > THRESHOLDS.BTN_SPAM_COUNT * 2) return; // silenciar completamente si es abusivo
        }
      }
    }

    // ── SLASH COMMANDS ──────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`[CMD ERROR] /${interaction.commandName}:`, error);
        const msg = { content: '❌ Ocurrió un error al ejecutar este comando.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
      return;
    }

    // ── BOTONES ─────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (!id) return;

      try {
        if (id.startsWith('fichar_aceptar_')) {
          await ficharCmd.handleAceptar(interaction);
          return;
        }
        if (id.startsWith('fichar_rechazar_')) {
          await ficharCmd.handleRechazar(interaction);
          return;
        }
        // Tickets y demás botones
        const ticketHandler = require('./ticketButtons');
        await ticketHandler.execute(interaction, client);

      } catch (error) {
        console.error(`[BUTTON ERROR] ${id}:`, error);
        const msg = { content: '❌ Ocurrió un error al procesar este botón.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }
  }
};