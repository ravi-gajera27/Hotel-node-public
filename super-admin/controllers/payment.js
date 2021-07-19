const firestore = require("firebase-admin").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY);

exports.generateInvoiceAPI = async(req, res) =>{
    let success = await this.generateInvoice(); 
    if(success){
        res.status(200).json({ success: true, message: status.INVOICE_GEN });
    }else{
        res.status(500).json({ success: false, message: status.SERVER_ERROR });
    }
}

exports.restaurantLockedAPI = async(req, res) =>{
    let success = await this.lockedRestaurant();
    if(success){
        res.status(200).json({ success: true, message: status.INVOICE_GEN });
    }else{
        res.status(500).json({ success: false, message: status.SERVER_ERROR });
    }
}

exports.generateInvoice = async() => {
    try{
    let collection = await firestore.collection('restaurants').where('locked','!='. true).get();
    let start_date = moment().utcOffset(process.env.UTC_OFFSET).subtract('1','month').startOf('month').format('YYYY-MM-DD');
    let end_date = moment().utcOffset(process.env.UTC_OFFSET).subtract('1','month').endOf('month').format('YYYY-MM-DD');

    for(let rest of collection.docs){
        let rest_id = rest.id;

        let invoiceDoc = await firestore.collection(`orders/${rest_id}/invoices`)
        .where('inv_date', '>=', start_date)
        .where('inv_date', '<=', end_date).get();

        let earning = 0;
        for(let doc of invoiceDoc.docs){
            let data = doc.data()

            for(let invoice of data.invoices){
                earning += invoice.total_amt
            }
        }
        earning = Math.round(earning);

        await firestore.collection('paymentReq').doc(rest_id).set({earning: earning})
    }
     let invoice =  moment().utcOffset(process.env.UTC_OFFSET).format('DD MMM, YYYY hh:mm A')
    
    await firestore.collection('super-admin').doc('general')
    .set({invoice:  invoice},{merge: true})

    return 1
    }
    catch(e){
        return -1
    }
}

exports.lockedRestaurant = async() => {
    try{
   let paymentReqDoc = await firestore.collection('paymentReq').get();

    for(let rest of paymentReqDoc.docs){
        let rest_id = rest.id
        await firestore.collection('restaurants').doc(rest_id).set({locked: true}, {merge: true})
    }

    let locked =  moment().utcOffset(process.env.UTC_OFFSET).format('DD MMM, YYYY hh:mm A')
    
    await firestore.collection('super-admin').doc('general')
    .set({locked:  locked},{merge: true})
    return 1
}catch(e){
    return -1
}
    
}