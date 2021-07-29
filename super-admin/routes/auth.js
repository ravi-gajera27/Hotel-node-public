const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/superAdminAuth')
const { checkForLogin }=require('../../utils/zone')

router.post('/login', checkForLogin, auth.login)
module.exports = router