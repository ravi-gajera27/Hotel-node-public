const router = require("express").Router();
const menu = require("../controllers/menu");
const { protect } = require("../../middleware/adminAuth");

router.get("/category", protect, menu.getCategory);
router.put("/category", protect, menu.setCategory);
router.put("/update-logo/logo", protect, menu.updateLogo);
router.delete("/:id", protect, menu.deleteMenu);
router.put("/:id", protect, menu.updateMenu);
router.get("/", protect, menu.getMenu);
router.post("/", protect, menu.addMenu);

module.exports = router;
