const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/customerAuth')

router.post('/login', auth.login)
router.post('/signup', auth.signup)
router.get('/user', protect, auth.getUser)
router.get('/verify-session', protect, auth.verifySession)
router.put('/verify-otp', protect, auth.verifyOtp)
router.put("/forgot-password", auth.forgotPasswordCheckMail);
router.put(
  "/forgot-password/verification-code",
  auth.checkVerificationCodeForForgotPass
);
router.put("/change-password", auth.changePassword);
module.exports = router