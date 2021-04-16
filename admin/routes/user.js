const router = require('express').Router()
const user = require('../controllers/user')
const { protect } = require('../../middleware/adminAuth')

router.get('/', protect, user.getUsers)
module.exports = router