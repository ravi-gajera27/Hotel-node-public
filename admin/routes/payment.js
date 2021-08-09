const router = require('express').Router()
const payment = require('../controllers/payment')
const { protect } = require('../../middleware/adminAuth')

router.get('/create-order', protect, payment.createOrder)

module.exports = router 