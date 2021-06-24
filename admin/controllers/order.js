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
      order.map((e) => {
        if (e.restore) {
          delete e.restore;
          e.cancel = true;
        }
      });
      order[Number(order_no)].restore = true;

      orderRef
        .set({ order: order }, { merge: true })
        .then((order) => {
          return res.status(200).json({
            success: true,
            message: `Order-${Number(order_no + 1)} from ${
              table_no == "takeaway" ? "Takeaway" : "Table-" + table_no
            } is successfully cancelled`,
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
              table_no == "takeaway" ? "Takeaway" : "Table-" + table_no
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

exports.getOrderByOrderNo = async (req, res, next) => {
  let table_no = req.params.table_no;
  let order_no = req.params.order_no;
  let cid = req.params.cid;
  console.log(table_no,order_no,cid);
  if (!table_no || !order_no || !cid) {
    if (order_no != 0 || order_no <= 0) {
      console.log('if')
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
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
  if (!orderData.exists) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let order = orderData.data().order;

  if (order.length <= Number(order_no)) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  return res.status(200).json({ success: true, data: order[order_no] });
};

exports.setOrderByOrderNo = async (req, res, next) => {
  let table_no = req.params.table_no;
  let order_no = Number(req.params.order_no);
  let cid = req.params.cid;

  if (!table_no || !order_no || !cid) {
    if (order_no != 0 || order_no < 0) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
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
  if (!orderData.exists) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let order = orderData.data().order;

  if (order.length <= Number(order_no)) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  order[order_no] = req.body;

  orderRef
    .set({ order: order }, { merge: true })
    .then((e) => {
      return res
        .status(200)
        .json({ success: true, message: "Successfully updated" });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};
