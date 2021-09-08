const router = require("express").Router();
const menu = require("../controllers/menu");
const { protect } = require("../../middleware/adminAuth");

router.get("/category", protect, menu.getCategory);
router.post("/category", protect, menu.addCategory);
router.put("/category/:id", protect, menu.setCategory);
router.put("/update-logo/logo", protect, menu.updateLogo);
router.post("/menu-file", protect, menu.addMenuFile);
router.delete("/:id", protect, menu.deleteMenu);
router.put("/:id", protect, menu.updateMenu);
router.get("/", protect, menu.getMenu);
router.post("/", protect, menu.addMenu);

module.exports = router;
