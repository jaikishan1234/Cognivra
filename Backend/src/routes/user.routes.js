import { Router } from "express";
import { updateUsername, updatePassword } from "../controllers/user.controller.js";
import { authUser } from "../middleware/auth.middleware.js";

const userRouter = Router();

/*
 * All user routes require authentication
 */

/* Route POST /api/user/update-username */
userRouter.post("/update-username", authUser, updateUsername);

/* Route POST /api/user/update-password */
userRouter.post("/update-password", authUser, updatePassword);

export default userRouter;