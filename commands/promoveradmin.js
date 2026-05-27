'use strict';

/**
 * /promoveradmin — Promociona a un usuario a Administrador mediante confirmación con botones.
 * Solo admins pueden ejecutarlo. Solo TARGET_ADMIN_USER_ID puede aceptar/rechazar.
 *
 * discord.js v14 — Producción estable
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ComponentType,
} = require('discord.js');

const { isAdmin, noPermReply }                          = require('./utils');
const { COLORS, LOGS_CHANNEL_ID,
        TARGET_ADMIN_USER_ID, PROMOTABLE_ADMIN_ROLE_ID } = require('../config');
const { sendLog }                                        = require('../utils/logger');

/** Tiempo máximo de espera para que el usuario responda (10 min) */
const TIMEOUT_MS = 10 * 60 * 1_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye el ActionRow con los botones de aceptar/rechazar.
 * Se crea siempre de cero para no mutar builders existentes.
 * @param {boolean} disabled — si true, deshabilita ambos botones
 */
function buildRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('promover_admin_si')
      .setLabel('✅  Sí, acepto')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('promover_admin_no')
      .setLabel('❌  No, rechazo')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

/**
 * Genera el embed principal de solicitud.
 * @param {import('discord.js').GuildMember} targetMember
 * @param {import('discord.js').Role}         adminRole
 * @param {import('discord.js').User}         requestedBy
 * @param {import('discord.js').Guild}        guild
 */
