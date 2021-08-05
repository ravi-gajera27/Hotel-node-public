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
  "/:table_no/:order_id/:cid",
  protect,
  order.getOrderByOrderId
);
router.put(
  "/set-order/:table_no/:order_id/:cid",
  protect,
  order.setOrderByOrderId
);

router.post('/:table_no', protect, order.addOrderByTableNo);
router.get('/:table_no', protect, order.getOrderByTableNo);
router.put('/:table_no', protect, order.setOrderByTableNo);
router.delete('/:table_no', protect, order.cancelAllOrderByTableNo);


module.exports = router;
