const router = require('express').Router()
const order = require('../controllers/order')
const { protect } = require('../../middleware/adminAuth')

router.get('/cancel-order/:table_no/:order_no', protect, order.cancelOrder)
router.get('/terminate-session/:table_no', protect,  order.terminateSession)
router.put('/checkout-customer/:table_no/:user_id', protect, order.checkoutCustomer)

module.exports = router