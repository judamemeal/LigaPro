const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Envía el panel de tickets al canal (solo admins)'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🎫 Sistema de Tickets')
      .setDescription(
        '¿Necesitas ayuda? Abre un ticket según tu situación.\n\n' +
        '**⚠️ ADVERTENCIA:** No abras tickets sin motivo válido.\n' +
        'Los tickets innecesarios resultarán en una **sanción**.\n\n' +
        '> 🤝 **Partner** — ¿Quieres hacer alianza con nosotros?\n' +
        '> ❓ **Duda/Sugerencia** — ¿Tienes alguna pregunta o idea?\n' +
        '> 📋 **Postulación** — ¿Quieres unirte al staff?\n' +
        '> ⚖️ **Apelar Sanción** — ¿Fuiste sancionado injustamente?\n' +
        '> 📢 **Queja** — ¿Quieres reportar a alguien o algo?\n'
      )
      .setFooter({ text: 'Selecciona el botón correspondiente a tu situación' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_partner').setLabel('Partner').setEmoji('🤝').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_duda').setLabel('Duda/Sugerencia').setEmoji('❓').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_postulacion').setLabel('Postulación').setEmoji('📋').setStyle(ButtonStyle.Success),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_apelacion').setLabel('Apelar Sanción').setEmoji('⚖️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_queja').setLabel('Queja').setEmoji('📢').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ content: '✅ Panel de tickets enviado.', ephemeral: true });
    await interaction.channel.send({ embeds: [embed], components: [row, row2] });
  },
};
