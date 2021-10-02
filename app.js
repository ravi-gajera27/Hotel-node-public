require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const expressFileUpload = require("express-fileupload");
const ejs = require("ejs");
let moment = require("moment");
const db = require("./config/db");
const path = require("path");
const helmet = require("helmet");
const payment = require("./config/payment");

let app = express();

const server = require("http").createServer(app);

//initialize server

//initialize database
DbInitialize = async () => {
  mongoClient = await db.InitializeDatabase();
};
DbInitialize();

//initialize payment getway
InitializePaymentGetway = async () => {
  await payment.InitializePaymentGetway();
};
InitializePaymentGetway();

require("./config/mail");

const cron = require("./utils/cron");

// listing routes
const authSuperAdmin = require("./super-admin/routes/auth");
const restSuperAdmin = require("./super-admin/routes/restaurants");
const paymentSuperAdmin = require("./super-admin/routes/payment");
const authAdmin = require("./admin/routes/auth");
const authUsers = require("./customer/routes/auth");
const order = require("./customer/routes/order");
const orderAdmin = require("./admin/routes/order");
const menuAdmin = require("./admin/routes/menu");
const statsAdmin = require("./admin/routes/stats");
const userAdmin = require("./admin/routes/user");
const custAdmin = require("./admin/routes/custAuth");
const paymentAdmin = require("./admin/routes/payment");
const authCaptain = require("./captain/routes/auth");
const orderCaptain = require("./captain/routes/order");
const menuCaptain = require("./captain/routes/menu");

let whitelist = [
  "http://localhost:4300",
  "http://localhost:4400",
  "http://localhost:4200",
  "http://localhost:8100",
  "https://peraket-rms.web.app",
  "https://peraket-admin.web.app",
  "http://192.168.0.108:4200",
  "https://peraket-admin-desktop-44b70.web.app",
  "https://peraket-rms-captain.web.app",
  "https://peraket-super-admin.web.app",
  "https://socket-test-4d4f6.web.app",
];
const corsConfig = {
  credentials: true,
  origin: function (origin, callback) {
    // allow requests with no origin
    if (!origin) return callback(null, true);
    whitelist.includes(origin);
    if (whitelist.indexOf(origin) == -1) {
      var message = `The CORS policy for this origin doesn't 
                allow access from the particular origin.`;
      return callback(new Error(message), false);
    }
    return callback(null, true);
  },
};

//set server configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsConfig));
app.use(cookieParser());
app.use(expressFileUpload());
app.use(helmet());
app.use(express.static(__dirname + "/public"));
app.use(express.static(__dirname + "/utils"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/utils/templates"));
app.set("trust proxy", true);

app.get("/eod1", (req, res) => {
  let invoice_array = [
    {
      cname: "Ravi",
      invoice_id: "1234",
      gross: 2000,
      tax: 100,
      total_amt: 2050,
      cash: 2050,
      settle: { method: "card", amount: 0 },
    },
  ];
  res.render("eod1", { invoice_array: invoice_array });
});

// process routes of super-admin
app.use("/api/super-admin/auth", authSuperAdmin);
app.use("/api/super-admin/restaurant", restSuperAdmin);
app.use("/api/super-admin/payment", paymentSuperAdmin);

//process routes of admin
app.use("/api/admin/auth", authAdmin);
app.use("/api/admin/order", orderAdmin);
app.use("/api/admin/menu", menuAdmin);
app.use("/api/admin/stats", statsAdmin);
app.use("/api/admin/user", userAdmin);
app.use("/api/admin/customer", custAdmin);
app.use("/api/admin/payment", paymentAdmin);

//process routes of captain
app.use("/api/captain/auth", authCaptain);
app.use("/api/captain/order", orderCaptain);
app.use("/api/captain/menu", menuCaptain);

//process routes of customer
app.use("/api/user/auth", authUsers);
app.use("/api/user/order", order);

let hash = require("./utils/encryption");

//running app on specific port

server.listen(process.env.PORT || 5000, () => {
  cron.startAllCron();

  console.log(
    "app is running",
    moment().utcOffset(process.env.UTC_OFFSET).format("hh:mm A")
  );
});

const io = require("socket.io")(server, { cors: { origin: "*" } });
/* const createAdapter = require("socket.io-redis");
const { RedisClient } = require("redis");

const pubClient = new RedisClient({ host: "localhost", port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter({ host: "localhost", port: 6379 }));
 */
user = 0;

io.on("connection", (socket) => {
  /* console.log("user come", socket.id);
  socket.emit("socket", socket.id) */

  console.log("user", ++user);
  socket.on("disconnect", (s) => {
    console.log("user", --user);
    console.log("user gone", socket.id);
  });
  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });
});
