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
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
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
          .json({ success: false, message: status.SERVER_ERROR });
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
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
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
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
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

      res.status(200).json({ success: true, message: status.RESTORED });
    })
    .catch((err) => {
      res.status(404).json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.checkoutCustomer = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no || !cid) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let customerRef;
  let orderRef;
  if (table_no == "takeaway") {
    customerRef = firestore
      .collection(`restaurants/${req.user.rest_id}/takeaway`)
      .doc('users');

    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);
  } else {
    customerRef = firestore
      .collection(`restaurants`)
      .doc(`${req.user.rest_id}`);

    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);
  }

  let data = (await customerRef.get()).data();

  let orderDoc = await orderRef.get();
  let orderData = orderDoc.data();

  if (!orderDoc.exists || !orderData.cid || orderData.order.length == 0) {
    return res
      .status(403)
      .json({ success: false, message: "Customer is not ordered yet" });
  }

  if (orderData.cid != cid) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let finalInvoice = { data: [] };

  if (orderData.restore || orderData.cancel) {
    return res.status(403).json({
      success: false,
      message: "Order of this customer is already canceld",
    });
  }

  for (let ele of orderData.order) {
    if (ele.restore || ele.cancel) {
      continue;
    }
    let order = { ...ele };

    if (finalInvoice.data.length != 0) {
      finalInvoice.taxable += order.taxable;
      finalInvoice.qty += order.qty;
      let index = finalInvoice.data.length;
      for (let i = 0; i < order.data.length; i++) {
        let flag = true;
        for (let j = 0; j < index; j++) {
          if (
            order.data[i].name == finalInvoice.data[j].name &&
            order.data[i].type == finalInvoice.data[j].type &&
            order.data[i].addon.length == finalInvoice.data[j].addon.length
          ) {
            let check = order.data[i].addon.every(
              (el) => finalInvoice.data[j].addon.indexOf(el) >= 0
            );
            if (check == true) {
              finalInvoice.data[j].qty += order.data[i].qty;
              finalInvoice.data[j].price += order.data[i].price;
              flag = false;
              break;
            }
          }
        }
        if (flag) {
          finalInvoice.data.push(order.data[i]);
        }
      }
    } else {
      finalInvoice = JSON.parse(JSON.stringify(order));
    }

    if (res.unique) {
      finalInvoice.unique = true;
    }
  }

  let restRef = await firestore.collection("restaurants").doc(req.user.rest_id);

  let rest_details = await restRef.get();

  let restData = rest_details.data();
  restData = await setInvoiceNumber(restData);

  finalInvoice.cid = cid;
  finalInvoice.cname = orderData.cname;
  finalInvoice.table = table_no;
  finalInvoice.invoice_no = restData.inv_no;
  finalInvoice.clean = false;
  delete finalInvoice.date;
  delete finalInvoice.qty;
  finalInvoice.invoice_date = moment()
    .utcOffset(process.env.UTC_OFFSET)
    .format("YYYY-MM-DD");
  finalInvoice.time = moment()
    .utcOffset(process.env.UTC_OFFSET)
    .format("HH:mm");
  finalInvoice.tax = restData.tax.toString();
  finalInvoice.total_amt =
    finalInvoice.taxable + (finalInvoice.taxable * restData.tax) / 100;

  let index;
  if (table_no == "takeaway") {
    console.log(data)
    takeawayUser = data;
    index = takeawayUser.customers.findIndex(
      (ele) =>
        ele.cid == cid && ele.table == table_no && ele.cname == orderData.cname
    );
    let obj = { ...takeawayUser.customers[index] };

    obj.checkout = true;
    delete obj.req;

    takeawayUser.customers[index] = obj;
  } else {
    index = data.customers.findIndex(
      (ele) =>
        ele.cid == cid && ele.table == table_no && ele.cname == orderData.cname
    );
    data.customers[index].checkout = true;
  }

  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .add(finalInvoice)
    .then(async (order) => {
      
      await orderRef.delete();

      if (table_no == "takeaway") {
        data.customers[index].invoice_id = order.id;
        await customerRef.set({ customers: [...data.customers] });
      } else {
        data.customers[index].invoice_id = order.id;
        restData.customers = data.customers;
      }
      await restRef.set(restData, { merge: true });
      return res
        .status(200)
        .json({ success: true, message: "Successfully checkout" });
    })
    .catch((err) => {
      console.log(err);
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.updateInvoice = async (req, res) => {
  let invoice = req.body;
  let invoice_id = req.params.invoice_id;

  if (!invoice.cid || !invoice_id) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let customerRef;
  if (invoice.table == "takeaway") {
    customerRef = firestore
      .collection(`restaurants/${req.user.rest_id}/takeaway`)
      .doc(`${invoice.cid}`);
  } else {
    customerRef = firestore
      .collection(`restaurants`)
      .doc(`${req.user.rest_id}`);
  }

  let custDoc = (await customerRef.get()).data();

  flag = false;

  for (let cust of custDoc.customers) {
    if (cust.cid == invoice.cid && cust.invoice_id == invoice_id) {
      flag = true;
      break;
    }
  }

  if (!flag) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  delete invoice.invoice_id;
  delete invoice.order_no;
  delete invoice.clean;
  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(invoice_id)
    .set(invoice, { merge: true })
    .then((e) => {
      return res
        .status(200)
        .json({ success: true, message: "Successfully Changed" });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.cleanUpCustomers = async (req, res) => {
  let invoice = req.body;
  console.log(invoice)
  let invoice_id = req.params.invoice_id;

  if (!invoice.cid || !invoice.table || !invoice_id) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let customerRef;
  if (invoice.table == "takeaway") {
    customerRef = firestore
      .collection(`restaurants/${req.user.rest_id}/takeaway`)
      .doc(`users`);
  } else {
    customerRef = firestore
      .collection(`restaurants`)
      .doc(`${req.user.rest_id}`);
  }

  let custDoc = await customerRef.get();

  if (!custDoc.exists) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let customers = custDoc
    .data()
    .customers.filter(
      (ele) => ele.cid != invoice.cid && ele.table != invoice.table
    );

  delete invoice.invoice_id;
  delete invoice.order_no;
  delete invoice.clean;

  console.log(invoice)
  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(invoice_id)
    .set(invoice)
    .then(async(e) => {
      await customerRef.set({ customers: [...customers] }, { merge: true });
      await firestore
        .collection("users")
        .doc(invoice.cid)
        .set({ join: "" }, { merge: true });
      return res
        .status(200)
        .json({ success: true, message: "Successfully Cleaned up" });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

function setInvoiceNumber(data) {
  let invoice_format = data.invoice_format;
  let set_invoice_no = "";

  if (!invoice_format.curr_num) {
    set_invoice_no =
      invoice_format.start_text +
      invoice_format.middle_symbol +
      (invoice_format.year
        ? moment()
            .utcOffset(process.env.UTC_OFFSET)
            .year()
            .toString()
            .substr(-2) + invoice_format.middle_symbol
        : "") +
      invoice_format.start_num;
    data.invoice_format.curr_num = invoice_format.start_num;
  } else {
    let current_month = moment().utcOffset(process.env.UTC_OFFSET).month();
    let fan_year;
    if (current_month < 3) {
      fan_year =
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .subtract(1, "year")
          .format("YYYY")
          .substr(-2) +
        "-" +
        moment().utcOffset(process.env.UTC_OFFSET).format("YYYY").substr(-2);
    } else {
      fan_year =
        moment().utcOffset(process.env.UTC_OFFSET).format("YYYY").substr(-2) +
        "-" +
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .add(1, "year")
          .format("YYYY")
          .substr(-2);
    }
    if (fan_year != invoice_format.fan_year) {
      invoice_format.fan_year =
        moment().utcOffset(process.env.UTC_OFFSET).format("YYYY").substr(-2) +
        "-" +
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .add(1, "year")
          .format("YYYY")
          .substr(-2);
      data.invoice_format.curr_num = invoice_format.start_num;
      set_invoice_no =
        invoice_format.start_text +
        invoice_format.middle_symbol +
        (invoice_format.year
          ? moment()
              .utcOffset(process.env.UTC_OFFSET)
              .year()
              .toString()
              .substr(-2) + invoice_format.middle_symbol
          : "") +
        invoice_format.start_num;
    }
  }

  let curr_num = invoice_format.curr_num;
  if (!set_invoice_no) {
    let n1 = curr_num.toString();
    let n2 = (parseInt(curr_num) + 1).toString();
    let l1 = n1.length;
    let l2 = n2.length;
    if (l1 > l2) {
      n2 = n1.substr(0, l1 - l2) + n2;
    }

    set_invoice_no =
      invoice_format.start_text +
      invoice_format.middle_symbol +
      (invoice_format.year
        ? moment()
            .utcOffset(process.env.UTC_OFFSET)
            .year()
            .toString()
            .substr(-2) + invoice_format.middle_symbol
        : "") +
      n2;

    data.invoice_format.curr_num = n2;
  }

  data.inv_no = set_invoice_no;

  return data;
}
