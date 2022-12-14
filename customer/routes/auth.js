const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/customerAuth')
const { checkForLogin, checkForSignup }=require('../../utils/zone')

router.post('/login', checkForLogin, auth.login)
router.post('/signup', checkForSignup, auth.signup)
router.get('/user', protect, auth.getUser)
router.get('/verify-session/:members', protect, auth.verifySession)
router.get('/verify-session', protect, auth.verifySession)
router.put('/remove-customer', protect, auth.removeCustomerFromTable)
router.put('/verify-otp', protect, auth.verifyOtp)
router.get('/get-logo-url', auth.getLogoUrl)
router.put("/forgot-password", auth.forgotPasswordCheckMail);
router.put(
  "/forgot-password/verification-code",
  auth.checkVerificationCodeForForgotPass
);
router.put("/change-password", auth.changePassword);
module.exports = router