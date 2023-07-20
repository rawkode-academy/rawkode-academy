import express from "express";
import payload from "payload";

require("dotenv").config();
const app = express();

app.get("/", (_, res) => {
	res.redirect("/admin");
});

const start = async () => {
  console.debug(process.env);

	await payload.init({
		secret: process.env.APPSETTING_PAYLOAD_SECRET,
		mongoURL: process.env.APPSETTING_MONGODB_URI,
		express: app,
		onInit: async () => {
			payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
		},
	});

	app.listen(3000);
};

start();
