const express = require('express');

const USER_ROLES = require('../constants/user-roles');
const trackingRecordController = require('../controllers/tracking-record-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const allowRoles = require('../middlewares/role-middleware');
const validate = require('../middlewares/validation-middleware');
const asyncHandler = require('../utils/async-handler');
const {
  createTrackingRecordSchema,
  trackingRecordIdParamsSchema,
  trackingRecordListQuerySchema,
  transitionTrackingRecordSchema,
  updateTrackingRecordSchema,
} = require('../validators/tracking-record-validators');

const router = express.Router();
const allRoles = Object.values(USER_ROLES);

router.use(authMiddleware);

router.post(
  '/',
  allowRoles(USER_ROLES.PROFESSIONAL, USER_ROLES.ATHLETE),
  validate(createTrackingRecordSchema),
  asyncHandler(trackingRecordController.createTrackingRecord),
);
router.get(
  '/',
  allowRoles(...allRoles),
  validate(trackingRecordListQuerySchema, 'query'),
  asyncHandler(trackingRecordController.listTrackingRecords),
);
router.patch(
  '/:id/status',
  allowRoles(USER_ROLES.PROFESSIONAL, USER_ROLES.ATHLETE),
  validate(trackingRecordIdParamsSchema, 'params'),
  validate(transitionTrackingRecordSchema),
  asyncHandler(trackingRecordController.transitionTrackingRecord),
);
router.patch(
  '/:id',
  allowRoles(USER_ROLES.PROFESSIONAL),
  validate(trackingRecordIdParamsSchema, 'params'),
  validate(updateTrackingRecordSchema),
  asyncHandler(trackingRecordController.updateTrackingRecord),
);
router.get(
  '/:id',
  allowRoles(...allRoles),
  validate(trackingRecordIdParamsSchema, 'params'),
  asyncHandler(trackingRecordController.getTrackingRecord),
);

module.exports = router;
