const Notification = require("../models/Notification");

const listMyNotifications = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    const query = {
      $or: [
        { user: userId },
        { role },
        { role: "all" },
      ],
    };
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    const query = {
      $or: [{ user: userId }, { role }, { role: "all" }],
      isRead: false,
    };
    await Notification.updateMany(query, { $set: { isRead: true } });
    res.json({ message: "All notifications marked as read." });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({
      _id: id,
      $or: [{ user: userId }, { role }, { role: "all" }],
    });
    if (!deleted) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Notification deleted." });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const markOneRead = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    const { id } = req.params;
    const updated = await Notification.findOneAndUpdate(
      { _id: id, $or: [{ user: userId }, { role }, { role: "all" }] },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Notification not found." });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createSelfNotification = async (req, res) => {
  try {
    const { title, message, type } = req.body || {};
    if (!title || !message) return res.status(400).json({ message: "title and message are required." });
    const doc = await Notification.create({
      user: req.user.id,
      role: req.user.role === "admin" ? "admin" : "user",
      title,
      message,
      type: type || "info",
      isRead: false,
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { listMyNotifications, markAllRead, deleteNotification, markOneRead, createSelfNotification };
