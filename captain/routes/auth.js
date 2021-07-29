const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/captainAuth')
const { checkForLogin, checkForSignup } = require('../../utils/zone')

router.post('/login', checkForLogin, auth.login)

router.get('/tables', protect, auth.getTables)

router.get('/user', protect, auth.getUser)

module.exports = router
