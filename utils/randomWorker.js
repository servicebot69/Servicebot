module.exports = async (guild, roleId) => {
  const role = guild.roles.cache.get(roleId);
  if (!role) return null;

  const members = role.members.map(m => m);
  if (!members.length) return null;

  return members[Math.floor(Math.random() * members.length)];
};
