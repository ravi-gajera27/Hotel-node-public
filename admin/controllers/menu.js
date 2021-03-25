const firstore = require('../../config/db').firestore();
const status = require('../../utils/status');
const HASH = require('../../utils/encryption');
const TOKEN = require('../../utils/token');
const { google } = require('googleapis');
const oauth = require('../../config/googleDrive')
const fs = require('fs')
const path = require('path')

var credentials = require('../../firestep-google-drive-api.json');
let scopes = ['https://www.googleapis.com/auth/drive'];

let oAuthClient = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    scopes
)

oAuthClient.authorize((err, token) => {
    if (err) { console.log('err', err) }
    else {

    }
})

exports.getCategory = async (req, res, next) => {

    await firstore.collection('restaurants').doc(req.user.rest_id).collection('categories').get()
        .then(cat => {
            let data = {}
            cat.docs.map(e => {
                data.cat = e.data().cat
                data.id = e.id
            })
            res.status(200).json({ success: true, data: data })
        })
        .catch(err => {
            res.status(500).json({ success: false, err: status.SERVER_ERROR })
        })

}

exports.setCategory = async (req, res, next) => {

    await firstore.collection('restaurants').doc(req.user.rest_id).collection('categories')
        .doc(req.params.id).set({ cat: [...req.body] }, { merge: true })
        .then(cat => {
            res.status(200).json({ success: true, data: cat })
        })
        .catch(err => {
            res.status(500).json({ success: false, err: status.SERVER_ERROR })
        })

}

exports.getMenu = async (req, res, next) => {
    await firstore.collection('restaurants').doc(req.user.rest_id).collection('menu').get()
        .then(menu => {
            let data = []
            menu.docs.map(ele => {
                let temp = ele.data()
                temp.id = ele.id
                data.push(temp)
            })
            res.status(200).json({ success: true, data: data })
        })
        .catch(err => {
            res.status(500).json({ success: false, err: status.SERVER_ERROR })
        })

}


exports.addMenu = async (req, res, next) => {
    await firstore.collection('restaurants').doc(req.user.rest_id).collection('menu').add(req.body)
        .then(menu => {
            res.status(200).json({ success: true, data: menu })
        })
        .catch(err => {
            res.status(500).json({ success: false, err: status.SERVER_ERROR })
        })

}

exports.updateMenu = async (req, res, next) => {
    let photo = ''; let menu_id = ''
    let data = JSON.parse(req.body.data)
    if (req.files && req.files.menu_pic != 'undefined') {
        photo = req.files.menu_pic

        if (!photo.mimetype.startsWith('image')) {
            return res.status(400).json({ success: false, err: 'Please upload an valid image file' })
        }

        if (photo.size > process.env.MAX_FILE_UPLOAD) {
            return res.status(400).json({ success: false, err: 'Please upload an image less than 1MB' })
        }

        photo.name = `menu_${Date.now()}${path.parse(photo.name).ext}`
        let path_name = `${process.env.FILE_UPLOAD_PATH}/${photo.name}`
        await photo.mv(path_name, async (err) => {
            if (err) {
                return res.status(500).json({ success: false, err: 'Problem With image upload' })
            }
            else {
                const fileMetadata = {
                    'name': photo.name,
                    parents: ['1Z-X9GegJCOBsFPFmJFdjj9n6Ob6i0KXC']
                };
                const media = {
                    mimeType: photo.mimetype,
                    body: fs.createReadStream(path_name)
                };

                let drive = google.drive({
                    version: 'v3',
                    auth: oAuthClient,
                })
             /*    drive.files.list({}, (err, res) => {
                    if (err) {console.log(err)};
                    const files = res.data.files;
                    if (files.length) {
                        files.map((file) => {
                            console.log(file);
                        });
                    } else {
                        console.log('No files found');
                    }
                }); */
                  await drive.files.create({
                      resource: fileMetadata,
                      media: media,
                     fields: 'id',
                     
                  }, (err, file) => {
                      if (err) {
                          // Handle error
                          console.error(err);
                      } else {
                          console.log('File Id: ', file);
                          //data.id = file.id
                          updateMenuFun(req, res, data)
                      }
                  });

                //  fs.unlinkSync(path_name)
            }
        })
    }
    else {
        updateMenuFun(req, res, data)
    }


}

updateMenuFun = async (req, res, data) => {
    await firstore.collection('restaurants').doc(req.user.rest_id).collection('menu')
        .doc(req.params.id).set(data, { merge: true })
        .then(menu => {
            res.status(200).json({ success: true, data: menu })
        })
        .catch(err => {
            res.status(500).json({ success: false, err: status.SERVER_ERROR })
        })

}

exports.deleteMenu = async (req, res, next) => {
    await firstore.collection('restaurants').doc(req.user.rest_id).collection('menu')
        .doc(req.params.id).delete()
        .then(menu => {
            res.status(200).json({ success: true, data: menu })
        })
        .catch(err => {
            res.status(500).json({ success: false, err: status.SERVER_ERROR })
        })

}