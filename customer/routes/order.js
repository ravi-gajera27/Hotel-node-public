const router = require('express').Router()
const order = require('../controllers/order')
const { protect } = require('../../middleware/customerAuth')

router.post('/place-order', protect, order.addOrder)
router.get('/get-order', protect, order.getOrder)
router.post('/checkout', protect, order.checkout)

module.exports = router