const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/adminAuth')
const { checkForLogin, checkForSignup } = require('../../utils/zone')

router.post('/login', checkForLogin, auth.login)

router.get('/user', protect, auth.getUser)

router.post('/verify-session', protect, auth.verifySession)

module.exports = router
