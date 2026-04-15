const jwt = require("jsonwebtoken");
const TableSession = require("../models/TableSession");

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "hotel-secret");
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
};

const tableSessionAuth = async (req, res, next) => {
  const token = req.headers["x-table-session-token"];
  if (!token) return res.status(401).json({ message: "Table session token required" });

  try {
    const tableSession = await TableSession.findOne({ token, status: { $ne: "closed" } });
    if (!tableSession) return res.status(401).json({ message: "Invalid or closed table session" });
    req.tableSession = tableSession;
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { authMiddleware, adminMiddleware, tableSessionAuth };
