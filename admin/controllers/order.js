const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");

exports.cancelOrder = async (req, res, next) => {
  let table_no = req.params.table_no;
  let order_no = req.params.order_no;
  let cid = req.params.cid;

  if (!table_no || !order_no || !cid) {
    if (order_no != 0) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
  }

  let orderRef;
  if (table_no == "takeaway") {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);
  } else {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);
  }

  let orderData = await orderRef.get();
  if (orderData.exists) {
    let order = JSON.parse(JSON.stringify(orderData.data().order));
    if (Number(order_no) <= order.length) {
      order[Number(order_no)].restore = true;

      orderRef
        .set({ order: order }, { merge: true })
        .then((order) => {
          return res.status(200).json({
            success: true,
            message: `Order-${Number(
              order_no + 1
            )} from ${ table_no == "takeaway" ? "Takeaway" : "Table-" + table_no +1} is successfully canceled`,
          });
        })
        .catch((err) => {
          return res
            .status(500)
            .json({ success: false, message: status.SERVER_ERROR });
        });
    } else {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
  } else {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }
};

exports.restoreOrder = async (req, res, next) => {
  let table_no = req.params.table_no;
  let order_no = req.params.order_no;
  let cid = req.params.cid;

  if (!table_no || !order_no || !cid) {
    if (order_no != 0) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
  }

  let orderRef;
  if (table_no == "takeaway") {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);
  } else {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);
  }

  let orderData = await orderRef.get();
  if (orderData.exists) {
    let order = JSON.parse(JSON.stringify(orderData.data().order));
    if (Number(order_no) <= order.length) {
      delete order[Number(order_no)].restore;

      orderRef
        .set({ order: order }, { merge: true })
        .then((order) => {
          return res.status(200).json({
            success: true,
            message: `Order-${Number(order_no + 1)} from ${
              table_no == "takeaway" ? "Takeaway" : "Table-" + table_no +1
            } is successfully restored`,
          });
        })
        .catch((err) => {
          return res
            .status(500)
            .json({ success: false, message: status.SERVER_ERROR });
        });
    } else {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
  } else {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }
};


exports.checkoutCustomer = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no || !cid) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let customerRef;
  if (table_no == "takeaway") {
    customerRef = firestore
      .collection(`restaurants/${req.user.rest_id}/takeaway`)
      .doc(`${cid}`);
  } else {
    customerRef = firestore
      .collection(`restaurants`)
      .doc(`${req.user.rest_id}`);
  }

  let data = (await customerRef.get()).data();

  data.customers = data.customers.filter((ele) => {
    return ele.cid != cid && ele.table != table_no;
  });

  await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .set(data, { merge: true })
    .then(async (result) => {
      await firestore
        .collection("users")
        .doc(`${cid}`)
        .set({ join: "" }, { merge: true });

      res.status(200).json({ success: true });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.generateInvoice = async (req, res, next) => {
  let invoiceRef = await firestore
    .collection("orders")
    .doc(req.user.rest_id)
    .collection("invoices")
    .doc(req.params.invoice_id)
    .get();

  if (!invoiceRef.exists) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let rest_ref = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .get();

  rest_ref = rest_ref.data();

  let rest_details = {
    rest_name: rest_ref.rest_name,
    rest_address: rest_ref.address,
    gst_in: rest_ref.gst_in || "",
  };

  res.status(200).json({
    success: true,
    data: { invoice: invoiceRef.data(), rest_details: rest_details },
  });
};
