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

  let userRef = await firestore.collection("users").doc(invoice.cid).get();
  let user = userRef.data();

  var fileName = `invoice-${invoice.cid}.pdf`;

  var output_path = process.env.INVOICE_PATH + fileName;
  await ejs.renderFile(
    path.join(__dirname + "/../../utils/templates/invoice.ejs"),
    {
      invoice: invoice,
      user: user,
      rest: data,
      invoice_date: moment(invoice.invoice_date).format("DD/MM/YYYY"),
    },
    (err, data) => {
      if (err) {
        console.log(err);
      } else {
        let options = {
          format: "A4", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
          orientation: "portrait", // portrait or landscape
          border: "0",
          type: "pdf",
          /*          header: {
            height: "1400px",
            width: "100px",
            contents: `<div style="position: absolute;top: 0;left: 0; bottom: 0; height: 1400px;width: 100px;background: url("https://drive.google.com/thumbnail?id=1hgGQNIMxQIgEA72UlUU8eF0crWFnsKVL") center bottom no-repeat, url("https://drive.google.com/thumbnail?id=1RnQX_4yl-cSc9rhXtC3BC_AoJnL4d0IE") repeat">
            <div style=" -moz-border-radius: 50%;
            -webkit-border-radius: 50%;
            border-radius: 50%;
            background: #415472;
            width: 30px;
            height: 30px;
            position: absolute;
            left: 33%;  top: 440px;"></div>
        <div style="  -moz-border-radius: 50%;
        -webkit-border-radius: 50%;
        border-radius: 50%;
        background: #415472;
        width: 30px;
        height: 30px;
        position: absolute;
        left: 33%;top: 690px;></div>
            </div>`,
          }, */
        };

        pdf.create(data, options).toFile(output_path, function (err, data) {
          if (err) {
            console.log(err);
          } else {
            fs.readFile(output_path, function (err, data) {
              fs.unlinkSync(output_path);
              res.contentType("application/pdf");
              res.status(200).send(data);
            });
          }
        });
      }
    }
  );
};

exports.getInvoicesByInterval = async (req, res, next) => {
  let interval = req.params.interval;
  
  if (!interval) {
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  interval = interval.split('_')

  if(interval.length != 2){
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  let start_date = interval[0];
  let end_date = interval[1];

  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .where("invoice_date", ">=", start_date)
    .where("invoice_date", "<=", end_date)
    .get()
    .then((data) => {
      let invoices = [];
      for (let invoice of data.docs) {
        invoices.push(invoice.data());
      }
      res.status(200).json({ success: true, data: invoices });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

function getDateBetweenInterval(interval) {
  let start_date, end_date;
  switch (interval) {
    case "today":
      start_date = moment().format("YYYY-MM-DD");
      end_date = start_date;
      break;

    case "1-week":
      start_date = moment().subtract(7, "days").format('YYYY-MM-DD')
      end_date = moment().format('YYYY-MM-DD')
      break;

    case "1-month":
      start_date = moment().date(1).format("YYYY-MM-DD");
      end_date = moment().format("YYYY-MM-DD");
      break;
  }
  return { start_date, end_date };
}
