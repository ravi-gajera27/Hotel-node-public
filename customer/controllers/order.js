const firestore = require('../../config/db').firestore()
const admin = require('firebase-admin')
const { extractCookie } = require('../../utils/cookie-parser');
const status = require('../../utils/status');

exports.addOrder = async (req, res, next) => {
  console.log(req.body);
  let cookie = await extractCookie(req, res);
   console.log(cookie)
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
    console.log('order', orderData);
    if (data.user_id && data.user_id != req.user.id) {
      res.status(401).json({ success: false, err: status.SESSION_EXIST });
    }
  }

  let send_data;
  req.body.time = new Date();
  req.body.table = Number(cookie.table);

  if (orderData.length == 0) {
    send_data = {
      user: req.user.id,
      order: [{ ...req.body }],
    };
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
        .json({ success: true, message: 'Order is successfully placed !' });
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


  await firestore.collection('restaurants').doc(cookie.rest_id).update({
    customers: admin.firestore.FieldValue.arrayRemove({ user_id: req.user.id, table: Number(cookie.table), customer_name: req.user.name })
  }).catch(err => {
    console.log(err)
    return
  })

  let order = await orderRef.delete();


  req.body.user = req.user.id
  req.body.name = req.user.name;
  req.body.table = `table-${cookie.table}`;

  await firestore
    .collection(`orders/${cookie.rest_id}/invoices`)
    .add(req.body)
    .then((order) => {
      return res
        .status(200)
        .json({ success: true, message: 'Bill is generated successfully !' });
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};
