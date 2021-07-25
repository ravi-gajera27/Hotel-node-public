const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY)