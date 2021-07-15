const router = require("express").Router();
const order = require("../controllers/order");
const { protect } = require("../../middleware/adminAuth");

router.put(
  "/cancel-order/:table_no/:order_id/:cid",
  protect,
  order.cancelOrder
);
router.get(
  "/restore-order/:table_no/:order_id/:cid",
  protect,
  order.restoreOrder
);
router.get(
  "/:table_no/:order_id/:cid",
  protect,
  order.getOrderByOrderId
);
router.put(
  "/set-order/:table_no/:order_id/:cid",
  protect,
  order.setOrderByOrderId
);
router.post("/generate-invoice", protect, order.generateInvoice);

module.exports = router;
