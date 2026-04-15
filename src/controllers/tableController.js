const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const Stripe = require("stripe");
const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const CompletedBill = require("../models/CompletedBill");
const DiningTable = require("../models/DiningTable");
const { notifyRole, notifyUser } = require("../utils/notificationService");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: false });

function getStripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (!key) return null;
  return new Stripe(key);
}

async function buildBillSnapshot(tableSessionId) {
  const orders = await Order.find({ tableSessionId }).populate("items.foodId");
  const lines = [];
  for (const order of orders) {
    for (const line of order.items) {
      const food = line.foodId;
      if (!food) {
        continue;
      }
      lines.push({
        foodId: food._id,
        name: food.name,
        selectedOption: line.selectedOption || "",
        quantity: line.quantity || 1,
        price: food.price || 0,
        lineTotal: (food.price || 0) * (line.quantity || 1),
      });
    }
  }
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { lines, total };
}

const startTable = async (req, res) => {
  const tableNumber = Number(req.body.tableNumber);
  const customer = req.body.customerId;
  const guests = Number(req.body.guests || 1);

  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    return res.status(400).json({ message: "Enter valid guest count (1-20)." });
  }

  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    return res.status(400).json({ message: "Enter a valid table number." });
  }

  if (customer) {
    const existingSessionForCustomer = await TableSession.findOne({
      customer,
      status: { $in: ["open", "awaiting_payment"] },
    });
    if (existingSessionForCustomer) {
      return res.status(409).json({
        message: `You already have active table ${existingSessionForCustomer.tableNumber}. Wait until admin clears it.`,
      });
    }
  }

  const tableDef = await DiningTable.findOne({ tableNumber, isActive: true });
  if (!tableDef) {
    return res.status(404).json({ message: "Selected table is not available." });
  }
  if (tableDef.capacity < guests) {
    return res.status(400).json({ message: `Table ${tableNumber} supports up to ${tableDef.capacity} guests.` });
  }

  const busy = await TableSession.findOne({
    tableNumber,
    status: { $in: ["open", "awaiting_payment"] },
  });

  if (busy) {
    return res.status(409).json({
      message: "This table already has an active session. Ask staff to clear it.",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const session = await TableSession.create({ tableNumber, guests, token, status: "open", customer });
  await notifyRole("admin", "New Table Session", `Table ${tableNumber} started with ${guests} guests.`, "info", { tableNumber, guests });
  res.status(201).json({
    sessionId: session._id,
    tableSessionToken: token,
    tableNumber: session.tableNumber,
    guests: session.guests,
    status: session.status,
  });
};

const getAvailableTables = async (req, res) => {
  try {
    const guests = Number(req.query.guests || 1);
    let tables = await DiningTable.find({ isActive: true }).sort({ tableNumber: 1 });
    if (tables.length === 0) {
      const defaults = [
        { tableNumber: 1, capacity: 5 },
        { tableNumber: 2, capacity: 4 },
        { tableNumber: 3, capacity: 6 },
        { tableNumber: 4, capacity: 4 },
        { tableNumber: 5, capacity: 2 },
        { tableNumber: 6, capacity: 8 },
        { tableNumber: 7, capacity: 4 },
        { tableNumber: 8, capacity: 6 },
      ];
      await DiningTable.insertMany(defaults.map((row) => ({ ...row, isActive: true })));
      tables = await DiningTable.find({ isActive: true }).sort({ tableNumber: 1 });
    }
    const activeSessions = await TableSession.find({ status: { $in: ["open", "awaiting_payment"] } }).select("tableNumber");
    const busySet = new Set(activeSessions.map((s) => s.tableNumber));
    const result = tables.map((t) => ({
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      occupied: busySet.has(t.tableNumber),
      canSeatGuests: t.capacity >= guests,
      selectable: !busySet.has(t.tableNumber) && t.capacity >= guests,
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getSession = async (req, res) => {
  const token = req.headers["x-table-session-token"];
  if (!token) return res.status(400).json({ message: "Table session token required" });

  const tableSession = await TableSession.findOne({ token, status: { $ne: "closed" } });
  if (!tableSession) return res.status(404).json({ message: "Session not found or closed" });

  res.json({
    id: tableSession._id,
    tableNumber: tableSession.tableNumber,
    guests: tableSession.guests,
    status: tableSession.status,
  });
};

const placeOrder = async (req, res) => {
  const ts = req.tableSession;
  if (ts.status !== "open") {
    return res.status(400).json({ message: "Ordering is closed for this table. Request or complete bill." });
  }

  const { items, total } = req.body;
  if (!items?.length || total == null) return res.status(400).json({ message: "Invalid order" });

  try {
    const order = await Order.create({
      tableSessionId: ts._id,
      tableNumber: ts.tableNumber,
      items,
      total,
      status: "Pending", // Admin accept required maybe, but for now pending
    });
    
    // populate
    const populated = await Order.findById(order._id).populate("items.foodId");
    await notifyRole("admin", "New Order Received", `Table ${ts.tableNumber} placed a new order.`, "order", { tableNumber: ts.tableNumber, orderId: order._id });
    await notifyUser(ts.customer, "Order Placed", `Your order for table ${ts.tableNumber} has been sent to kitchen.`, "order", { tableNumber: ts.tableNumber, orderId: order._id });
    res.status(201).json(populated);
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ tableSessionId: req.tableSession._id })
      .populate("items.foodId")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
};

const requestBill = async (req, res) => {
  const ts = req.tableSession;
  if (ts.status !== "open") return res.status(400).json({ message: "Bill already requested or session ended." });

  const count = await Order.countDocuments({ tableSessionId: ts._id });
  if (count === 0) return res.status(400).json({ message: "No orders yet." });

  ts.status = "awaiting_payment";
  await ts.save();
  await notifyRole("admin", "Bill Requested", `Table ${ts.tableNumber} requested final bill.`, "billing", { tableNumber: ts.tableNumber });
  await notifyUser(ts.customer, "Bill Requested", `Final bill requested for table ${ts.tableNumber}.`, "billing", { tableNumber: ts.tableNumber });

  res.json({
    message: "Final bill requested. Payment: Cash upon delivery.",
    tableNumber: ts.tableNumber,
    status: ts.status,
  });
};

const completeCheckout = async (req, res) => {
    // This is optional if customer clicks checkout. 
    // They asked: "jyare final checkout kare tyare admin ne message javo joiye ke table no 1 food and payment completed".
    // Also history store thavu joiye.
    const ts = req.tableSession;
    if (ts.status !== "awaiting_payment") {
      return res.status(400).json({ message: "Request final bill first." });
    }
  
    const { rating, review, paymentMethod } = req.body || {};
    const normalizedPaymentMethod = paymentMethod === "online" ? "online" : "cash";
    await finalizeCheckout(ts, {
      paymentMethod: normalizedPaymentMethod,
      rating: rating || 0,
      review: review || "",
    });
  
    res.json({
      message: normalizedPaymentMethod === "online"
        ? "Checkout successful. Online payment received."
        : "Checkout successful. Staff will collect cash momentarily.",
      tableNumber: ts.tableNumber,
    });
};

async function finalizeCheckout(tableSession, { paymentMethod, rating = 0, review = "", stripeSessionId = "" }) {
  const existing = await CompletedBill.findOne({ tableSessionId: tableSession._id });
  if (existing) {
    if (tableSession.status !== "closed") {
      tableSession.status = "closed";
      await tableSession.save();
    }
    return existing;
  }

  const { lines, total } = await buildBillSnapshot(tableSession._id);
  if (lines.length === 0) throw new Error("Nothing to bill.");

  const completedBill = await CompletedBill.create({
    tableNumber: tableSession.tableNumber,
    tableSessionId: tableSession._id,
    customer: tableSession.customer,
    items: lines,
    total,
    paymentMethod,
    stripeSessionId: stripeSessionId || undefined,
    rating,
    review,
  });

  tableSession.status = "closed";
  await tableSession.save();
  await notifyRole("admin", "Checkout Completed", `Table ${tableSession.tableNumber} checkout completed (${paymentMethod}).`, "billing", { tableNumber: tableSession.tableNumber, paymentMethod });
  await notifyUser(tableSession.customer, "Checkout Done", `Your checkout for table ${tableSession.tableNumber} is completed.`, "success", { tableNumber: tableSession.tableNumber });
  return completedBill;
}

const createStripeCheckoutSession = async (req, res) => {
  try {
    const ts = req.tableSession;
    if (ts.status !== "awaiting_payment") {
      return res.status(400).json({ message: "Request final bill first." });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on server." });
    }

    const { lines, total } = await buildBillSnapshot(ts._id);
    if (lines.length === 0 || total <= 0) {
      return res.status(400).json({ message: "Nothing to bill." });
    }

    const baseClientUrl = String(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const successUrl = `${baseClientUrl}/orders?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseClientUrl}/orders?stripe=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: "inr",
          unit_amount: Math.round(Number(line.price || 0) * 100),
          product_data: {
            name: line.selectedOption ? `${line.name} (${line.selectedOption})` : line.name,
          },
        },
      })),
      metadata: {
        tableSessionId: String(ts._id),
        tableNumber: String(ts.tableNumber),
      },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create payment session." });
  }
};

const confirmOnlineCheckout = async (req, res) => {
  try {
    const ts = req.tableSession;
    const sessionId = String(req.body.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ message: "Stripe session id is required." });
    if (ts.status === "closed") {
      return res.json({ message: "Checkout already completed.", tableNumber: ts.tableNumber });
    }
    if (ts.status !== "awaiting_payment") {
      return res.status(400).json({ message: "Request final bill first." });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on server." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment is not completed yet." });
    }
    if (String(session.metadata?.tableSessionId || "") !== String(ts._id)) {
      return res.status(400).json({ message: "Payment session does not match this table." });
    }

    const { rating, review } = req.body || {};
    await finalizeCheckout(ts, {
      paymentMethod: "online",
      stripeSessionId: session.id,
      rating: Number(rating) || 0,
      review: String(review || ""),
    });

    return res.json({
      message: "Online payment verified and checkout completed.",
      tableNumber: ts.tableNumber,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to verify payment." });
  }
};

module.exports = {
  startTable,
  getAvailableTables,
  getSession,
  placeOrder,
  getMyOrders,
  requestBill,
  completeCheckout,
  createStripeCheckoutSession,
  confirmOnlineCheckout,
  buildBillSnapshot,
};
