import "dotenv/config";

import express from "express";
import path from "path";
import cors from "cors";
import { actionCorsMiddleware } from "@solana/actions";
import log from "./utils/logger";
import routes from "./routes";

const port = (process.env.PORT || 3000) as number;

export const app = express();
app.use(express.json());
// @ts-ignore
app.use(actionCorsMiddleware());
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

app.use(
  "/",
  express.static(path.join(__dirname, "../static"), {
    maxAge: 31557600000, // 1 year,
    immutable: true,
    lastModified: false,
  })
);

routes(app);

app.listen(port, () => {
  log.info(`Server started at port ${port}`);
});
