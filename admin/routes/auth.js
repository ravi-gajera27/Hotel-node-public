const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/adminAuth')

router.post('/login', auth.login)
router.post('/signup', auth.signup)
router.get('/user', protect, auth.getUser)
router.put('/verify-otp', protect, auth.verifyOtp)
router.post('/rest-details', protect, auth.restaurantRegister)
router.get('/admin', protect, auth.getAdminList)
router.post('/admin', protect, auth.addAdmin)
router.delete('/admin', protect, auth.removeAdmin)
router.put('/rest-details', protect, auth.updateRestaurantDetaials)
router.post('/reset-password', protect, auth.resetPassword)

module.exports = router