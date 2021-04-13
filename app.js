require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const expressFileUpload = require("express-fileupload");
const ejs = require("ejs");
let moment = require("moment");
const db = require("./config/db");
const path = require('path');

//initialize server
let app = express();

//initialize database
DbInitialize = async () => {
  await db.InitializeDatabase();
};
DbInitialize();

// listing routes
const authAdmin = require("./admin/routes/auth");
const authUsers = require("./customer/routes/auth");
const order = require("./customer/routes/order");
const orderAdmin = require("./admin/routes/order");
const menuAdmin = require("./admin/routes/menu");
const statsAdmin = require("./admin/routes/stats");

const corsConfig = {
  credentials: true,
  origin: true,
};

//set server configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsConfig));
app.use(cookieParser());
app.use(expressFileUpload());
app.use(express.static(__dirname + '/public'));
app.set("view engine", "ejs");

//process routes of admin
app.use("/api/admin/auth", authAdmin);
app.use("/api/admin/order", orderAdmin);
app.use("/api/admin/menu", menuAdmin);
app.use("/api/admin/stats", statsAdmin);

//process routes of customer
app.use("/api/user/auth", authUsers);
app.use("/api/user/order", order);

//running app on specific port
app.listen(process.env.PORT || 5000, () => {
  console.log("app is running", moment().format("DD-MM-YYYY"));
});
