const mongoose = require("mongoose");

const customnerSchema = new mongoose.Schema({
  rest_id: String,
  cid: String,
  cname: String,
  email: String,
  mobile_no: String,
  visit: Number,
  last_visit: String,
  review: { ratting: Number, text: String },
});

module.exports.CustomerModel = mongoose.model("customers", customnerSchema);
