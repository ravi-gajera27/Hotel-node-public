const status = require('../../utils/status')
const razorpay = require('../../config/payment')
const logger = require('../../config/logger')
const { extractErrorMessage } = require('../../utils/error')
const firestore = require('firebase-admin').firestore()

exports.createOrder = async(req, res) => {
    try{
        
    let instance = razorpay.getRazorpayInstance()
    var options = {
        amount: 1000, // amount in the smallest currency unit
        currency: "INR",
        receipt: "order_rcptid_11",
      };
      instance.orders.create(options, function (err, order) {
        if(err){
            throw err
        }else{
            let data = {
                key: process.env.RAZORPAY_KEY_ID, 
                amount: 1000,
                currency: "INR",
                name: 'Peraket',
                order_id: order.order_id,
                prefill: {
                    name: req.user.f_name + ' ' + req.user.l_name,
                    email: req.user.email,
                },
               /*  theme: {
                    color: "#3399cc"
                } */
            }
            return res.status(200).json({success: true, data: data})
        }
      });
    }catch(err){
        let e = extractErrorMessage(err)
        logger.error({ label: `admin payment createOrder ${req.user.rest_id}`, message: e })
        return res
          .status(500)
          .json({ success: false, message: status.SERVER_ERROR })
    }
}