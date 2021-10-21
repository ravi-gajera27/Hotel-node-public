const router = require('express').Router()
const payment = require('../controllers/payment')
const { protect } = require('../../middleware/adminAuth')

router.get('/create-order/:plan_id/:subPlan_id', protect, payment.createOrder)
router.get('/create-order/:plan_id', protect, payment.createOrder)
router.post('/verify-signature', protect, payment.verifySignature)
module.exports = router 