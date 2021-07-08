const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/superAdminAuth')

router.post('/login', auth.login)
module.exports = router