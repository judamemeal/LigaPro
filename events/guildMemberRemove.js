const { EmbedBuilder } = require('discord.js');
const { GOODBYE_CHANNEL_ID, COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const channel = member.guild.channels.cache.get(GOODBYE_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.GOODBYE)
      .setTitle('👋 Un miembro se ha ido...')
      .setDescription(
        `**${member.user.tag}** ha abandonado el servidor.\n\nEsperamos que vuelva pronto. 😢`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📅 Se unió', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Desconocido', inline: true },
        { name: '👥 Miembros restantes', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID: ${member.user.id}` })
      .setTimestamp();

    channel.send({ embeds: [embed] });

    await sendLog(member.guild, {
      title: 'Miembro Abandonó',
      description: `El usuario **${member.user.tag}** abandonó el servidor.`,
      color: COLORS.GOODBYE,
      fields: [
        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
        { name: 'ID', value: member.id, inline: true },
      ],
      thumbnail: member.user.displayAvatarURL({ dynamic: true })
    });
  },
};
