const router = require('express').Router()
const menu = require('../controllers/menu')
const { protect } = require('../../middleware/adminAuth')

router.get('/category', protect, menu.getCategory)
router.put('/category', protect, menu.setCategory)
router.get('', protect, menu.getMenu)
router.put('/:id', protect, menu.updateMenu)
router.post('', protect, menu.addMenu)
router.delete('/:id', protect, menu.deleteMenu)

module.exports = router