const router = require("express").Router();
const user = require("../controllers/user");
const { protect } = require("../../middleware/adminAuth");

router.get("/", protect, user.getUsers);
router.get("/review/:interval", protect, user.getUsersReviews);
router.get("/message/wp", protect, user.getWPMessage);
router.get("/message/wp", protect, user.getWPMessage);
router.get("/message", protect, user.getALLMessage);
router.get("/message/text", protect, user.getTextMessage);
router.post("/message/send", protect, user.sendMessage);
router.put("/message/wp", protect, user.updateWPMessage);
router.put("/message/text", protect, user.updateTextMessage);
module.exports = router;
