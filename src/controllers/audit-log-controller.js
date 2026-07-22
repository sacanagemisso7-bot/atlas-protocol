const auditService = require('../services/audit-service');

async function listAuditLogs(request, response) {
  const { auditLogs, meta } = await auditService.listAuditLogs(request.query);

  return response.status(200).json({
    success: true,
    data: auditLogs,
    meta,
  });
}

module.exports = { listAuditLogs };
