const router = require('express').Router()
const stats = require('../controllers/stats')
const { protect } = require('../../middleware/adminAuth')

router.get('/invoices', protect, stats.getInvoices)
router.get('/invoices/:interval', protect, stats.getInvoicesByInterval)
router.get('/download-invoice/:id', protect, stats.downloadInvoicePdf)
router.get('/generate-eod/:date', protect, stats.downloadEodPdf)
router.get('/category/:interval', protect, stats.getCategoriesStats)
router.get('/advance/:slot/:interval', protect, stats.getAdvanceStats)
router.get('/basics/:interval', protect, stats.getBasicsByInterval)

module.exports = router 