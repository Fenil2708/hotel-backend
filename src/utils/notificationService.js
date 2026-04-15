const Notification = require("../models/Notification");

async function notifyRole(role, title, message, type = "info", meta = {}) {
  return Notification.create({ role, title, message, type, meta });
}

async function notifyUser(userId, title, message, type = "info", meta = {}) {
  if (!userId) return null;
  return Notification.create({ user: userId, role: "user", title, message, type, meta });
}

module.exports = { notifyRole, notifyUser };
