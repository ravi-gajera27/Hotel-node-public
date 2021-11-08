const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  rest_id: String,
  cid: mongoose.Schema.Types.ObjectId,
  cname: String,
  inv_date: String,
  inv_no: String,
  data: [],
  discount: String,
  table: String,
  tax: Number,
  gstin: String,
  taxInc: Boolean,
  taxable: Number,
  time: String,
  total_amt: Number,
  type: String,
  members: String,
  settle: { credit: Number, method: String },
});

module.exports.InvoiceModel = mongoose.model("invoices", InvoiceSchema);
