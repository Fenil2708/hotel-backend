const express = require("express");
const { authMiddleware } = require("../middlewares/auth");
const { listMyNotifications, markAllRead, deleteNotification, markOneRead, createSelfNotification } = require("../controllers/notificationController");

const router = express.Router();

router.get("/", authMiddleware, listMyNotifications);
router.post("/", authMiddleware, createSelfNotification);
router.patch("/mark-all-read", authMiddleware, markAllRead);
router.patch("/:id/read", authMiddleware, markOneRead);
router.delete("/:id", authMiddleware, deleteNotification);

module.exports = router;
