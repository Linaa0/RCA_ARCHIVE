const { upload } = require("../services/storageService");

function handleUploadSingle(fieldName = "file") {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return res
          .status(400)
          .json({ error: err.message || "File upload failed." });
      }
      next();
    });
  };
}

module.exports = {
  handleUploadSingle,
};
