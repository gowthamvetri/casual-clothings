import {Router} from "express";
import auth from "../middleware/auth.js";
import { 
    addToCartItemController,
    deleteCartItemQtyController, 
    getCartItemController, 
    updateCartItemQtyController, 
    addBundleToCartController,
    validateCartItemsController,
    batchRemoveCartItemsController,
    cleanCartController
} from "../controllers/cart.controller.js";
import { cartLimiter } from '../middleware/rateLimitMiddleware.js';

const cartRouter = Router();

cartRouter.post("/create", auth, cartLimiter, addToCartItemController);
cartRouter.post("/add-bundle", auth, cartLimiter, addBundleToCartController);
cartRouter.get("/get", auth, getCartItemController);
cartRouter.put('/update-qty', auth, cartLimiter, updateCartItemQtyController);
cartRouter.delete('/delete-cart-item', auth, cartLimiter, deleteCartItemQtyController);
cartRouter.post('/validate', auth, validateCartItemsController);
cartRouter.post('/batch-remove', auth, cartLimiter, batchRemoveCartItemsController);
cartRouter.post('/clean', auth, cartLimiter, cleanCartController);

export default cartRouter;