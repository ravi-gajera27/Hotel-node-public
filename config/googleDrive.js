const {google} = require('googleapis');
let oAuthClient
 exports.InitializeGoogleDrive = async () => {
  var credentials = require('../google-drive-api-secret.json');
  let client_secret = credentials.web.client_secret
  let clietn_id = credentials.web.client_id
  return new Promise(async(resolve, reject) => {
    try {
      oAuthClient = await new google.auth.OAuth2({
        clietn_id, 
        client_secret
      })
      resolve(true);
    } catch (e) {
      resolve(true);
      console.log(e);
    }
  });
};
 
exports.authClient = async() => {
    const drive = await google.drive({
        version:'v3',
        auth: oAuthClient
    })
    return drive
  };