const router = require('express').Router()
const order = require('../controllers/order')
const { protect } = require('../../middleware/adminAuth')

router.post('/add-order/:table_no', protect, order.addOrder)
router.post('/add-order/:table_no/:type', protect, order.addOrder)

module.exports = router
