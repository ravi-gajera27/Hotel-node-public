const firstore = require('../../config/db').firestore();
const status = require('../../utils/status');
const HASH = require('../../utils/encryption');
const TOKEN = require('../../utils/token');

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