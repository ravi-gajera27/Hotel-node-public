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

//initialize server

let app = express();

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
  "https://admin-desktop.hunger.codes",
  "https://admin.hunger.codes",
  "https://customer.hunger.codes",
  "https://hunger.codes",
  "https://www.admin-desktop.hunger.codes",
  "https://www.admin.hunger.codes",
  "https://www.customer.hunger.codes",
  "https://www.hunger.codes",
  "https://firestep-node.herokuapp.com",
];
const corsConfig = {
  credentials: true,
  origin: function (origin, callback) {
    // allow requests with no origin
    /*   if (!origin) return callback(null, true);
    if (whitelist.indexOf(origin) == -1) {
      var message = `The CORS policy for this origin doesn't 
                allow access from the particular origin.`;
      return callback(new Error(message), false);
    } */
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

//running app on specific port

const puppeteer = require("puppeteer");

sendMessage = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath:
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    // excludeSwitches: 'enable-automation',
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--user-data-dir=C:\\Users\\Ravi\\AppData\\Local\\Google\\Chrome\\User Data",
    ],
  });
  const page = await browser.newPage();
  await page.goto("https://web.whatsapp.com/send/?phone=917069823148&text=hiii");

  /*   await page.waitForSelector(".hqzQac", { visible: true });
  page.click(".hqzQac");

  await page.waitForNavigation();

  await page.waitForSelector(".g9ymFf", { visible: true });
  page.click(".g9ymFf");

  await page.waitForNavigation();

  await page.waitForSelector("iframe[name='goog-reviews-write-widget']");
  const elementHandle = await page.$(
    "iframe[name='goog-reviews-write-widget']"
  );
  const frame = await elementHandle.contentFrame();
  await frame.waitForSelector("span[data-rating='3']", { visible: true });
  await frame.click("span[data-rating='3']"); */

  // browser.close();
  // console.log('See screenshot: ' + screenshot)

  //post class VfPpkd-RLmnJb
};

const fs = require("fs");
const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
function createSession() {
  // Path where the session data will be stored
  const SESSION_FILE_PATH = "./public/session.json";

  // Load the session data if it has been previously saved
  let sessionData = {};
  if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
  }

  // Use the saved values
  console.log(sessionData);
  const client = new Client({ session: sessionData });

  client.initialize();

  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("Client is ready!");
  });

  client.on("message", (message) => {
    console.log(message);
    if (message.body === "hi") {
      client.sendMessage(message.from, "hello");
    }
  });

  // Save session values to the file upon successful auth
  client.on("authenticated", (session) => {
    sessionData = session;
    console.log(session);
    return;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
      if (err) {
        console.error(err);
      }
    });
  });
}

let crypto = require("randomstring");
app.listen(process.env.PORT || 5000, async () => {
  cron.startAllCron();
  //sendMessage();

  console.log(
    "app is running",
    moment().utcOffset(process.env.UTC_OFFSET).format("hh:mm A"),

  );
});
