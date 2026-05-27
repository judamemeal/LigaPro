const { ADMIN_ROLES } = require('../config');

function isAdmin(member) {
  return member.roles.cache.some(r => ADMIN_ROLES.includes(r.id)) || member.permissions.has('Administrator');
}

function noPermReply(interaction) {
  return interaction.reply({
    content: '❌ No tienes permisos para usar este comando.',
    ephemeral: true,
  });
}

module.exports = { isAdmin, noPermReply };
