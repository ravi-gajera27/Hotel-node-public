const firstore = require('../../config/db').firestore();
const status = require('../../utils/status');
const HASH = require('../../utils/encryption');
const TOKEN = require('../../utils/token');
const drive = require('../../config/googleDrive').authClient()
const fs = require('fs')

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
    if (req.files && req.files.menu_pic != 'undefined') {
        photo = req.files.menu_pic
    
        if (!photo.mimetype.startsWith('image')) {
          return  res.status(400).json({ success: false, err: 'Please upload an valid image file'})
        }
    
        if (photo.size > process.env.MAX_FILE_UPLOAD) {
          return res.status(400).json({ success: false, err: 'Please upload an image less than 1MB'})
        }
    
        photo.name = `menu_${Date.now()}${path.parse(photo.name).ext}`
       let path = `${process.env.FILE_UPLOAD_PATH}/${photo.name}`
        photo.mv(path, async (err) => {
          if (err) {
            return  res.status(500).json({ success: false, err: 'Problem With image upload'})
          }
          else{
            const fileMetadata = {
                'name': photo.name
              };
              const media = {
                mimeType: photo.mimetype,
                body: fs.createReadStream(path)
              };
              drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
              }, (err, file) => {
                if (err) {
                  // Handle error
                  console.error(err);
                } else {
                  console.log('File Id: ', file.id);
                  menu_id = file.id
                }
              });
          //  fs.unlinkSync(path)
          }
        })
      }

      if(menu_id){
          req.body.img = menu_id
      }
    await firstore.collection('restaurants').doc(req.user.rest_id).collection('menu')
        .doc(req.params.id).set(req.body, { merge: true })
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