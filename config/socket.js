let socketArray = new Map();

exports.setSocket = (socketId, rest_id) => {
  socketArray.set(socketId, rest_id);
};

exports.getSocketId = (rest_id) => {
  let key = [...socketArray.entries()]
    .filter(({ 1: v }) => v === rest_id)
    .map(([k]) => k);
  return key;
};

exports.removeSocket = (socketId) => {
  socketArray.delete(socketId);
};