function buildSolicitudEmbed(targetMember, adminRole, requestedBy, guild) {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('🛡️ Solicitud de Permisos de Administrador')
    .setDescription(
      `${targetMember}, el administrador **${requestedBy.tag}** te está ofreciendo ` +
      `el rol **${adminRole.name}** con permisos de Administrador en este servidor.\n\n` +
      `⚠️ **Solo tú puedes responder a este mensaje.**\n` +
      `Esta solicitud expira en **10 minutos**.`
    )
    .addFields(
      { name: '👤 Usuario',        value: `${targetMember} (\`${TARGET_ADMIN_USER_ID}\`)`, inline: true },
      { name: '🎭 Rol a otorgar',  value: `${adminRole}`,                                  inline: true },
      { name: '📨 Solicitado por', value: `${requestedBy}`,                                inline: true },
    )
    .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()
    .setFooter({
      text: 'Esta acción es irreversible una vez aceptada • LigaPro Ecuabet',
      iconURL: guild.iconURL() ?? undefined,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Comando
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promoveradmin')
    .setDescription('Envía una solicitud de permisos de Administrador al usuario designado (solo admins)'),

  async execute(interaction) {
    // ── 1. Verificar que quien ejecuta es admin ──────────────────────────────
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const { guild, user: executor } = interaction;

    // Diferir la respuesta ephemeral para que no expire mientras hacemos fetches
    await interaction.deferReply({ ephemeral: true });

    // ── 2. Verificar permisos del bot ────────────────────────────────────────
    const me = await guild.members.fetchMe();

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply({ content: '❌ El bot no tiene el permiso **Gestionar roles** necesario para esta acción.' });
    }
    if (!me.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({ content: '❌ El bot necesita el permiso **Administrador** para modificar roles de esa categoría.' });
    }

    // ── 3. Obtener canal de logs ─────────────────────────────────────────────
    let logsChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);

    // Si no está en caché, intentar fetchearlo
    if (!logsChannel) {
      logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
    }
    if (!logsChannel) {
      return interaction.editReply({ content: `❌ No se encontró el canal de logs (\`${LOGS_CHANNEL_ID}\`).` });
    }
    if (!logsChannel.isTextBased()) {
      return interaction.editReply({ content: '❌ El canal de logs no es un canal de texto.' });
    }

    // ── 4. Obtener miembro objetivo ──────────────────────────────────────────
    let targetMember = guild.members.cache.get(TARGET_ADMIN_USER_ID);
    if (!targetMember) {
      targetMember = await guild.members.fetch(TARGET_ADMIN_USER_ID).catch(() => null);
    }
    if (!targetMember) {
      return interaction.editReply({
        content: `❌ No se encontró al usuario \`${TARGET_ADMIN_USER_ID}\` en el servidor. ¿Sigue siendo miembro?`,
      });
    }

    // ── 5. Obtener el rol Administrador ──────────────────────────────────────
    let adminRole = guild.roles.cache.get(PROMOTABLE_ADMIN_ROLE_ID);
    if (!adminRole) {
      adminRole = await guild.roles.fetch(PROMOTABLE_ADMIN_ROLE_ID).catch(() => null);
    }
    if (!adminRole) {
      return interaction.editReply({ content: `❌ No se encontró el rol \`${PROMOTABLE_ADMIN_ROLE_ID}\`.` });
    }

    // ── 6. Verificar jerarquía: el rol del bot debe estar por encima ─────────
    if (adminRole.position >= me.roles.highest.position) {
      return interaction.editReply({
        content: `❌ No puedo modificar el rol **${adminRole.name}** porque está en la misma posición o por encima del rol más alto del bot en la jerarquía.\n` +
                 `Sube el rol del bot por encima del rol **${adminRole.name}** en la configuración del servidor.`,
      });
    }

    // ── 7. Verificar que el rol no esté gestionado por una integración ───────
    if (adminRole.managed) {
      return interaction.editReply({
        content: `❌ El rol **${adminRole.name}** está gestionado por una integración externa (bot/OAuth2) y no puede ser modificado manualmente.`,
      });
    }

    // ── 8. Verificar que el usuario no tenga ya el rol ───────────────────────
    if (targetMember.roles.cache.has(adminRole.id)) {
      return interaction.editReply({
        content: `ℹ️ **${targetMember.user.tag}** ya tiene el rol **${adminRole.name}**. No es necesario volver a otorgarlo.`,
      });
    }

    // ── 9. Construir y enviar el mensaje de solicitud ────────────────────────
    const solicitudEmbed = buildSolicitudEmbed(targetMember, adminRole, executor, guild);

    let msg;
    try {
      msg = await logsChannel.send({
        content: `${targetMember}`,   // Mención para que le llegue la notificación
        embeds:     [solicitudEmbed],
        components: [buildRow(false)],
      });
    } catch (err) {
      return interaction.editReply({
        content: `❌ No pude enviar el mensaje al canal de logs: ${err.message}`,
      });
    }

    await interaction.editReply({
      content: `✅ Solicitud enviada a ${targetMember} en ${logsChannel}. Expirará en 10 minutos si no hay respuesta.`,
    });

    // ── 10. Collector de botones ─────────────────────────────────────────────
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time:          TIMEOUT_MS,
      max:           1,       // Solo 1 interacción válida del objetivo
    });

    collector.on('collect', async i => {
      // Verificar que sea el usuario objetivo (capa extra de seguridad)
      if (i.user.id !== TARGET_ADMIN_USER_ID) {
        return i.reply({
          content: '⛔ Solo el usuario designado puede responder a esta solicitud.',
          ephemeral: true,
        });
      }

      // Reconocer la interacción INMEDIATAMENTE (evita "Esta interacción falló")
      await i.deferUpdate();

      // Deshabilitar botones mientras procesamos
      await msg.edit({ components: [buildRow(true)] }).catch(() => {});

      // ── Rama: ACEPTÓ ──────────────────────────────────────────────────────
      if (i.customId === 'promover_admin_si') {
        const errores = [];

        // Paso A: agregar permiso Administrator al rol
        try {
          const nuevosPermisos = adminRole.permissions.add(PermissionFlagsBits.Administrator);
          await adminRole.setPermissions(
            nuevosPermisos,
            `Promovido a Administrador — solicitado por ${executor.tag}`
          );
        } catch (err) {
          errores.push(`No se pudo actualizar los permisos del rol: **${err.message}**`);
        }

        // Paso B: asignar el rol al usuario
        try {
          await targetMember.roles.add(
            adminRole,
            `Administrador otorgado por ${executor.tag}`
          );
        } catch (err) {
          errores.push(`No se pudo asignar el rol al usuario: **${err.message}**`);
        }

        // Embed de resultado
        const exitoEmbed = new EmbedBuilder()
          .setColor(errores.length === 0 ? COLORS.SUCCESS : COLORS.WARNING)
          .setTitle(errores.length === 0 ? '✅ Permisos de Administrador Otorgados' : '⚠️ Completado con advertencias')
          .setDescription(
            errores.length === 0
              ? `**${targetMember.user.tag}** aceptó y ahora cuenta con permisos de **Administrador** en el servidor.`
              : `El proceso terminó pero hubo errores:\n${errores.join('\n')}`
          )
          .addFields(
            { name: '👤 Nuevo Administrador', value: `${targetMember}`, inline: true },
            { name: '🎭 Rol otorgado',         value: `${adminRole}`,   inline: true },
            { name: '📨 Otorgado por',          value: `${executor}`,   inline: true },
          )
          .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: 'Sistema de Moderación • LigaPro Ecuabet', iconURL: guild.iconURL() ?? undefined });

        await msg.edit({
          embeds:     [solicitudEmbed, exitoEmbed],
          components: [buildRow(true)],
        }).catch(() => {});

        // DM al nuevo administrador (silencioso si tiene DMs cerrados)
        await targetMember.send({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🛡️ ¡Ahora eres Administrador!')
              .setDescription(
                `Has aceptado el rol **${adminRole.name}** con permisos de **Administrador** en **${guild.name}**.\n` +
                `Úsalos con responsabilidad.`
              )
              .setTimestamp(),
          ],
        }).catch(() => {});

        // Log
        await sendLog(guild, {
          title:       'Promoción a Administrador',
          description: `**${targetMember.user.tag}** aceptó los permisos de Administrador otorgados por **${executor.tag}**.`,
          color:       errores.length === 0 ? COLORS.SUCCESS : COLORS.WARNING,
          thumbnail:   targetMember.user.displayAvatarURL({ dynamic: true }),
          fields: [
            { name: '👤 Nuevo Admin', value: `${targetMember.user}`,   inline: true },
            { name: '🎭 Rol',         value: `${adminRole.name}`,      inline: true },
            { name: '📨 Otorgado por',value: `${executor}`,            inline: true },
            ...(errores.length > 0 ? [{ name: '⚠️ Errores', value: errores.join('\n'), inline: false }] : []),
          ],
        });

      // ── Rama: RECHAZÓ ────────────────────────────────────────────────────
      } else {
        const rechazoEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('❌ Solicitud Rechazada')
          .setDescription(`**${targetMember.user.tag}** rechazó la oferta de permisos de Administrador.`)
          .setTimestamp()
          .setFooter({ text: 'Sistema de Moderación • LigaPro Ecuabet', iconURL: guild.iconURL() ?? undefined });

        await msg.edit({
          embeds:     [solicitudEmbed, rechazoEmbed],
          components: [buildRow(true)],
        }).catch(() => {});

        await sendLog(guild, {
          title:       'Solicitud de Admin Rechazada',
          description: `**${targetMember.user.tag}** rechazó los permisos de Administrador ofrecidos por **${executor.tag}**.`,
          color: COLORS.ERROR,
          fields: [
            { name: '👤 Usuario',     value: `${targetMember.user}`, inline: true },
            { name: '📨 Ofrecido por',value: `${executor}`,          inline: true },
          ],
        });
      }

      collector.stop('handled');
    });

    // ── 11. Tiempo expirado sin respuesta ────────────────────────────────────
    collector.on('end', async (_collected, reason) => {
      if (reason === 'handled') return; // Ya fue gestionado correctamente

      const expiredEmbed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('⏰ Solicitud Expirada')
        .setDescription(
          `La solicitud de permisos para **${targetMember.user.tag}** expiró sin respuesta después de **10 minutos**.`
        )
        .setTimestamp()
        .setFooter({ text: 'Sistema de Moderación • LigaPro Ecuabet', iconURL: guild.iconURL() ?? undefined });

      await msg.edit({
        embeds:     [solicitudEmbed, expiredEmbed],
        components: [buildRow(true)],
      }).catch(() => {});
    });
  },
};
