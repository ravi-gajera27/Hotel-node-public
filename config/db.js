const admin = require("firebase-admin");
const mongoose = require("mongoose");

exports.InitializeDatabase = async () => {
  var serviceAccount = require("../peraket-rms-firebase-adminsdk.json");
  return new Promise(async (resolve, reject) => {
    try {
      await admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      let connection = await mongoose
        .connect(process.env.MONGODB_URL, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: true,
        })
      

      resolve(connection);
    } catch (e) {
      resolve(true);
      console.log(e);
    }
  });
};

exports.firestore = () => {
  return admin.firestore();
};
