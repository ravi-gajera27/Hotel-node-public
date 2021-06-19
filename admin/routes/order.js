const router = require("express").Router();
const order = require("../controllers/order");
const { protect } = require("../../middleware/adminAuth");

router.delete(
  "/cancel-order/:table_no/:order_no/:cid",
  protect,
  order.cancelOrder
);
router.get(
  "/restore-order/:table_no/:order_no/:cid",
  protect,
  order.restoreOrder
);
router.get(
  "/:table_no/:order_no/:cid",
  protect,
  order.getOrderByOrderNo
);
router.put(
  "/checkout-customer/:table_no/:cid",
  protect,
  order.checkoutCustomer
);
router.get("/generate-invoice/:invoice_id", protect, order.generateInvoice);

module.exports = router;
