const express = require("express");
const {
  startTable,
  getAvailableTables,
  getSession,
  placeOrder,
  getMyOrders,
  requestBill,
  completeCheckout,
  createStripeCheckoutSession,
  confirmOnlineCheckout,
} = require("../controllers/tableController");
const { tableSessionAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/start", startTable);
router.get("/available", getAvailableTables);
router.get("/session", getSession);
router.post("/order", tableSessionAuth, placeOrder);
router.get("/my-orders", tableSessionAuth, getMyOrders);
router.post("/request-bill", tableSessionAuth, requestBill);
router.post("/stripe/create-session", tableSessionAuth, createStripeCheckoutSession);
router.post("/stripe/confirm", tableSessionAuth, confirmOnlineCheckout);
router.post("/complete-checkout", tableSessionAuth, completeCheckout);

module.exports = router;
