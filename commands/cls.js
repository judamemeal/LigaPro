const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cls')
    .setDescription('Borra una cantidad de mensajes del canal (solo admins)')
    .addIntegerOption(opt =>
      opt.setName('cantidad')
        .setDescription('Cantidad de mensajes a borrar (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const cantidad = interaction.options.getInteger('cantidad');

    await interaction.deferReply({ ephemeral: true });

    let deleted;
    try {
      deleted = await interaction.channel.bulkDelete(cantidad, true);
    } catch (err) {
      return interaction.editReply({ content: '❌ No se pudieron borrar los mensajes. Puede que sean muy antiguos (>14 días).' });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('🗑️ Mensajes eliminados')
      .setDescription(`Se han borrado **${deleted.size}** mensaje(s) correctamente.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Enviar log
    await sendLog(interaction.guild, {
      title: 'Limpieza de Mensajes',
      description: `El administrador **${interaction.user.tag}** usó el sistema de limpieza.`,
      color: COLORS.LOG_CLEAR,
      fields: [
        { name: '👤 Administrador', value: `${interaction.user}`, inline: true },
        { name: '📺 Canal', value: `${interaction.channel}`, inline: true },
        { name: '🗑️ Cantidad', value: `${deleted.size} mensajes borrados`, inline: true },
      ]
    });

    // El mensaje desaparece después de 4 segundos
    setTimeout(async () => {
      await interaction.deleteReply().catch(() => {});
    }, 4000);
  },
};
