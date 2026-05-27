// events/guildMemberAdd.js
const { EmbedBuilder } = require('discord.js');
const { WELCOME_CHANNEL_ID, COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.WELCOME)
      .setTitle('👋 ¡Bienvenido al servidor!')
      .setDescription(
        `¡Hola ${member}! 🎉\n\nNos alegra tenerte aquí. Esperamos que disfrutes tu estancia.\n\n**¡Eres el miembro número ${member.guild.memberCount}!**`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
        { name: '📅 Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setImage('https://i0.wp.com/radiosport.com.ec/wp-content/uploads/2024/12/LigaPro.webp?fit=700%2C380&ssl=1') // Puedes cambiar esto por tu banner
      .setFooter({ text: `ID: ${member.user.id}` })
      .setTimestamp();

    channel.send({ content: `✨ ¡Bienvenido ${member}!`, embeds: [embed] });

    await sendLog(member.guild, {
      title: 'Nuevo Miembro',
      description: `He dado la bienvenida a **${member.user.tag}**.`,
      color: COLORS.WELCOME,
      fields: [
        { name: '👤 Usuario', value: `${member}`, inline: true },
        { name: 'ID', value: member.id, inline: true },
      ],
      thumbnail: member.user.displayAvatarURL({ dynamic: true })
    });
  },
};
