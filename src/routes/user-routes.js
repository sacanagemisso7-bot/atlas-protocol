const express = require('express');

const USER_ROLES = require('../constants/user-roles');
const userController = require('../controllers/user-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const allowRoles = require('../middlewares/role-middleware');
const validate = require('../middlewares/validation-middleware');
const asyncHandler = require('../utils/async-handler');
const {
  blockUserSchema,
  updateUserSchema,
  userIdParamsSchema,
  userListQuerySchema,
} = require('../validators/user-validators');

const router = express.Router();
const allRoles = Object.values(USER_ROLES);

router.use(authMiddleware);

router.get(
  '/',
  allowRoles(USER_ROLES.ADMIN),
  validate(userListQuerySchema, 'query'),
  asyncHandler(userController.listUsers),
);
router.get(
  '/:id',
  allowRoles(...allRoles),
  validate(userIdParamsSchema, 'params'),
  asyncHandler(userController.getUser),
);
router.patch(
  '/:id/block',
  allowRoles(USER_ROLES.ADMIN),
  validate(userIdParamsSchema, 'params'),
  validate(blockUserSchema),
  asyncHandler(userController.setUserBlocked),
);
router.patch(
  '/:id',
  allowRoles(...allRoles),
  validate(userIdParamsSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(userController.updateUser),
);

module.exports = router;
