const admin = require('firebase-admin');
exports.InitializeDatabase = async () => {
  var serviceAccount = require('../hotelman-58fc6-firebase-adminsdk-p8gjz-519d6d8be.json');
  return new Promise((resolve, reject) => {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      resolve(true);
    } catch (e) {
      resolve(true);
      console.log(e);
    }
  });
};

exports.firestore = () => {
  return admin.firestore()
};
