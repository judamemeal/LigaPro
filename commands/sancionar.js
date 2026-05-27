const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sancionar')
    .setDescription('Sanciona (timeout) a un usuario por X horas (solo admins)')
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuario a sancionar').setRequired(true)
    )
    .addNumberOption(opt =>
      opt.setName('horas').setDescription('Duración en horas').setRequired(true).setMinValue(0.1).setMaxValue(672)
    )
    .addStringOption(opt =>
      opt.setName('razon').setDescription('Razón de la sanción').setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const target = interaction.options.getMember('usuario');
    const horas = interaction.options.getNumber('horas');
    const razon = interaction.options.getString('razon') || 'Sin razón especificada';

    if (!target) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
    if (isAdmin(target)) return interaction.reply({ content: '❌ No puedes sancionar a un administrador.', ephemeral: true });

    const duracionMs = horas * 60 * 60 * 1000;

    try {
      await target.timeout(duracionMs, razon);
    } catch (err) {
      return interaction.reply({ content: `❌ No se pudo sancionar al usuario: ${err.message}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle('⏰ Usuario Sancionado')
      .addFields(
        { name: '👤 Usuario', value: `${target}`, inline: true },
        { name: '⏱️ Duración', value: `${horas} hora(s)`, inline: true },
        { name: '📝 Razón', value: razon },
        { name: '🔨 Sancionado por', value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();

    // Notificar al usuario por DM
    let dmEnviado = true;
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle('⚠️ Has sido aislado')
          .setDescription(`Has sido aislado por **${interaction.user.tag}** por **${horas} hora(s)** en el servidor **${interaction.guild.name}**.\n\nSi no estás conforme con la decisión que hemos tomado, por favor, comunícate con el administrador o el owner del servidor sacando un ticket con otra persona o comunicándote directamente con él. Gracias.`)
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
      title: 'Usuario Sancionado (Aislado/Mute)',
      description: `El administrador **${interaction.user.tag}** ha sancionado a **${target.user.tag}**.`,
      color: COLORS.LOG_MUTE,
      fields: [
        { name: '👤 Sancionado', value: `${target.user}`, inline: true },
        { name: '🔨 Por', value: `${interaction.user}`, inline: true },
        { name: '⏱️ Duración', value: `${horas} hora(s)`, inline: true },
        { name: '📝 Razón', value: razon, inline: false },
      ],
      sendToSanctions: true,
      sanctionsTitle: '⏰ Sanción Aplicada',
      sanctionsDescription: `**${target.user.tag}** ha sido aislado por **${interaction.user.tag}** durante **${horas} hora(s)**.`,
    });
  },
};
