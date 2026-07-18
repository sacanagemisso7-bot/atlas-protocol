const express = require('express');

const authController = require('../controllers/auth-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const validate = require('../middlewares/validation-middleware');
const {
  loginSchema,
  passwordChangeSchema,
  registerSchema,
} = require('../validators/auth-validators');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', authMiddleware, asyncHandler(authController.me));
router.patch(
  '/password',
  authMiddleware,
  validate(passwordChangeSchema),
  asyncHandler(authController.changePassword),
);

module.exports = router;
