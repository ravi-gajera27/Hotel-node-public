const router = require('express').Router()
const stats = require('../controllers/stats')
const { protect } = require('../../middleware/adminAuth')

router.get('/invoices', protect, stats.getInvoices)
router.get('/download-invoice/:id', protect, stats.downloadInvoicePdf)

module.exports = router