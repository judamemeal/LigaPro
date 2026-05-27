/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  🔍 ANTIRAID — Detector de Interacciones | LigaPro x4      ║
 * ║  Anti-Spam Slash · Anti-Botón · Anti-Exploits              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const {
  isWhitelisted, track, raidLog, autotimeout, autoban,
  cmdTracker, btnTracker, ticketTracker,
  THRESHOLDS, AR_COLORS, raidState, activateLockdown,
} = require('../utils/antiraid');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // Solo actuar sobre interacciones en un servidor
    if (!interaction.guild) return;

    const member = interaction.member;
    const guild  = interaction.guild;

    // Whitelist: no sancionar a admins
    if (isWhitelisted(member, guild)) return;

    // ══════════════════════════════════════════════════
    //  1. COMANDO BLOQUEADO EN LOCKDOWN
    // ══════════════════════════════════════════════════
    if (interaction.isChatInputCommand() && raidState.lockdownActive) {
      const cmdName = interaction.commandName;
      if (raidState.disabledCommands.has(cmdName)) {
        await interaction.reply({
          embeds: [{
            color: AR_COLORS.LOCKDOWN,
            title: '🛑 COMANDO BLOQUEADO — Modo Estadio Seguro',
            description:
              `El comando **/${cmdName}** está temporalmente deshabilitado.\n\n` +
              `🛡️ LigaPro Ecuabet x4 se encuentra en **Modo de Seguridad Máxima**.\n` +
              `Espera a que el sistema regrese a estado normal.`,
            footer: { text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4' },
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        }).catch(() => {});
        return;
      }
    }

    // ══════════════════════════════════════════════════
    //  2. SPAM DE COMANDOS SLASH
    // ══════════════════════════════════════════════════
    if (interaction.isChatInputCommand()) {
      const cmdCount = track(cmdTracker, interaction.user.id, THRESHOLDS.CMD_SPAM_WINDOW);

      if (cmdCount >= THRESHOLDS.CMD_SPAM_COUNT) {
        await interaction.reply({
          embeds: [{
            color: AR_COLORS.WARNING,
            title: '⚠️ COMISIÓN DISCIPLINARIA — Abuso de Comandos',
            description:
              `Estás ejecutando comandos demasiado rápido.\n` +
              `🟨 **Advertencia oficial de LigaPro Security.**\n` +
              `Serás sancionado si continúas con esta conducta.`,
            footer: { text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4' },
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        }).catch(() => {});

        // Timeout si es excesivo
        if (cmdCount >= THRESHOLDS.CMD_SPAM_COUNT * 2) {
          await autotimeout(member, 'Spam masivo de comandos slash', 5 * 60 * 1000);

          await raidLog(guild, {
            title: 'SPAM DE COMANDOS SLASH',
            description:
              `🚨 **VAR DE SEGURIDAD:** Se detectó spam de comandos slash.\n\n` +
              `**${interaction.user.tag}** ejecutó ${cmdCount} comandos en segundos.\n` +
              `🟥 **SANCIÓN:** Timeout de 5 minutos aplicado.`,
            color: AR_COLORS.BAN,
            userId: interaction.user.id,
            fields: [
              { name: '⌨️ Comandos', value: `${cmdCount} en ${THRESHOLDS.CMD_SPAM_WINDOW / 1000}s`, inline: true },
              { name: '👤 Usuario', value: interaction.user.tag, inline: true },
              { name: '🕐 Sanción', value: 'Timeout 5 minutos', inline: true },
            ]
          });
        }
        return;
      }
    }

    // ══════════════════════════════════════════════════
    //  3. SPAM DE BOTONES / ABUSO DE INTERACCIONES
    // ══════════════════════════════════════════════════
    if (interaction.isButton()) {
      const btnCount = track(btnTracker, interaction.user.id, THRESHOLDS.BTN_SPAM_WINDOW);

      if (btnCount >= THRESHOLDS.BTN_SPAM_COUNT) {
        await interaction.reply({
          embeds: [{
            color: AR_COLORS.WARNING,
            title: '⚠️ ABUSO DE BOTONES DETECTADO',
            description:
              `🚨 **Actividad sospechosa detectada en el estadio virtual.**\n` +
              `Estás presionando botones a una velocidad anormal.\n` +
              `🟨 **Advertencia oficial de LigaPro Security.**`,
            footer: { text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4' },
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        }).catch(() => {});

        if (btnCount >= THRESHOLDS.BTN_SPAM_COUNT * 2) {
          await autotimeout(member, 'Abuso masivo de botones e interacciones', 5 * 60 * 1000);

          await raidLog(guild, {
            title: 'ABUSO DE BOTONES / INTERACCIONES',
            description:
              `🚨 **VAR DE SEGURIDAD:** Abuso de interacciones de botones detectado.\n\n` +
              `**${interaction.user.tag}** presionó ${btnCount} botones en segundos.\n` +
              `🛑 **SANCIÓN:** Timeout aplicado.`,
            color: AR_COLORS.WARNING,
            userId: interaction.user.id,
            fields: [
              { name: '🖱️ Botones', value: `${btnCount} en ${THRESHOLDS.BTN_SPAM_WINDOW / 1000}s`, inline: true },
              { name: '👤 Usuario', value: interaction.user.tag, inline: true },
            ]
          });
        }

        return; // Cortar la ejecución del botón
      }
    }

    // ══════════════════════════════════════════════════
    //  4. DETECCIÓN DE CREACIÓN MASIVA DE TICKETS
    // ══════════════════════════════════════════════════
    if (interaction.isButton() && interaction.customId?.startsWith('ticket_')) {
      const ticketCount = track(ticketTracker, interaction.user.id, THRESHOLDS.TICKET_WINDOW);

      if (ticketCount > THRESHOLDS.TICKET_COUNT) {
        await interaction.reply({
          embeds: [{
            color: AR_COLORS.BAN,
            title: '🚫 ABUSO DE TICKETS — LigaPro Security',
            description:
              `🚨 **VAR DE SEGURIDAD:** Se detectó creación masiva de tickets.\n\n` +
              `Estás intentando crear tickets a una velocidad sospechosa.\n` +
              `🟥 **TARJETA ROJA: Usuario bloqueado por actividad maliciosa.**`,
            footer: { text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4' },
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        }).catch(() => {});

        await autotimeout(member, 'Creación masiva de tickets', 30 * 60 * 1000);

        await raidLog(guild, {
          title: 'ABUSO MASIVO DE TICKETS',
          description:
            `🚨 **VAR DE SEGURIDAD:** Creación masiva de tickets detectada.\n\n` +
            `**${interaction.user.tag}** intentó crear ${ticketCount} tickets en poco tiempo.\n` +
            `🟥 **TARJETA ROJA:** Timeout de 30 minutos aplicado.`,
          color: AR_COLORS.BAN,
          userId: interaction.user.id,
          fields: [
            { name: '🎫 Tickets', value: `${ticketCount} intentos`, inline: true },
            { name: '🕐 Sanción', value: 'Timeout 30 minutos', inline: true },
          ]
        });

        return; // Bloquear la creación del ticket
      }
    }
  },
};
