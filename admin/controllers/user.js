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
