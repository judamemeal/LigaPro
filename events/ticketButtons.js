const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ADMIN_ROLES, COLORS } = require('../config');
const { sendLog } = require('../utils/logger');


// Datos en memoria (no depende del sistema de archivos de Railway)
if (!global.ticketData) global.ticketData = { counter: 0, tickets: {} };

module.exports = {
  name: 'ticketButtons',
  async execute(interaction, client) {
    const { customId, guild, member } = interaction;

    const ticketTypes = {
      'ticket_partner': '🤝 Partner',
      'ticket_duda': '❓ Duda o Sugerencia',
      'ticket_postulacion': '📋 Postulación',
      'ticket_apelacion': '⚖️ Apelar Sanción',
      'ticket_queja': '📢 Queja',
    };

    if (!ticketTypes[customId]) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const data = global.ticketData;

    const existingTicket = Object.values(data.tickets).find(
      t => t.userId === member.id && t.status === 'open'
    );

    if (existingTicket) {
      const ch = guild.channels.cache.get(existingTicket.channelId);
      return interaction.editReply({
        content: `❌ Ya tienes un ticket abierto: ${ch ? ch.toString() : 'ticket-' + existingTicket.number}. Ciérralo antes de abrir uno nuevo.`,
      });
    }

    data.counter += 1;
    const ticketNumber = data.counter;
    const channelName = `ticket-${ticketNumber}`;

    const permissionOverwrites = [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];

    for (const roleId of ADMIN_ROLES) {
      permissionOverwrites.push({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
      });
    }

    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites,
        topic: `Ticket #${ticketNumber} | ${ticketTypes[customId]} | Usuario: ${member.user.tag}`,
      });
    } catch (err) {
      console.error('Error creando canal de ticket:', err);
      return interaction.editReply({ content: '❌ No se pudo crear el canal. Verifica que el bot tenga el permiso **Gestionar Canales**.' });
    }

    data.tickets[ticketNumber] = {
      number: ticketNumber,
      channelId: ticketChannel.id,
      userId: member.id,
      type: ticketTypes[customId],
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const adminMentions = ADMIN_ROLES.map(id => `<@&${id}>`).join(' ');

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`🎫 Ticket #${ticketNumber} — ${ticketTypes[customId]}`)
      .setDescription(
        `Hola ${member}! Un miembro del equipo te atenderá pronto.\n\n` +
        `**⚠️ Recuerda:** No abras tickets innecesarios o serás sancionado.\n\n` +
        `Para cerrar este ticket usa el botón de abajo.`
      )
      .addFields(
        { name: '👤 Usuario', value: `${member}`, inline: true },
        { name: '📂 Tipo', value: ticketTypes[customId], inline: true },
        { name: '📅 Abierto', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `Ticket ID: ${ticketNumber}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketNumber}`)
        .setLabel('🔒 Cerrar Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `${adminMentions} | ${member}`, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Tu ticket ha sido creado: ${ticketChannel}` });

    // Log ticket creation
    await sendLog(guild, {
      title: 'Ticket Abierto',
      description: `El usuario **${member.user.tag}** ha abierto un ticket.`,
      color: COLORS.LOG_TICKET,
      fields: [
        { name: '👤 Usuario', value: `${member}`, inline: true },
        { name: '📂 Tipo', value: ticketTypes[customId], inline: true },
        { name: '📺 Canal', value: `${ticketChannel.name}`, inline: true },
      ]
    });

    const collector = ticketChannel.createMessageComponentCollector({
      filter: i => i.customId === `close_ticket_${ticketNumber}`,
    });

    collector.on('collect', async (btnInteraction) => {
      const isAdminUser = btnInteraction.member.roles.cache.some(r => ADMIN_ROLES.includes(r.id));
      if (!isAdminUser && btnInteraction.user.id !== member.id) {
        return btnInteraction.reply({ content: '❌ No puedes cerrar este ticket.', flags: MessageFlags.Ephemeral });
      }

      data.tickets[ticketNumber].status = 'closed';

      const closeEmbed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🔒 Ticket Cerrado')
        .setDescription(`Cerrado por ${btnInteraction.member}. El canal se eliminará en 5 segundos.`);

      await btnInteraction.reply({ embeds: [closeEmbed] });

      // Log ticket closing/deletion
      await sendLog(guild, {
        title: 'Ticket Cerrado y Eliminado',
        description: `El ticket **${channelName}** ha sido cerrado.`,
        color: COLORS.LOG_TICKET,
        fields: [
          { name: '🔒 Cerrado por', value: `${btnInteraction.member}`, inline: true },
          { name: '📂 Tipo', value: ticketTypes[customId], inline: true },
        ]
      });

      setTimeout(() => ticketChannel.delete().catch(() => {}), 5000);
    });
  },
};
