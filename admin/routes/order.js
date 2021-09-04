const router = require("express").Router();
const order = require("../controllers/order");
const { protect } = require("../../middleware/adminAuth");

router.get("/generate-invoice/:inv_id", protect, order.generateInvoice);

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
  "/get-order-id/:table_no/:order_id/:cid",
  protect,
  order.getOrderByOrderId
);
router.put(
  "/set-order/:table_no/:order_id/:cid",
  protect,
  order.setOrderByOrderId
);

router.put(
  "/cancel-order/:table_no/:order_id/:cid/:type",
  protect,
  order.cancelOrder
);
router.get(
  "/restore-order/:table_no/:order_id/:cid/:type",
  protect,
  order.restoreOrder
);
router.get(
  "/get-order-id/:table_no/:order_id/:cid/:type",
  protect,
  order.getOrderByOrderId
);
router.put(
  "/set-order-id/:table_no/:order_id/:cid/:type",
  protect,
  order.setOrderByOrderId
);

router.post(
  "/add-order-table-cid/:table_no/:cid",
  protect,
  order.addOrderByTableNo
);
router.post(
  "/add-order-table/:table_no/:type",
  protect,
  order.addOrderByTableNo
);
router.post("/add-order-table/:table_no", protect, order.addOrderByTableNo);
router.post(
  "/add-order-table/:table_no/:cid/:type",
  protect,
  order.addOrderByTableNo
);

router.get("/get-order-table/:table_no", protect, order.getOrderByTableNo);
router.put("/set-order-table/:table_no", protect, order.setOrderByTableNo);
router.delete("/:table_no/:cid", protect, order.cancelAllOrderByTableNo);

router.get(
  "/get-order-table/:table_no/:type",
  protect,
  order.getOrderByTableNo
);
router.put(
  "/set-order-table/:table_no/:type",
  protect,
  order.setOrderByTableNo
);
router.delete("/:table_no/:cid/:type", protect, order.cancelAllOrderByTableNo);

module.exports = router;
