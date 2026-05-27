const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banear')
    .setDescription('Banea permanentemente a un usuario del servidor (solo admins)')
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuario a banear').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('razon').setDescription('Razón del baneo').setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const target = interaction.options.getMember('usuario');
    const razon = interaction.options.getString('razon') || 'Sin razón especificada';

    if (!target) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
    if (isAdmin(target)) return interaction.reply({ content: '❌ No puedes banear a un administrador.', ephemeral: true });

    // Notificar antes de banear
    let dmEnviado = true;
    await target.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('🔨 Has sido baneado')
          .setDescription(`Has sido baneado por **${interaction.user.tag}**, por la razón: **${razon}**, en el servidor **${interaction.guild.name}**.\n\nSi deseas apelar la decisión, comunícate con los administradores o pide a alguien en el servidor que te ayude a apelar.`)
          .setTimestamp(),
      ],
    }).catch(() => {
      dmEnviado = false;
    });

    try {
      await target.ban({ reason: razon, deleteMessageSeconds: 86400 });
    } catch (err) {
      return interaction.reply({ content: `❌ No se pudo banear al usuario: ${err.message}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('🔨 Usuario Baneado')
      .addFields(
        { name: '👤 Usuario', value: `${target.user.tag}`, inline: true },
        { name: '📝 Razón', value: razon },
        { name: '🔨 Baneado por', value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();

    if (!dmEnviado) {
      embed.setFooter({ text: '⚠️ El usuario tiene los DMs cerrados, no se le pudo notificar.' });
    }

    await interaction.reply({ embeds: [embed] });

    await sendLog(interaction.guild, {
      title: 'Usuario Baneado',
      description: `El administrador **${interaction.user.tag}** ha baneado a **${target.user.tag}**.`,
      color: COLORS.LOG_BAN,
      fields: [
        { name: '👤 Baneado', value: `${target.user}`, inline: true },
        { name: '🔨 Por', value: `${interaction.user}`, inline: true },
        { name: '📝 Razón', value: razon, inline: false },
      ],
      sendToSanctions: true,
      sanctionsTitle: '🔨 Baneo Aplicado',
      sanctionsDescription: `**${target.user.tag}** ha sido baneado del servidor por **${interaction.user.tag}**.`,
    });
  },
};
