const express = require('express');

const USER_ROLES = require('../constants/user-roles');
const auditLogController = require('../controllers/audit-log-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const allowRoles = require('../middlewares/role-middleware');
const validate = require('../middlewares/validation-middleware');
const asyncHandler = require('../utils/async-handler');
const {
  auditLogListQuerySchema,
} = require('../validators/audit-log-validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  allowRoles(USER_ROLES.ADMIN),
  validate(auditLogListQuerySchema, 'query'),
  asyncHandler(auditLogController.listAuditLogs),
);

module.exports = router;
