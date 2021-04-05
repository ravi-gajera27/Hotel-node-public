const router = require('express').Router()
const menu = require('../controllers/menu')
const { protect } = require('../../middleware/adminAuth')

router.get('/category', protect, menu.getCategory)
router.post('/category', protect, menu.addCategory)
router.put('/category/:id', protect, menu.setCategory)
router.get('', protect, menu.getMenu)
router.put('/:id', protect, menu.updateMenu)
router.post('', protect, menu.addMenu)
router.delete('/:id', protect, menu.deleteMenu)
router.delete('/:id/:img_url', protect, menu.deleteMenu)
module.exports = router