const router = require("express").Router();
const stats = require("../controllers/stats");
const { protect } = require("../../middleware/adminAuth");

router.get("/invoices", protect, stats.getInvoices);
router.get("/invoices/:interval", protect, stats.getInvoicesByInterval);
router.get("/download-invoice/:inv_id", protect, stats.downloadInvoicePdf);
router.get("/sales-report/:interval", protect, stats.downloadSalesReportPdf);
router.get("/generate-eod/:interval", protect, stats.downloadEodPdf);
router.get("/category/:interval", protect, stats.getCategoriesStats);
router.get("/advance/:slot/:interval", protect, stats.getAdvanceStats);
router.get("/basics/:interval", protect, stats.getBasicsByInterval);
router.get("/home", protect, stats.getHomeForOwner);
module.exports = router;
