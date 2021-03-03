require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const db = require('./config/db');

//initialize server
let app = express();

//initialize database
DbInitialize = async () => {
  await db.InitializeDatabase()
}

DbInitialize()

// listing routes
const authAdmin = require('./admin/routes/auth');
const authUsers = require('./customer/routes/auth')

const corsConfig = {
  credentials: true,
  origin: true,
};

//set server configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsConfig));
app.use(cookieParser())

//process routes
app.use('/api/admin/auth', authAdmin);
app.use('/api/user/auth', authUsers);

//running app on specific port
app.listen(process.env.PORT || 5000, () => {
  console.log('app is running');
});
