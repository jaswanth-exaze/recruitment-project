const express = require("express");
const controller = require("../controllers/contactRequest.controller");

const router = express.Router();

router.post("/", controller.createContactRequest);

module.exports = router;
