const express = require('express');

const USER_ROLES = require('../constants/user-roles');
const linkController = require('../controllers/link-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const professionalApprovalMiddleware = require('../middlewares/professional-approval-middleware');
const allowRoles = require('../middlewares/role-middleware');
const validate = require('../middlewares/validation-middleware');
const asyncHandler = require('../utils/async-handler');
const {
  createLinkSchema,
  endLinkSchema,
  linkIdParamsSchema,
  linkListQuerySchema,
} = require('../validators/link-validators');

const router = express.Router();
const allRoles = Object.values(USER_ROLES);

router.use(authMiddleware);

router.post(
  '/',
  allowRoles(USER_ROLES.ADMIN),
  professionalApprovalMiddleware,
  validate(createLinkSchema),
  asyncHandler(linkController.createLink),
);
router.get(
  '/',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(linkListQuerySchema, 'query'),
  asyncHandler(linkController.listLinks),
);
router.get(
  '/:id',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(linkIdParamsSchema, 'params'),
  asyncHandler(linkController.getLink),
);
router.patch(
  '/:id/end',
  allowRoles(...allRoles),
  professionalApprovalMiddleware,
  validate(linkIdParamsSchema, 'params'),
  validate(endLinkSchema),
  asyncHandler(linkController.endLink),
);

module.exports = router;
