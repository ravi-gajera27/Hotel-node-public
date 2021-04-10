const admin = require("firebase-admin");
const firestore = admin.firestore();

const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
let moment = require("moment");
const path = require("path");
const fs = require("fs");
let ejs = require("ejs");
let pdf = require("html-pdf");

exports.getInvoices = (req, res) => {
  firestore
    .collection("orders")
    .doc(req.user.rest_id)
    .collection("invoices")
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
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.downloadInvoicePdf = async (req, res) => {
  let rest_details = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .get();

  let invoiceRef = await firestore
    .collection("orders")
    .doc(req.user.rest_id)
    .collection("invoices")
    .doc(req.params.id)
    .get();

  let invoice = invoiceRef.data();

  let data = rest_details.data();

  let userRef = await firestore.collection("users").doc(invoice.user_id).get();
  let user = userRef.data();

  var fileName = `invoice-${invoice.user_id}.pdf`;

  var output_path = process.env.INVOICE_PATH + fileName;
  await ejs.renderFile(
    path.join(__dirname + "/../../utils/templates/invoice.ejs"),
    {
      invoice: invoice,
      user: user,
      rest: data,
      invoice_date: moment(invoice.invoice_date)
        .format("DD/MM/YYYY"),
    },
    (err, data) => {
      if (err) {
        console.log(err)
      } else {
        let options = {
          format: "A3", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
          orientation: "portrait", // portrait or landscape
          border: "0",
          type: "pdf",
        };

        pdf.create(data, options).toFile(output_path, function (err, data) {
          if (err) {
            console.log(err)
          } else {
            fs.readFile(output_path, function (err, data) {
             fs.unlinkSync(output_path)
              res.contentType("application/pdf");
              res.status(200).send(data);
            });
          }
        });
      }
    }
  );
};
