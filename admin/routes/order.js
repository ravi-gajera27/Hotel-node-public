const router = require('express').Router()
const order = require('../controllers/order')
const { protect } = require('../../middleware/adminAuth')

router.get('/cancel-order/:table_no/:order_no', protect, order.cancelOrder)
router.get('/terminate-session/:table_no', protect,  order.terminateSession)
router.post('/checkout-customer/:table_no', protect, order.checkoutCustomer)

module.exports = router