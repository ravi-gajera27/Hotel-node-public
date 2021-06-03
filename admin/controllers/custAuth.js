const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const moment = require("moment");

exports.acceptRequest = async (req, res, next) => {
  let takeawayRef = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("takeaway")
    .doc("users");

  let customers = (await takeawayRef.get()).data().customers;

  customers.map((cust) => {
    if (cust.cid == req.params.cid) {
      cust.req = true;
    }
  });

  await takeawayRef.set({ customers: [...customers] }, { merge: true });

  res.status(200).json({ success: true, message: status.ACCEPT_REQUEST_ADMIN });
};

exports.rejectRequest = async (req, res, next) => {
  let takeawayRef = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("takeaway")
    .doc("users");

  let customers = (await takeawayRef.get()).data().customers;

  customers = customers.filter((cust) => cust.cid != req.params.cid);

  let userRef = await firestore.collection("users").doc(req.params.cid);

  await userRef.set({ join: "" }, { merge: true });

  await takeawayRef.set({ customers: [...customers] }, { merge: true });

  res.status(200).json({ success: true, message: status.REJECT_REQUEST_ADMIN });
};

exports.blockCustomer = async (req, res, next) => {
  let takeawayRef = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("takeaway")
    .doc("users");

  let customers = (await takeawayRef.get()).data().customers;

  customers = customers.filter((cust) => cust.cid != req.params.cid);

  let userRef = await firestore.collection("users").doc(req.params.cid);

  let blocked = moment().utcOffset(process.env.UTC_OFFSET).format("yyyy-mm-dd");

  await takeawayRef.set({ customers: [...customers] }, { merge: true });

  await userRef.set({ blocked: blocked, join: "" }, { merge: true });

  res.status(200).json({ success: true, message: status.REJECT_REQUEST_ADMIN });
};
