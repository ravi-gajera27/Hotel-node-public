const admin = require("firebase-admin");
const firestore = admin.firestore();

const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { extractErrorMessage }=require('../../utils/error')
const logger=require('../../config/logger')
exports.getUsers = (req, res) => {
    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("users")
      .get()
      .then((resp) => {
        let data = [];
  
        for (let ele of resp.docs) {
          let temp = ele.data();
          temp.id = ele.id;
          data.push(temp);
        }
        res.status(200).json({ data: data, success: true });
      })
      .catch((err) => {
          let e = extractErrorMessage(err)
          logger.error({
            label: `admin user getUser ${req.user.rest_id}`,
            message: e,
          })
          return res
            .status(500)
            .json({ success: false, message: status.SERVER_ERROR })
      });
  };