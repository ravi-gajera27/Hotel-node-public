exports.InitializeDatabase = () => {
  var admin = require("firebase-admin");

  var serviceAccount = require("../hotelman-58fc6-firebase-adminsdk-p8gjz-519d6d8be2.json");

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.log(e); 
  }
};
