const admin = require("firebase-admin");
const firestore = admin.firestore();

const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const { CustomerModel } = require("../../models/customer");
exports.getUsers = (req, res) => {
  CustomerModel.find({ rest_id: req.user.rest_id })
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

exports.getUsersReviews = (req, res) => {
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
        $and: [
          { rest_id: req.user.rest_id },
          { last_visit: { $gte: start_date } },
          { last_visit: { $lte: end_date } },
          { "review.rating": { $ne: undefined } },
        ],
      },
    },
    /*   {
      $addFields: {
        avgStar: { $avg: "$review.ratting" },
      },
    },
    {
      $project: { cname: 1, review: 1},
    }, */
    {
      $group: {
        _id: null,
        documents: { $push: { cname: "$cname", review: "$review" } },
        avgRating: { $avg: "$review.rating" },
      },
    },
  ])
    .then((data) => {
      console.log(data);
      let starObj = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
      if (data.length != 0) {
        for (let ele of data[0]?.documents) {
          let rating = ele.review.rating;
          if (rating) {
            starObj[`star${rating}`]++;
          }
        }
      }
      res.status(200).json({
        data: {
          avgRating: data[0]?.avgRating || 0,
          reviewList: data[0]?.documents || [],
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
