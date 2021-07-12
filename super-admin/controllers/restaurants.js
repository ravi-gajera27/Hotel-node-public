const firestore = require("firebase-admin").firestore();
const status = require("../../utils/status");
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY);

exports.getRestaurantsList = async (req, res) => {
  let restRef = await firestore
    .collection("restaurants")
    .where("verified", "==", true)
    .get();

  let rest_list = [];

  for (let rest of restRef.docs) {
    let data = rest.data();
    data.id = rest.id;
    delete data.customers;

    rest_list.push(data);
  }

  res.status(200).json({ success: true, data: rest_list });
};

exports.getRestaurantsRequestList = async (req, res) => {
  let restRef = await firestore
    .collection("restaurants")
    .where("verified", "!=", true)
    .get();

  let rest_list = [];

  for (let rest of restRef.docs) {
    let data = rest.data();
    data.id = rest.id;
    delete data.customers;

    rest_list.push(data);
  }

  res.status(200).json({ success: true, data: rest_list });
};

exports.verifyRestaurantById = async (req, res) => {
  let id = req.params.id;
  restRef = await firestore
    .collection("restaurants")
    .doc(id)
    .set({ verified: true }, { merge: true })
    .then((e) => {
      res.status(200).json({ success: true, message: "Successfully Verified" });
    })
    .catch((err) => {
      res.status(500).json({ success: true, message: status.SERVER_ERROR });
    });
};
