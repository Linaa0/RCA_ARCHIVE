const app = require("../server/src/app");
const { connectToMongo } = require("../server/src/models");

module.exports = async function handler(req, res) {
  await connectToMongo();
  return app(req, res);
};
