const router = require('express').Router()
const custAuth = require('../controllers/custAuth')
const { protect } = require('../../middleware/adminAuth')

router.get('/accept-request/:cid', protect, custAuth.acceptRequest)
router.get('/reject-request/:cid', protect,  custAuth.rejectRequest)
router.put('/block-request/:cid', protect, custAuth.blockCustomer)


module.exports = router