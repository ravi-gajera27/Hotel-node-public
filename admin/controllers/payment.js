const status = require("../../utils/status");
const razorpay = require("../../config/payment");
const logger = require("../../config/logger");
const { extractErrorMessage } = require("../../utils/error");
const firestore = require("firebase-admin").firestore();
const moment = require("moment");

exports.createOrder = async (req, res) => {
  try {
    let plan_id = req.params.plan_id;
    let subPlan_id = req.params.subPlan_id;

    if(!plan_id){
      return res.status(400).json({success: true, message: status.BAD_REQUEST})
    }

    let subsObj = {};

    let planDoc = await firestore
      .collection("general")
      .doc("subscriptions")
      .get();

    let subsRef = firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("subscription");

    let plans = planDoc.data().plans;

    let planIndex = plans
      .map((e) => {
        return e.id;
      })
      .indexOf(plan_id);

    if (planIndex == -1) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (plans[planIndex] && !plans[planIndex].type) {
      subsObj.plan_id = plan_id;
      subsObj.price = 0;
      start_date = moment()
        .utcOffset(process.env.UTC_OFFSET)
        .format("YYYY-MM-DD");
      end_date = moment()
        .utcOffset(process.env.UTC_OFFSET)
        .add(plans[planIndex].days, "days")
        .format("YYYY-MM-DD");
      subsObj.rest_id = req.user.rest_id;

      await subsRef.add({ ...subsObj }).then(async (e) => {
        await firestore
          .collection("restaurants")
          .doc(req.user.rest_id)
          .set({ subs_id: e.id });
        return res.status(200).json({
          success: true,
          message: "Your free trial has been started",
        });
      });
    }

    let subPlanIndex = plans[planIndex].type
      .map((e) => {
        return e.value;
      })
      .indexOf(subPlan_id);
    if (subPlanIndex == -1) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let planType = plans[planIndex].type[subPlanIndex];

    let instance = razorpay.getRazorpayInstance();
    var options = {
      amount: 1 || Number(planType.price) * 100, // amount in the smallest currency unit
      currency: "INR",
      receipt: plans[planIndex].name + " " + planType.name,
    };
    instance.orders.create(options, function (err, order) {
      if (err) {
        throw err;
      } else {
        console.log(order);
        let data = {
          key: process.env.RAZORPAY_KEY_ID,
          amount: 1 | Number(planType.price) * 100,
          currency: "INR",
          name: "HungerCodes",
          order_id: order.id,
          prefill: {
            name: req.user.f_name + " " + req.user.l_name,
            email: req.user.email,
          },
          /*  theme: {
                    color: "#3399cc"
                } */
        };
        let month = Number(planType.value.split("m")[1]);
        subsObj = {
          plan_id: plan_id,
          plan_name: plans[planIndex].name,
          duration: planType.value,
          order_id: order.id,
          start_date: moment()
            .utcOffset(process.env.UTC_OFFSET)
            .format("YYYY-MM-DD"),
          end_date: moment()
            .utcOffset(process.env.UTC_OFFSET)
            .add(month, "month")
            .format("YYYY-MM-DD"),
          payment: false,
        };

        firestore
          .collection("restaurants")
          .doc(req.user.rest_id)
          .collection("subscription")
          .add({ ...subsObj })
          .then(
            (e) => {
              return res.status(200).json({ success: true, data: data });
            },
            (err) => {
              throw err;
            }
          );
      }
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin payment createOrder ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.verifySignature = async (req, res) => {
  try {
    let data = req.body;
    let order_id = data.razorpay_order_id;
    let payment_id = data.razorpay_payment_id;
    let signature = data.razorpay_signature;

    let subsRef = firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("subscription");

    let subsDocs = await subsRef
      .where("order_id", "==", order_id)
      .limit(1)
      .get();

    if (subsDocs.empty) {
      return res.status(400).json({
        success: false,
        message:
          "Signature is not verified !!, If amount is debited from your account then please contact us",
      });
    }

    let subDoc = subsDocs.docs[0];
    let subData = subDoc.data();
    let subId = subDoc.id;
    subData.payment_id = payment_id;
    subData.signature = signature;
    subData.payment = true;
    
    await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .set({ subs_id: subId }, { merge: true });

    subsRef
      .doc(subId)
      .set({ ...subData })
      .then((e) => {
        res.status(200).json({
          success: true,
          message: "Payment process is successfully done",
        });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin payment verifySignature ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};
