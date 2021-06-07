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

  let blocked = moment().utcOffset(process.env.UTC_OFFSET).format("YYYY-MM-DD");

  await takeawayRef.set({ customers: [...customers] }, { merge: true });

  await userRef.set({ blocked: blocked, join: "" }, { merge: true });

  res.status(200).json({ success: true, message: status.REJECT_REQUEST_ADMIN });
};

exports.removeCustomer = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no || !cid) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let orderRef;
  let customersRef;

  if (table_no == "takeaway") {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);

    customersRef = await firestore
      .collection(`restaurants`)
      .doc(req.user.rest_id)
      .collection("takeaway")
      .doc("users");
  } else {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);

    customersRef = await firestore
      .collection(`restaurants`)
      .doc(req.user.rest_id);
  }

  let order = await orderRef.get();

  let data = await customersRef.get();
  customers = data.data().customers;

  let newCustomers = [];

  for (let cust of customers) {
    if (cust.restore) {
      continue;
    }
    if (cust.table == table_no && cust.cid == cid) {
      cust.restore = true;
    }
    newCustomers.push(cust);
  }

  await customersRef.set(
    {
      customers: newCustomers,
    },
    { merge: true }
  );

  if (order.exists) {
    await orderRef
      .set({ restore: true }, { merge: true })
      .then(async (e) => {
        await firestore
          .collection("users")
          .doc(`${cid}`)
          .set({ join: "" }, { merge: true });

        return res.status(200).json({
          success: true,
          message: `Sessoin from table-${table_no} is successfully terminated`,
        });
      })
      .catch((err) => {
        console.log("catchh");
        return res
          .status(500)
          .json({ status: false, message: status.SERVER_ERROR });
      });
  } else {
    await firestore
      .collection("users")
      .doc(`${cid}`)
      .set({ join: "" }, { merge: true });

    return res.status(200).json({
      success: true,
      message: `Sessoin from table-${table_no} is successfully terminated`,
    });
  }
};

exports.restoreCustomer = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no || !cid) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let customersRef;
  let orderRef;
  if (table_no == "takeaway") {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);

    customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("takeaway")
      .doc("users");
  } else {
    customersRef = await firestore
      .collection(`restaurants`)
      .doc(req.user.rest_id);

    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);
  }

  let data = (await customersRef.get()).data();
  let customers = data.customers;

  let index = customers.findIndex((ele) => {
    return cid == ele.cid && ele.table == table_no;
  });

  if (index == -1) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let order = await orderRef.get();
  if (order.exists && order.data().cid == cid) {
    await orderRef.set({ restore: false }, { merge: true });
  }

  delete customers[index].restore;

  await customersRef
    .set({ customers: [...customers] }, { merge: true })
    .then(async (e) => {
      await firestore
        .collection("users")
        .doc(`${cid}`)
        .set({ join: req.user.rest_id }, { merge: true });

      res.status(200).json({ status: true, message: status.RESTORED });
    })
    .catch((err) => {
      res.status(404).json({ status: false, message: status.SERVER_ERROR });
    });
};
