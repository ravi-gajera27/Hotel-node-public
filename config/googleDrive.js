const { google } = require('googleapis');
let oAuthClient
exports.InitializeGoogleDrive = async () => {
    /* var credentials = require('../google-drive-api-secret.json');
  let client_secret = credentials.web.client_secret;
  let client_id = credentials.web.client_id;
  let redirect_uri = credentials.web.redirect_uris[0] */
  var credentials = require('../firestep-google-drive-api.json');
    let scopes = ['https://www.googleapis.com/auth/drive.file'];
    return new Promise(async (resolve, reject) => {
        try {
           /* oAuthClient = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uri
            )
            console.log(oAuthClient)
             const url = oAuthClient.generateAuthUrl({
                access_type: 'offline',
                scope: scopes
              }); */
           /*    oAuthClient = new google.auth.JWT(
                  credentials.client_email,
                  null,
                  credentials.private_key,
                  scopes
              )
            
              oAuthClient.authorize((err, token)=>{
                  if(err){console.log('err',err)}
                  else{

                  }
              }) */
              const oAuthClient = google.auth.getClient({
                credentials,
                scopes,
              })
              
              oAuthClient.subject = credentials.client_email
            
            resolve(true);
        } catch (e) {
            console.log(e);
            resolve(true);
        }
    });
};

exports.authClient = async () => {
    return oAuthClient
};
