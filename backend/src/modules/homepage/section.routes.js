import { Router } from "express";
import { getSections, getSectionsWithProducts, createSection, updateSection, deleteSection } from "./section.controller.js";
import { optionalAuth, verifyJWT, authorizeAdmin } from "../../middleware/auth.middleware.js";

const router = Router();
router.route("/").get(optionalAuth, getSections);
router.route("/with-products").get(optionalAuth, getSectionsWithProducts);
router.use(verifyJWT, authorizeAdmin);
router.route("/").post(createSection);
router.route("/:id").patch(updateSection).delete(deleteSection);
export default router;
