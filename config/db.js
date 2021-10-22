const admin = require("firebase-admin");
const mongoose = require("mongoose");

exports.InitializeDatabase = async () => {
  if (process.env.NODE_ENV != "prod") {
    var serviceAccount = require("../peraket-rms-firebase-adminsdk.json");
    return new Promise(async (resolve, reject) => {
      try {
        await admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        let connection = await mongoose.connect(process.env.MONGODB_URL, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: false,
        });

        resolve(connection);
      } catch (e) {
        resolve(true);
        console.log(e);
      }
    });
  } else {
    var serviceAccount = require("../hungercodes-firebase-adminsdk.json");
    return new Promise(async (resolve, reject) => {
      try {
        await admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        let connection = await mongoose.connect(process.env.MONGODB_URL, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: false,
        });
       

        resolve(connection);
      } catch (e) {
        resolve(true);
        console.log(e);
      }
    });
  }
};

exports.firestore = () => {
  return admin.firestore();
};
