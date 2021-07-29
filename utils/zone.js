let zone = {}

exports.incZoneReq = async(ip, method) => {
    if(zone[ip]){
        zone[ip][method]++;
    }else{
        zone[ip] = { login: 0, signup: 0}
        zone[ip][method]++;
        console.log(zone)
    }
}

exports.resetAll = async() => {
    zone = {};
}

exports.checkForLogin = async(req, res, next) => {
    let ip = req.ip
    if(zone[ip]){
        if(zone[ip].login >= process.env.LOGIN_REQ_PER_DAY){
            return res.status(403).json({success: false, message: 'You are exceeded login req limit per day'})
        }
        else{
            next()
        }
    }else{
    next()
    }
}

exports.checkForSignup = async(req, res, next) => {
    let ip = req.ip
    if(zone[ip]){
        if(zone[ip].signup >= process.env.SIGNUP_REQ_PER_DAY){
            return res.status(403).json({success: false, message: 'You are exceeded signup req limit per day'})
        }
        else{
            next()
        }
    }else{
    next()
    }
}