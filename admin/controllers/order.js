const firstore = require("../../config/db").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");

exports.cancelOrder = async (req, res, next) => {
  let table_no = req.params.table_no;
  let order_no = req.params.order_no;

  if (!table_no || !order_no) {
    if (order_no != 0) {
      return res.status(400).json({ status: false, err: status.BAD_REQUEST });
    }
  }

  let orderRef = firstore
    .collection(`restaurants/${req.user.rest_id}/order`)
    .doc(`table-${table_no}`);

  let orderData = await orderRef.get();
  if (orderData.exists) {
    let order = JSON.parse(JSON.stringify(orderData.data().order));
    if (Number(order_no) <= order.length) {
      order.splice(Number(order_no), 1);

      orderRef
        .set({ order: order }, { merge: true })
        .then((order) => {
          return res.status(200).json({
            success: true,
            message: `Table-${table_no} Order-${order_no} is successfully canceled`,
          });
        })
        .catch((err) => {
          return res
            .status(500)
            .json({ success: false, err: status.SERVER_ERROR });
        });
    } else {
      return res.status(400).json({ status: false, err: status.BAD_REQUEST });
    }
  } else {
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }
};

exports.terminateSession = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no) {
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  let orderRef = await firstore
    .collection(`restaurants/${req.user.rest_id}/order`)
    .doc(`table-${table_no}`)

    let order = await orderRef.get()

  let customersRef = await firstore
    .collection(`restaurants`)
    .doc(req.user.rest_id);

  let data = await customersRef.get();
  customers = data.data().customers;

  customers = customers.filter((ele) => ele.table != table_no);

  await customersRef.set(
    {
      customers: customers,
    },
    { merge: true }
  );

  if (order.exists) {
    await orderRef
      .delete()
      .then(async(ord) => {
        
      await firestore
      .collection("users")
      .doc(`${cid}`)
      .set({ join: '' }, { merge: true });

        return res.status(200).json({
          success: true,
          message: `Sessoin from table-${table_no} is successfully terminated`,
        });
      })
      .catch((err) => {
        return res
          .status(500)
          .json({ status: false, err: status.SERVER_ERROR });
      });
  }else{
    
    await firestore
    .collection("users")
    .doc(`${cid}`)
    .set({ join: '' }, { merge: true });

    return res.status(200).json({
      success: true,
      message: `Sessoin from table-${table_no} is successfully terminated`,
    });
  }
};

exports.checkoutCustomer = async (req, res, next) => {
  let table_no = req.params.table_no;
  let cid = req.params.cid;

  if (!table_no || !cid) {
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  let rest_details = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .get();

  let data = rest_details.data();

  data.customers = data.customers.filter((ele) => {
    return (
      ele.cid != cid &&
      ele.table != table_no
    );
  });

  await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .set(data, { merge: true })
    .then(async(result) => {

      await firestore
      .collection("users")
      .doc(`${cid}`)
      .set({ join: '' }, { merge: true });

      res.status(200).json({ success: true });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.generateInvoice = async(req, res, next) => {

  let invoiceRef = await firstore.collection('orders').doc(req.user.rest_id)
  .collection('invoices').doc(req.params.invoice_id).get()

  if(!invoiceRef.exists){
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  let rest_ref = await firstore.collection('restaurants').doc(req.user.rest_id).get()

  rest_ref = rest_ref.data()

  let rest_details = {
    rest_name: rest_ref.rest_name,
    rest_address: rest_ref.address,
    gst_in: rest_ref.gst_in || '',
  }

  res.status(200).json({success: true, data:{invoice: invoiceRef.data(), rest_details: rest_details}})

}