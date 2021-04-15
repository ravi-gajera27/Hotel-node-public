const firestore = require("../../config/db").firestore();
const admin = require("firebase-admin");
const { extractCookie } = require("../../utils/cookie-parser");
const status = require("../../utils/status");
let moment = require("moment");
const path = require("path");
const fs = require("fs");
let ejs = require("ejs");
let pdf = require("html-pdf");

exports.addOrder = async (req, res, next) => {
  console.log(req.body);
  let cookie = await extractCookie(req, res);

  if (!cookie) {
    res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let orderRef = await firestore
    .collection(`restaurants/${cookie.rest_id}/order/`)
    .doc(`table-${cookie.table}`);

  let data = await firestore
    .collection("restaurants")
    .doc(cookie.rest_id)
    .get();

  let customers = data.data().customers;
  let valid = false;
  for (let cust of customers) {
    if (cust.table == cookie.table && cust.user_id == req.user.id) {
      valid = true;
    }
  }
  if (!valid) {
    return res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let order = await orderRef.get();

  let orderData = [];
  if (order.exists) {
    let data = order.data();
    orderData = data.order;
    if (data.user_id && data.user_id != req.user.id) {
      res.status(401).json({ success: false, err: status.SESSION_EXIST });
    }
  }

  let send_data;
  req.body.date = Date.now();
  req.body.table = Number(cookie.table);

  if (orderData.length == 0) {
    send_data = {
      user_id: req.user.id,
      order: [{ ...req.body }],
    };


   let userRef = await firestore.collection(`restaurants/${cookie.rest_id}/users/`).doc(req.user.id)
   let  user = userRef.get()
   if(user.exists){
     
     user = user.data()
    await userRef.set({
       name: req.user.name,
       mobile_no: req.user.mobile_no,
       last_visit: Date.now(),
       count: user.count++
     },{merge: true})
   }else{
    await userRef.set({
       name: req.user.name,
       mobile_no: req.user.mobile_no,
       last_visit: Date.now(),
       count: 1
     })
   }

  } else {
    orderData.push(req.body);
    send_data = orderData;
    send_data = { order: [...send_data] };
  }
  orderRef
    .set(send_data, { merge: true })
    .then((order) => {
      return res
        .status(200)
        .json({ success: true, message: "Order is successfully placed !" });
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.getOrder = async (req, res, next) => {
  console.log(req.body);
  let cookie = await extractCookie(req, res);

  if (!cookie) {
    res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let orderRef = await firestore
    .collection(`restaurants/${cookie.rest_id}/order/`)
    .doc(`table-${cookie.table}`);

  let order = await orderRef.get();

  let orderData = [];
  if (order.exists) {
    let data = order.data();
    orderData = data.order;
    if (data.user_id && data.user_id != req.user.id) {
      res.status(401).json({ success: false, err: status.SESSION_EXIST });
    } else {
      return res.status(200).json({ success: true, data: orderData });
    }
  }
};

exports.checkout = async (req, res, next) => {
  console.log(req.body);
  let cookie = await extractCookie(req, res);

  if (!cookie) {
    res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let orderRef = await firestore
    .collection(`restaurants/${cookie.rest_id}/order/`)
    .doc(`table-${cookie.table}`);

  let rest_details = await firestore
    .collection("restaurants")
    .doc(cookie.rest_id)
    .get();

  let data = rest_details.data();

  let index = data.customers.findIndex((ele) =>  (
      ele.user_id == req.user.id &&
      ele.table == Number(cookie.table) &&
      ele.customer_name == req.user.name
    ));
  data.customers[index].checkout = true;
  

  let invoice_format = data.invoice_format;
  let invoice_start_number = "";
  let new_invoice_no = "";
  let set_invoice_no = "";
  let arr = [];
  if (invoice_format.middle_symbol) {
    arr = data.invoice_no.split(invoice_format.middle_symbol);
    if (arr.length == 3) {
      invoice_start_number = arr[2];
      if (
        moment().format("MM-DD") == "04-01" &&
        invoice_start_number != invoice_format.start_num
      ) {
        set_invoice_no =
          invoice_format.start_text +
          invoice_format.middle_symbol +
          new Date().getFullYear().toString().substr(-2) +
          invoice_format.start_num;
      } else if (new Date().getFullYear().toString().substr(-2) != arr[1]) {
        data.invoice_format.year = new Date()
          .getFullYear()
          .toString()
          .substr(-2);
        new_invoice_no =
          invoice_format.start_text +
          invoice_format.middle_symbol +
          new Date().getFullYear().toString().substr(-2) +
          invoice_format.middle_symbol;
      } else {
        new_invoice_no =
          invoice_format.start_text +
          invoice_format.middle_symbol +
          new Date().getFullYear().toString().substr(-2) +
          invoice_format.middle_symbol;
      }
    } else if (arr.length == 2) {
      invoice_start_number = arr[1];
      if (
        moment().format("MM-DD") == "04-01" &&
        invoice_start_number != invoice_format.start_num
      ) {
        set_invoice_no =
          invoice_format.start_text +
          invoice_format.middle_symbol +
          invoice_format.start_num;
      } else {
        new_invoice_no =
          invoice_format.start_text + invoice_format.middle_symbol;
      }
    } else {
      invoice_start_number = arr[0];
      if (
        moment().format("MM-DD") == "04-01" &&
        invoice_start_number != invoice_format.start_num
      ) {
        set_invoice_no = invoice_format.start_num;
      }
    }
  }

  if (!set_invoice_no && invoice_start_number != invoice_format.start_num) {
    let n1 = invoice_start_number.toString();
    let n2 = (parseInt(invoice_start_number) + 1).toString();
    let l1 = n1.length;
    let l2 = n2.length;
    if (l1 > l2) {
      n2 = n1.substr(0, l1 - l2) + n2;
    }

    new_invoice_no = new_invoice_no + n2;
    set_invoice_no = new_invoice_no;
  } else if (invoice_start_number == invoice_format.start_num) {
    set_invoice_no = set_invoice_no ? set_invoice_no : data.invoice_no;
  }
  /*   await firestore.collection('restaurants').doc(cookie.rest_id).update({
    customers: admin.firestore.FieldValue.arrayRemove({ user_id: req.user.id, table: Number(cookie.table), customer_name: req.user.name })
  }).catch(err => {
    console.log(err)
    return
  }) */

  let order = await orderRef.delete();

  req.body.user_id = req.user.id;
  req.body.cust_name = req.user.name;
  req.body.table = Number(`${cookie.table}`);
  req.body.invoice_no = set_invoice_no;
  delete req.body.date;
  req.body.invoice_date = Date.now();
  req.body.tax = 5;
  req.body.total_amt =
  req.body.total_taxable + (req.body.total_taxable * req.body.tax) / 100;

  let userRef = await firestore.collection("users").doc(req.body.user_id).get();
  let user = userRef.data();

  await firestore
    .collection(`orders/${cookie.rest_id}/invoices`)
    .add(req.body)
    .then(async (order) => {
      data.invoice_no = set_invoice_no;
      data.customers[index].invoice_id = order.id;
      await firestore
        .collection("restaurants")
        .doc(cookie.rest_id)
        .set(data, { merge: true });
      
     downloadInvoicePdf(res, req.body, user, data);
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

const downloadInvoicePdf = async (res, invoice, user, rest_details) => {
  var fileName = `invoice-${invoice.user_id}.pdf`;

  var output_path = process.env.INVOICE_PATH + fileName;

  await ejs.renderFile(
    path.join(__dirname + "/../../utils/templates/invoice.ejs"),
    {
      invoice: invoice,
      user: user,
      rest: rest_details,
      invoice_date: moment(invoice.invoice_date).format("DD/MM/YYYY"),
    },
    (err, data) => {
      if (err) {
        return res.status(500).json({success: false, err: status.SERVER_ERROR})
      } else {
        let options = {
          format: "A4", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
          orientation: "portrait", // portrait or landscape
          border: "0",
          type: "pdf",
        };

        pdf.create(data, options).toFile(output_path, function (err, data) {
          if (err) {
           return res.status(500).json({success: false, err: status.SERVER_ERROR})
          } else {
            fs.readFile(output_path, function (err, data) {
              fs.unlinkSync(output_path)
              res.contentType("application/pdf");
              return res.status(200).send(data);
            });
          }
        });
      }
    }
  );
};
