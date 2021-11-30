const router = require("express").Router();
const auth = require("../controllers/auth");
const { protect } = require("../../middleware/adminAuth");
const { checkForLogin, checkForSignup } = require("../../utils/zone");

router.post("/login", checkForLogin, auth.login);
router.post("/signup", checkForSignup, auth.signup);
router.get("/user", protect, auth.getUser);
router.get("/admin/login-activities", protect, auth.getLoginActivities);
router.put("/verify-otp", protect, auth.verifyOtp);
router.post("/rest-details", protect, auth.restaurantRegister);
router.get("/admin", protect, auth.getAdminList);
router.post("/admin", protect, auth.addAdmin);
router.get(
  "/restaurant-step/service-plans",
  protect,
  auth.getRestaurantStepServicePlans
);
router.get("/service-plans", protect, auth.getServicePlans);
router.delete("/admin/:email", protect, auth.removeAdmin);
router.get("/captain", protect, auth.getCaptainList);
router.post("/captain", protect, auth.addCaptain);
router.delete("/captain/:email", protect, auth.removeCaptain);
router.put("/rest-details", protect, auth.updateRestaurantDetails);
router.get("/rest-details/rest-tables", protect, auth.getRestTablesDetails);
router.put("/rest-details/postpaid-plan", protect, auth.continueWithPostPaid);
router.put("/rest-details/:tables", protect, auth.updateRestaurantDetails);
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
