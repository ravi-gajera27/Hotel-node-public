const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/auth')

router.post('/add', auth.login)
router.get('', protect, auth.getUser)
router.put('/verify-otp', protect, auth.verifyOtp)

module.exports = router