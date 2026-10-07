import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agricultureRouter from "./agriculture";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agricultureRouter);

export default router;
