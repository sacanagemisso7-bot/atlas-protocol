const express = require('express');

const USER_ROLES = require('../constants/user-roles');
const protocolController = require('../controllers/protocol-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const allowRoles = require('../middlewares/role-middleware');
const validate = require('../middlewares/validation-middleware');
const asyncHandler = require('../utils/async-handler');
const {
  createProtocolSchema,
  emptyBodySchema,
  protocolIdParamsSchema,
  protocolListQuerySchema,
  protocolVersionParamsSchema,
  reasonSchema,
  updateProtocolSchema,
} = require('../validators/protocol-validators');

const router = express.Router();
const allRoles = Object.values(USER_ROLES);

router.use(authMiddleware);

router.post(
  '/',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(createProtocolSchema),
  asyncHandler(protocolController.createProtocol),
);
router.get(
  '/',
  allowRoles(...allRoles),
  validate(protocolListQuerySchema, 'query'),
  asyncHandler(protocolController.listProtocols),
);
router.get(
  '/:id/versions/:versionNumber',
  allowRoles(...allRoles),
  validate(protocolVersionParamsSchema, 'params'),
  asyncHandler(protocolController.getVersion),
);
router.get(
  '/:id/versions',
  allowRoles(...allRoles),
  validate(protocolIdParamsSchema, 'params'),
  asyncHandler(protocolController.listVersions),
);
router.patch(
  '/:id/activate',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(protocolIdParamsSchema, 'params'),
  validate(emptyBodySchema),
  asyncHandler(protocolController.activateProtocol),
);
router.patch(
  '/:id/pause',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(protocolIdParamsSchema, 'params'),
  validate(reasonSchema),
  asyncHandler(protocolController.pauseProtocol),
);
router.patch(
  '/:id/close',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(protocolIdParamsSchema, 'params'),
  validate(reasonSchema),
  asyncHandler(protocolController.closeProtocol),
);
router.patch(
  '/:id/cancel',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(protocolIdParamsSchema, 'params'),
  validate(emptyBodySchema),
  asyncHandler(protocolController.cancelProtocol),
);
router.patch(
  '/:id',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(protocolIdParamsSchema, 'params'),
  validate(updateProtocolSchema),
  asyncHandler(protocolController.updateProtocol),
);
router.get(
  '/:id',
  allowRoles(...allRoles),
  validate(protocolIdParamsSchema, 'params'),
  asyncHandler(protocolController.getProtocol),
);

module.exports = router;
