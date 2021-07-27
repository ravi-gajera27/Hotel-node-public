module.exports.extractErrorMessage = (e) => {
  return new Error(e).message
}
