const express = require('express');

const USER_ROLES = require('../constants/user-roles');
const protocolController = require('../controllers/protocol-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const professionalApprovalMiddleware = require('../middlewares/professional-approval-middleware');
const allowRoles = require('../middlewares/role-middleware');
const validate = require('../middlewares/validation-middleware');
const asyncHandler = require('../utils/async-handler');
const {
  createProtocolVersionSchema,
  createProtocolSchema,
  protocolIdParamsSchema,
  protocolListQuerySchema,
  protocolStatusSchema,
  protocolVersionParamsSchema,
  updateProtocolSchema,
} = require('../validators/protocol-validators');

const router = express.Router();
const allRoles = Object.values(USER_ROLES);

router.use(authMiddleware);

router.post(
  '/',
  allowRoles(USER_ROLES.PROFESSIONAL),
  professionalApprovalMiddleware,
  validate(createProtocolSchema),
  asyncHandler(protocolController.createProtocol),
);
router.get(
  '/',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(protocolListQuerySchema, 'query'),
  asyncHandler(protocolController.listProtocols),
);
router.get(
  '/:id/versions/:version',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(protocolVersionParamsSchema, 'params'),
  asyncHandler(protocolController.getVersion),
);
router.get(
  '/:id/versions',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(protocolIdParamsSchema, 'params'),
  asyncHandler(protocolController.listVersions),
);
router.post(
  '/:id/versions',
  allowRoles(USER_ROLES.PROFESSIONAL),
  professionalApprovalMiddleware,
  validate(protocolIdParamsSchema, 'params'),
  validate(createProtocolVersionSchema),
  asyncHandler(protocolController.createProtocolVersion),
);
router.patch(
  '/:id/status',
  allowRoles(USER_ROLES.PROFESSIONAL),
  professionalApprovalMiddleware,
  validate(protocolIdParamsSchema, 'params'),
  validate(protocolStatusSchema),
  asyncHandler(protocolController.updateProtocolStatus),
);
router.patch(
  '/:id',
  allowRoles(USER_ROLES.PROFESSIONAL),
  professionalApprovalMiddleware,
  validate(protocolIdParamsSchema, 'params'),
  validate(updateProtocolSchema),
  asyncHandler(protocolController.updateProtocol),
);
router.get(
  '/:id',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(protocolIdParamsSchema, 'params'),
  asyncHandler(protocolController.getProtocol),
);

module.exports = router;
