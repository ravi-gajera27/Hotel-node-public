const router = require("express").Router();
const custAuth = require("../controllers/custAuth");
const { protect } = require("../../middleware/adminAuth");

router.put("/accept-request/:cid", protect, custAuth.acceptRequest);
router.put("/reject-request/:cid", protect, custAuth.rejectRequest);
router.put("/block-request/:cid", protect, custAuth.blockCustomer);
router.get(
  "/restore-customer/:table_no/:cid",
  protect,
  custAuth.restoreCustomer
);
router.get(
  "/checkout-customer/:table_no/:cid",
  protect,
  custAuth.checkoutCustomer
);
router.put("/invoice/:invoice_id", protect, custAuth.updateInvoice);
router.put("/cleanup-customer/table_no/:cid", protect, custAuth.cleanUpCustomers);
router.delete(
  "/remove-customer/:table_no/:cid",
  protect,
  custAuth.removeCustomer
);

module.exports = router;
