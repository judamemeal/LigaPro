const { EmbedBuilder } = require('discord.js');
const { LOGS_CHANNEL_ID, SANCTIONS_CHANNEL_ID, COLORS } = require('../config');

/**
 * Función universal para enviar logs a uno o varios canales
 * @param {import('discord.js').Guild} guild El servidor (guild) de Discord
 * @param {Object} options Opciones del log
 * @param {string} options.title Título del embed
 * @param {string} options.description Descripción detallada
 * @param {number} [options.color] Color del embed (por defecto INFO)
 * @param {Array<{name: string, value: string, inline?: boolean}>} [options.fields] Campos extra
 * @param {string} [options.thumbnail] URL para el thumbnail
 * @param {boolean} [options.sendToSanctions] Si true, también envía al canal de sanciones público
 * @param {string} [options.sanctionsTitle] Título alternativo para el canal de sanciones
 * @param {string} [options.sanctionsDescription] Descripción alternativa para el canal de sanciones
 */
async function sendLog(guild, {
  title,
  description,
  color = COLORS.INFO,
  fields = [],
  thumbnail = null,
  sendToSanctions = false,
  sanctionsTitle = null,
  sanctionsDescription = null,
}) {
  try {
    if (!guild) return;

    const embed = new EmbedBuilder()
      .setTitle(`📋 Log: ${title}`)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: 'Sistema de Moderación y Logs • LigaPro Ecuabet', iconURL: guild.iconURL() || undefined });

    if (fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);

    // ── Canal de logs privado ─────────────────────────────────────
    const logsChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
    if (!logsChannel) {
      console.error(`[LOGGER] No se encontró el canal de logs con ID: ${LOGS_CHANNEL_ID}`);
    } else {
      await logsChannel.send({ embeds: [embed] });
    }

    // ── Canal de sanciones público (opcional) ─────────────────────
    if (sendToSanctions) {
      const sanctionsChannel = guild.channels.cache.get(SANCTIONS_CHANNEL_ID);
      if (!sanctionsChannel) {
        console.error(`[LOGGER] No se encontró el canal de sanciones con ID: ${SANCTIONS_CHANNEL_ID}`);
      } else {
        const sanctionEmbed = new EmbedBuilder()
          .setTitle(sanctionsTitle || `⚖️ ${title}`)
          .setDescription(sanctionsDescription || description)
          .setColor(color)
          .setTimestamp()
          .setFooter({ text: 'Registro Público de Sanciones • LigaPro Ecuabet', iconURL: guild.iconURL() || undefined });

        if (fields.length > 0) sanctionEmbed.addFields(fields);
        if (thumbnail) sanctionEmbed.setThumbnail(thumbnail);

        await sanctionsChannel.send({ embeds: [sanctionEmbed] });
      }
    }
  } catch (error) {
    console.error('[LOGGER] Error al enviar log:', error);
  }
}

module.exports = { sendLog };
