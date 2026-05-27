const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desancionar')
    .setDescription('Quita el timeout/sanción de un usuario (solo admins)')
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuario a desancionar').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('razon').setDescription('Razón de levantar la sanción').setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const target = interaction.options.getMember('usuario');
    const razon = interaction.options.getString('razon') || 'Sin razón especificada';

    if (!target) {
      return interaction.reply({ content: '❌ Usuario no encontrado en el servidor.', ephemeral: true });
    }

    // Verificar que el usuario tenga un timeout activo
    if (!target.communicationDisabledUntil || target.communicationDisabledUntil < new Date()) {
      return interaction.reply({ content: `❌ **${target.user.tag}** no tiene ninguna sanción activa.`, ephemeral: true });
    }

    // Quitar el timeout pasando null
    try {
      await target.timeout(null, razon);
    } catch (err) {
      return interaction.reply({ content: `❌ No se pudo quitar la sanción: ${err.message}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.LOG_UNSANCTION)
      .setTitle('🟢 Sanción Levantada')
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Usuario', value: `${target}`, inline: true },
        { name: '🟢 Razón del levantamiento', value: razon, inline: false },
        { name: '🔓 Desancionado por', value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();

    // Intentar notificar por DM
    let dmEnviado = true;
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.LOG_UNSANCTION)
          .setTitle('✅ Tu sanción ha sido levantada')
          .setDescription(`Tu aislamiento en **${interaction.guild.name}** ha sido levantado por **${interaction.user.tag}**. Ya puedes participar con normalidad en el servidor.`)
          .setTimestamp(),
      ],
    }).catch(() => {
      dmEnviado = false;
    });

    if (!dmEnviado) {
      embed.setFooter({ text: '⚠️ El usuario tiene los DMs cerrados, no se le pudo notificar.' });
    }

    await interaction.reply({ embeds: [embed] });

    await sendLog(interaction.guild, {
      title: 'Sanción Levantada',
      description: `El administrador **${interaction.user.tag}** ha levantado la sanción de **${target.user.tag}**.`,
      color: COLORS.LOG_UNSANCTION,
      thumbnail: target.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: '👤 Usuario', value: `${target.user}`, inline: true },
        { name: '🔓 Por', value: `${interaction.user}`, inline: true },
        { name: '🟢 Razón', value: razon, inline: false },
      ],
      sendToSanctions: true,
      sanctionsTitle: '🟢 Sanción Levantada',
      sanctionsDescription: `La sanción de **${target.user.tag}** ha sido levantada por **${interaction.user.tag}**.`,
    });
  },
};
