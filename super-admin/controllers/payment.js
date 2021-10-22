const firestore = require("firebase-admin").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY);

exports.restaurantLockedAPI = async (req, res) => {
  try {
    let success = await this.lockedRestaurant();
    if (success == true) {
      res.status(200).json({ success: true, message: status.INVOICE_GEN });
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `super-admin payment restaurantLockedAPI ${req.user.id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.restaurantLockByRestId = async (req, res) => {
  let rest_id = req.params.rest_id;
  try {
    if (!rest_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    await firestore
      .collection("restaurants")
      .doc(rest_id)
      .set({ locked: true }, { merge: true })
      .then((e) => {
        res.status(200).json({ success: true, message: status.LOCKED_REST });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `super-admin payment restaurantLockedByRestId  user: ${req.user.id} rest: ${rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};
exports.restaurantUnLockByRestId = async (req, res) => {
  let rest_id = req.params.rest_id;
  try {
    if (!rest_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    await firestore
      .collection("restaurants")
      .doc(rest_id)
      .set({ locked: false }, { merge: true })
      .then((e) => {
        res.status(200).json({ success: true, message: status.UNLOCKED_REST });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `super-admin payment restaurantLockedByRestId  user: ${req.user.id} rest: ${rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.lockedRestaurant = async () => {
  try {
    console.log("calll locked fun");
    let restaurantsDoc = await firestore
      .collection("restaurants")
      .where("locked", "!=", true)
      .get();

    for (let rest of restaurantsDoc.docs) {
      let rest_id = rest.id;
      if (rest.subs_id) {
        let locked = false;
        let subRef = await firestore
          .collection("restaurants")
          .doc(rest_id)
          .collection("subscription")
          .doc(rest.subs_id)
          .get();

        if (!subRef.exists) {
          locked = true;
        } else {
          let data = subRef.data();

          if (
            !data.payment ||
            !data.payment_id ||
            !data.order_id ||
            !data.signature
          ) {
            locked = true;
            if (data.price == 0) {
              if (
                data.end_date <
                moment().utcOffset(process.env.UTC_OFFSET).unix()
              ) {
                locked = true;
              } else {
                locked = false;
              }
            }
          } else {
            let generated_signature = hmac_sha256(
              order_id + "|" + razorpay_payment_id,
              process.env.RAZORPAY_KEY_SECRET
            );
            if (generated_signature != data.signature) {
              locked = true;
            } else if (
              data.end_date < moment().utcOffset(process.env.UTC_OFFSET).unix()
            ) {
              locked = true;
            }
          }
        }

        if (locked) {
          await firestore
            .collection("restaurants")
            .doc(rest_id)
            .set({ locked: true }, { merge: true });
        }
      } else {
        await firestore
          .collection("restaurants")
          .doc(rest_id)
          .set({ locked: true }, { merge: true });
      }
    }

    let locked = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format("DD MMM, YYYY hh:mm A");

    console.log("locked cron ", locked);
    return true;
  } catch (err) {
    throw err;
  }
};

exports.getRestaurantsWithoutPayment = async (req, res) => {
  let paymentReqDoc = await firestore.collection("paymentReq").get();
  let restaurants = [];

  for (let req of paymentReqDoc.docs) {
    restaurants.push(req.data());
  }

  res.status(200).json({ success: true, data: restaurants });
};
