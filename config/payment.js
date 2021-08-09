const Razorpay = require("razorpay");

let instance

exports.InitializePaymentGetway = async () => {
  instance = await new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};


exports.getRazorpayInstance = () => {
    return instance
}