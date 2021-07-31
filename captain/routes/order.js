const router = require('express').Router()
const order = require('../controllers/order')
const { protect } = require('../../middleware/captainAuth')

router.post('/add-order/:table_no', protect, order.addOrder)

module.exports = router
