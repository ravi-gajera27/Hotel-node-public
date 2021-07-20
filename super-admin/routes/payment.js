const router = require('express').Router()
const payment = require('../controllers/payment')
const { protect } = require('../../middleware/superAdminAuth')

router.get('/generate-invoice', protect, payment.generateInvoiceAPI)
router.get('/generate-invoice/:rest_id', protect, payment.generateInvoiceByRestId)
router.get('/locked-restaurant', protect, payment.restaurantLockedAPI)
router.get('/locked-restaurant/:rest_id', protect, payment.restaurantLockedByRestId)
router.get('/restaurants-without-payment', protect, payment.getRestaurantsWithoutPayment)
module.exports = router