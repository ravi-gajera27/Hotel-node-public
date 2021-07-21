const router = require("express").Router();
const auth = require("../controllers/auth");
const { protect } = require("../../middleware/adminAuth");

router.post("/login", auth.login);
router.post("/signup", auth.signup);
router.get("/user", protect, auth.getUser);
router.put("/verify-otp", protect, auth.verifyOtp);
router.post("/rest-details", protect, auth.restaurantRegister);
router.get("/admin", protect, auth.getAdminList);
router.post("/admin", protect, auth.addAdmin);
router.delete("/admin/:email", protect, auth.removeAdmin);
router.put("/rest-details", protect, auth.updateRestaurantDetails);
router.put("/step-rest-details", protect, auth.updateStepRestaurantDetaials);
router.put("/step-menu-details", protect, auth.addMenuFileRestStep);
router.post("/reset-password", protect, auth.resetPassword);
router.put("/forgot-password", auth.forgotPasswordCheckMail);
router.put(
  "/forgot-password/verification-code",
  auth.checkVerificationCodeForForgotPass
);
router.put("/change-password", auth.changePassword);
router.get("/rest-details", protect, auth.getRestDetails);

module.exports = router;
