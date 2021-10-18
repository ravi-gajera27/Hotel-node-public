const router = require('express').Router()
const payment = require('../controllers/payment')
const { protect } = require('../../middleware/superAdminAuth')

router.get('/locked-restaurant', protect, payment.restaurantLockedAPI)
router.get('/lock-restaurant/:rest_id', protect, payment.restaurantLockByRestId)
router.get('/unlock-restaurant/:rest_id', protect, payment.restaurantUnLockByRestId)
router.get('/restaurants-without-payment', protect, payment.getRestaurantsWithoutPayment)
module.exports = router