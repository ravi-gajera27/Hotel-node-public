const router = require('express').Router()
const rest = require('../controllers/restaurants')
const { protect } = require('../../middleware/superAdminAuth')

router.get('/', protect, rest.getRestaurantsList);
router.get('/request', protect, rest.getRestaurantsRequestList);
router.put('/verify/:id', protect, rest.verifyRestaurantById);
router.get('/:rest_id', protect, rest.getRestaurantById);

module.exports = router