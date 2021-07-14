const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const moment = require("moment");

exports.acceptRequest = async (req, res, next) => {
  let custoemrsRef = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("customers")
    .doc("users");

  let customers = (await custoemrsRef.get()).data().takeaway;

  customers.map((cust) => {
    if (cust.cid == req.params.cid) {
      cust.req = true;
    }
  });

  await custoemrsRef.set({ takeaway: [...customers] }, { merge: true });

  res.status(200).json({ success: true, message: status.ACCEPT_REQUEST_ADMIN });
};

exports.rejectRequest = async (req, res, next) => {
  let customersRef = await firestore
  .collection("restaurants")
  .doc(req.user.rest_id)
  .collection("customers")
  .doc("users");

  let customers = (await customersRef.get()).data().takeaway;

  customers = customers.filter((cust) => cust.cid != req.params.cid);

  let userRef = await firestore.collection("users").doc(req.params.cid);

  await userRef.set({ join: "" }, { merge: true });

  await customersRef.set({ takeaway: [...customers] }, { merge: true });

  res.status(200).json({ success: true, message: status.REJECT_REQUEST_ADMIN });
};

exports.blockCustomer = async (req, res, next) => {
  let customersRef = await firestore
  .collection("restaurants")
  .doc(req.user.rest_id)
  .collection("customers")
  .doc("users");

  let customers = (await customersRef.get()).data().takeaway;

  customers = customers.filter((cust) => cust.cid != req.params.cid);

  let userRef = await firestore.collection("users").doc(req.params.cid);

  let blocked = moment().utcOffset(process.env.UTC_OFFSET).format("YYYY-MM-DD");

  await customersRef.set({ takeaway: [...customers] }, { merge: true });

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
  let orderCollectionRef;
  let customersRef = await firestore
    .collection(`restaurants`)
    .doc(req.user.rest_id)
    .collection("takeaway")
    .doc("users");

let customers

  if (table_no == "takeaway") {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`); 

      customers = (await customersRef.get()).data().takeaway || []

  } else {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);

      customers = (await customersRef.get()).data().seat || []
  }

  let order = await orderRef.get();

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

  if(table_no == 'takeaway'){
    await customersRef.set(
      {
        takeaway: newCustomers,
      },
      { merge: true }
    );
  }else{
    await customersRef.set(
      {
        seat: newCustomers,
      },
      { merge: true }
    );
  }


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

  let  customersRef = await firestore
  .collection("restaurants")
  .doc(req.user.rest_id)
  .collection("customers")
  .doc("users");

  let customers
  let orderRef;
  
  if (table_no == "takeaway") {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);

      customers = (await customersRef.get()).data().takeaway 

  } else {

    customers = (await customersRef.get()).data().seat 

    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);
  }

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

  if (table_no == "takeaway") {
    await customersRef
    .set({ takeaway: [...customers] }, { merge: true })
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
  }
  else{
    await customersRef
    .set({ seat: [...customers] }, { merge: true })
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
  }

};

exports.checkoutCustomer = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no || !cid) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let customerRef = firestore
  .collection(`restaurants/${req.user.rest_id}/customers`)
  .doc("users");

  let customers =  (await customersRef.get())
  let seatCust;
  let takeawayCust;

  let orderRef;
  if (table_no == "takeaway") {

    takeawayCust = customers.data().takeaway
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`);
  } else {

    seatCust = customers.data().seat
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`);
  }


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
  finalInvoice.tax = Number(data.tax);

  if (restData.taxInc) {
    finalInvoice.total_amt = finalInvoice.taxable;
    finalInvoice.taxable =
    finalInvoice.taxable =
    (finalInvoice.taxable * 100 ) / (100 + restData.tax);
    finalInvoice.taxInc = true;
  } else {
    finalInvoice.total_amt =
      finalInvoice.taxable + (finalInvoice.taxable * restData.tax) / 100;
  }

  let index;
  if (table_no == "takeaway") {
    index = takeawayCust.findIndex(
      (ele) =>
        ele.cid == cid && ele.table == table_no && ele.cname == orderData.cname
    );
    let obj = { ...takeawayCust[index] };

    obj.checkout = true;
    delete obj.req;

    takeawayCust[index] = obj;
  } else {
    index = seatCust.findIndex(
      (ele) =>
        ele.cid == cid && ele.table == table_no && ele.cname == orderData.cname
    );
    seatCust[index].checkout = true;
  }

  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .add(finalInvoice)
    .then(async (order) => {
      await orderRef.delete();

     await customerRef.set({seat: [...seatCust], takeaway: [...takeawayCust]},{merge: true})
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

  if (!invoice_id) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  delete invoice.invoice_id;
  delete invoice.order_no;
  console.log(invoice, invoice_id);
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
  console.log(invoice);
  let invoice_id = req.params.invoice_id;

  if (!invoice.cid || !invoice.table || !invoice_id) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }


  let customerRef = firestore
  .collection(`restaurants/${req.user.rest_id}/customers`)
  .doc("users");

  let customers =  (await customersRef.get());
  let seatCust;
  let takeawayCust;

  if (table_no == "takeaway") {
    takeawayCust = customers.data().takeaway
  } else {
    seatCust = customers.data().seat
  }

  if (!customers.exists) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  if(table_no == 'takeaway'){
    takeawayCust = takeawayCust.filter(
      (ele) => ele.cid != invoice.cid && ele.table != invoice.table
    );
  }else{
    seatCust = seatCust.filter(
      (ele) => ele.cid != invoice.cid && ele.table != invoice.table
    );
  }

  delete invoice.invoice_id;
  delete invoice.order_no;
  delete invoice.clean;


  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(invoice_id)
    .set(invoice)
    .then(async (e) => {
      await customerRef.set({ seat: [...seatCust], takeaway: [...takeawayCust] }, { merge: true });
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
