const admin = require("firebase-admin");
const firestore = admin.firestore();

const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const { CustomerModel } = require("../../models/customer");
const moment = require("moment");

exports.getUsers = async (req, res) => {
  await CustomerModel.find(
    {
      rest_details: { $elemMatch: { rest_id: req.user.rest_id } },
    },
    { "rest_details.rest_id": 0 }
  )
    .then((data) => {
      res.status(200).json({ data: data, success: true });
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin user getUser ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getUsersReviews = async (req, res) => {
  let interval = req.params.interval;

  if (!interval) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  interval = interval.split("_");

  if (interval.length != 2) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let start_date = interval[0];
  let end_date = interval[1];

  CustomerModel.aggregate([
    {
      $match: {
        rest_details: {
          $elemMatch: {
            $and: [
              { rest_id: req.user.rest_id },
              { review: { $exists: true } },
              { $gte: { last_visit: start_date } },
              { $lte: { last_visit: end_date } },
            ],
          },
        },
      },
    },
    {
      $project: {
        rest_details: {
          $filter: {
            input: "$rest_details",
            as: "rest_details",
            cond: { $eq: ["$$rest_details.rest_id", req.user.rest_id] },
          },
        },
        cname: 1,
        _id: 0,
      },
    },
  ])
    .then((data) => {
      let starObj = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
      let avgRating = 0;
      let newData = [];
      if (data.length != 0) {
        for (let ele of data) {
          let details = { ...ele.rest_details[0] };
          newData.push({ cname: ele.cname, ...details });
          let rating = details.review.rating;
          if (rating) {
            starObj[`star${rating}`]++;
            avgRating += Number(rating);
          }
        }
      }
      return res.status(200).json({
        data: {
          avgRating: avgRating ? avgRating / data.length : 0,
          reviewList: newData,
          starCount: starObj,
        },
        success: true,
      });
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin user getUser ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getWPMessage = (req, res) => {
  try {
    let credentialDoc = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("credentials")
      .get();

    if (!credentialDoc.exists) {
      return res.status(403).json({
        success: false,
        message: "If you wanna Send messages, please contact us",
      });
    }

    let credData = credentialDoc.data();

    if (!credData.auth_token || !credData.account_sid) {
      return res.status(403).json({
        success: false,
        message: "If you wanna Send messages, please contact us",
      });
    }

    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("message")
      .get()
      .then((data) => {
        res.status(200).json({ data: data?.data()?.wp || {}, success: true });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin user getWPMessage ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.updateWPMessage = (req, res) => {
  try {
    console.log(req.body.msg);
    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("message")
      .set({ wp: req.body.msg }, { merge: true })
      .then((resp) => {
        res.status(200).json({ message: "Successfully Saved", success: true });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin user updateWPMessage ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getTextMessage = (req, res) => {
  try {
    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("message")
      .get()
      .then((data) => {
        res.status(200).json({ data: data.data().text, success: true });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin user getTextMessage ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getALLMessage = (req, res) => {
  try {
    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("message")
      .get()
      .then((data) => {
        res.status(200).json({ data: data.data(), success: true });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin user getALLMessage ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    let customers = await CustomerModel.find(
      {
        $and: [
          {
            dob: moment()
              .utcOffset(process.env.UTC_OFFSET)
              .format("YYYY-MM-DD"),
          },
          { rest_details: { $elemMatch: { rest_id: req.user.rest_id } } },
        ],
      },
      { "rest_details.rest_id": 0 }
    );

    if (customers.length == 0) {
      return res
        .status(200)
        .json({ success: true, message: "No one has birthday today !!!" });
    }

    let credentialDoc = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("credentials")
      .get();

    let credData = credentialDoc.data();

    if (!credData.auth_token || !credData.account_sid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    const client = await require("twilio")(
      credData.account_sid,
      credData.auth_token
    );

    let socialDoc = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("message")
      .get();

    let messageData = socialDoc.data();

    for (let cust of customers) {
      let wpMessage = messageData.wp;

      wpMessage = wpMessage.replace(new RegExp("%name%", "g"), cust.cname);

      if (req.body.wp) {
        await client.messages.create({
          body: wpMessage,
          from: `whatsapp:${credData.wp_no}`,
          to: `whatsapp:+91${cust.mobile_no}`,
        });
      }
      if (req.body.sms) {
        await client.messages.create({
          body: wpMessage,
          from: `${credData.sms_no}`,
          to: `+91${cust.mobile_no}`,
        });
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Successfully Sent" });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin user sendMessage ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.updateTextMessage = (req, res) => {
  try {
    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("social")
      .doc("message")
      .set({ text: req.body.msg }, { merge: true })
      .then((resp) => {
        res.status(200).json({ message: "Successfully Saved", success: true });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin user updateTextMessage ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};
