const router = require('express').Router()
const menu = require('../controllers/menu')
const { protect } = require('../../middleware/adminAuth')

router.get('/', protect, menu.getMenu)

module.exports = router