const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/adminAuth')

router.post('/login', auth.login)
router.post('/signup', auth.signup)
router.get('/user', protect, auth.getUser)
router.put('/verify-otp', protect, auth.verifyOtp)

module.exports = router