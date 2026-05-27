const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desbanear')
    .setDescription('Desbanea a un usuario mediante su ID (solo admins)')
    .addStringOption(opt =>
      opt.setName('id').setDescription('ID del usuario baneado').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('razon').setDescription('Razón del desbaneo').setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const userId = interaction.options.getString('id').trim();
    const razon = interaction.options.getString('razon') || 'Sin razón especificada';

    // Validar que el ID sea numérico
    if (!/^\d+$/.test(userId)) {
      return interaction.reply({ content: '❌ El ID proporcionado no es válido. Debe ser un número.', ephemeral: true });
    }

    // Verificar que el usuario esté efectivamente baneado
    let banEntry;
    try {
      banEntry = await interaction.guild.bans.fetch(userId);
    } catch {
      return interaction.reply({ content: `❌ No se encontró ningún baneo para el ID \`${userId}\`. Verifica que el ID sea correcto.`, ephemeral: true });
    }

    // Ejecutar desbaneo
    try {
      await interaction.guild.members.unban(userId, razon);
    } catch (err) {
      return interaction.reply({ content: `❌ No se pudo desbanear al usuario: ${err.message}`, ephemeral: true });
    }

    const tag = banEntry.user.tag;
    const avatar = banEntry.user.displayAvatarURL({ dynamic: true });

    const embed = new EmbedBuilder()
      .setColor(COLORS.LOG_UNBAN)
      .setTitle('✅ Usuario Desbaneado')
      .setThumbnail(avatar)
      .addFields(
        { name: '👤 Usuario', value: `${tag} (\`${userId}\`)`, inline: true },
        { name: '📝 Razón original del baneo', value: banEntry.reason || 'No especificada', inline: false },
        { name: '🟢 Razón del desbaneo', value: razon, inline: false },
        { name: '🔓 Desbaneado por', value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await sendLog(interaction.guild, {
      title: 'Usuario Desbaneado',
      description: `El administrador **${interaction.user.tag}** ha desbaneado a **${tag}**.`,
      color: COLORS.LOG_UNBAN,
      thumbnail: avatar,
      fields: [
        { name: '👤 Usuario', value: `${tag} (\`${userId}\`)`, inline: true },
        { name: '🔓 Por', value: `${interaction.user}`, inline: true },
        { name: '🟢 Razón del desbaneo', value: razon, inline: false },
        { name: '📝 Razón original del baneo', value: banEntry.reason || 'No especificada', inline: false },
      ],
      sendToSanctions: true,
      sanctionsTitle: '✅ Desbaneo Aplicado',
      sanctionsDescription: `**${tag}** ha sido desbaneado del servidor por **${interaction.user.tag}**.`,
    });
  },
};
