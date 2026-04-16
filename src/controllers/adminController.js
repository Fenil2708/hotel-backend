const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const CompletedBill = require("../models/CompletedBill");
const { buildBillSnapshot } = require("./tableController");
const { notifyUser, notifyRole } = require("../utils/notificationService");
const { rotateTableAccessCode } = require("./tableCatalogController");

function dayRange(dateInput) {
  const base = dateInput ? new Date(dateInput) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const getDashboardStats = async (req, res) => {
  try {
    const activeSessions = await TableSession.find({ status: { $in: ["open", "awaiting_payment"] } }).sort({ tableNumber: 1 });
    const kitchenOrders = await Order.find({
      $or: [
        { status: { $in: ["Pending", "Preparing"] } },
        { cancellationStatus: "requested" },
      ],
    })
      .populate({
        path: "items.foodId",
        populate: { path: "category" }
      })
      .sort({ createdAt: 1 });

    const { start, end } = dayRange(req.query.date);
    const billFilter = { createdAt: { $gte: start, $lte: end } };
    const billsCount = await CompletedBill.countDocuments(billFilter);
    const sumResult = await CompletedBill.aggregate([
      { $match: billFilter },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } }
    ]);
    const totalRevenue = sumResult[0]?.totalRevenue || 0;

    res.json({
      activeSessions,
      kitchenOrders,
      stats: {
        totalRevenue,
        completedBills: billsCount,
        date: start.toISOString().slice(0, 10),
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Pending", "Preparing", "Served", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.status === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({ message: "Cancelled order cannot move back to active flow." });
    }
    if (order.cancellationStatus === "requested" && status !== "Cancelled") {
      return res.status(400).json({ message: "Resolve the cancellation request before changing order status." });
    }

    order.status = status;
    if (status === "Cancelled") {
      order.cancellationStatus = "approved";
      order.cancellationResolvedAt = new Date();
    }
    await order.save();

    if (order) {
      const session = await TableSession.findById(order.tableSessionId).select("customer tableNumber");
      await notifyUser(session?.customer, "Order Status Updated", `Your order for table ${order.tableNumber} is now ${status}.`, "order", { tableNumber: order.tableNumber, orderId: order._id, status });
      await notifyRole("admin", "Order Status Changed", `Order for table ${order.tableNumber} marked ${status}.`, "order", { tableNumber: order.tableNumber, orderId: order._id, status });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const reviewCancellationRequest = async (req, res) => {
  try {
    const decision = String(req.body.decision || "").trim().toLowerCase();
    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be approve or reject." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.cancellationStatus !== "requested") {
      return res.status(400).json({ message: "No pending cancellation request for this order." });
    }

    const session = await TableSession.findById(order.tableSessionId).select("customer tableNumber status");

    if (decision === "approve") {
      order.status = "Cancelled";
      order.cancellationStatus = "approved";
    } else {
      order.cancellationStatus = "rejected";
    }

    order.cancellationResolvedAt = new Date();
    await order.save();

    if (decision === "approve" && session?.status === "awaiting_payment") {
      const activeCount = await Order.countDocuments({
        tableSessionId: order.tableSessionId,
        status: { $ne: "Cancelled" },
      });

      if (activeCount === 0) {
        session.status = "open";
        await session.save();
      }
    }

    await notifyUser(
      session?.customer,
      decision === "approve" ? "Order Cancelled" : "Cancellation Rejected",
      decision === "approve"
        ? `Your cancellation request for table ${order.tableNumber} was approved.`
        : `Your cancellation request for table ${order.tableNumber} was rejected because preparation is already underway.`,
      "order",
      { tableNumber: order.tableNumber, orderId: order._id, decision }
    );

    return res.json({
      message: decision === "approve" ? "Cancellation approved." : "Cancellation rejected.",
      order,
      sessionStatus: session?.status || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const forceCloseTable = async (req, res) => {
    try {
        const session = await TableSession.findById(req.params.id);
        if(!session) return res.status(404).json({ message: "Session not found" });

        if(session.status !== "closed") {
            // maybe create bill snapshot if anything exists?
            const count = await Order.countDocuments({ tableSessionId: session._id });
            if (count > 0 && session.status === "awaiting_payment") {
                const { lines, total } = await buildBillSnapshot(session._id);
                if (lines.length > 0) {
                    await CompletedBill.create({
                        tableNumber: session.tableNumber,
                        tableSessionId: session._id,
                        customer: session.customer,
                        items: lines,
                        total,
                        paymentMethod: "cash",
                    });
                }
            }
            session.status = "closed";
            await session.save();
            const rotatedTable = await rotateTableAccessCode(session.tableNumber);
            if (rotatedTable?.accessCode) {
                await notifyRole("admin", "Table Access Code Rotated", `Table ${session.tableNumber} received a new access code: ${rotatedTable.accessCode}`, "security", { tableNumber: session.tableNumber, accessCode: rotatedTable.accessCode });
            }
            await notifyUser(session.customer, "Table Cleared", `Admin cleared table ${session.tableNumber}. You can start a new table now.`, "info", { tableNumber: session.tableNumber });
            await notifyRole("admin", "Table Cleared", `Table ${session.tableNumber} was cleared by admin.`, "success", { tableNumber: session.tableNumber });
        }

        const rotatedTable = await require("../models/DiningTable").findOne({ tableNumber: session.tableNumber }).select("tableNumber accessCode");
        res.json({ message: "Table closed successfully", session, rotatedTable });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBillHistory = async (req, res) => {
    try {
        const bills = await CompletedBill.find().sort({ createdAt: -1 }).limit(100);
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await require("../models/User").find({ role: "user" }).select("-password");
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getUserHistory = async (req, res) => {
  try {
    const history = await require("../models/CompletedBill").find({ customer: req.params.id }).sort({ createdAt: -1 });
    res.json(history);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getProfitStats = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const match = { createdAt: { $gte: from, $lte: to } };
    const overall = await CompletedBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          cashRevenue: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$total", 0] } },
          onlineRevenue: { $sum: { $cond: [{ $eq: ["$paymentMethod", "online"] }, "$total", 0] } },
          bills: { $sum: 1 },
        },
      },
    ]);

    const daily = await CompletedBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$total" },
          cash: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$total", 0] } },
          online: { $sum: { $cond: [{ $eq: ["$paymentMethod", "online"] }, "$total", 0] } },
          bills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const summary = overall[0] || { totalRevenue: 0, cashRevenue: 0, onlineRevenue: 0, bills: 0 };
    res.json({
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      summary,
      daily,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  updateOrderStatus,
  reviewCancellationRequest,
  forceCloseTable,
  getBillHistory,
  getAllUsers,
  getUserHistory,
  getProfitStats,
};
