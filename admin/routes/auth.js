const router = require('express').Router()
const auth = require('../controllers/auth')
const { protect } = require('../../middleware/auth')

router.post('/login', auth.login)
router.post('/signup', auth.signup)
router.get('/user', protect, auth.getUser)
module.exports = router