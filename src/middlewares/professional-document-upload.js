const path = require('path');

const multer = require('multer');

const env = require('../config/env');
const ERROR_CODES = require('../constants/error-codes');
const AppError = require('../utils/app-error');

const PDF_MIME_TYPE = 'application/pdf';
const PDF_SIGNATURE = Buffer.from('%PDF-');

function uploadError(code, message) {
  return new AppError(400, code, message);
}

function isPdfName(originalName) {
  return path.extname(originalName).toLowerCase() === '.pdf';
}

function hasPdfSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PDF_SIGNATURE.length) {
    return false;
  }

  return buffer.subarray(0, 1024).includes(PDF_SIGNATURE);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.professionalDocumentMaxBytes,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== PDF_MIME_TYPE || !isPdfName(file.originalname)) {
      return callback(
        uploadError(
          ERROR_CODES.INVALID_UPLOAD_TYPE,
          'O documento deve ser um arquivo PDF.',
        ),
      );
    }

    return callback(null, true);
  },
});

function professionalDocumentUpload(request, response, next) {
  upload.single('document')(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          uploadError(
            ERROR_CODES.UPLOAD_TOO_LARGE,
            'O documento excede o tamanho máximo permitido.',
          ),
        );
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          uploadError(
            ERROR_CODES.PROFESSIONAL_VERIFICATION_REQUIRED,
            'O documento de comprovação é obrigatório.',
          ),
        );
      }
    }

    if (error) {
      return next(error);
    }

    if (!request.file) {
      return next(
        uploadError(
          ERROR_CODES.PROFESSIONAL_VERIFICATION_REQUIRED,
          'O documento de comprovação é obrigatório.',
        ),
      );
    }

    if (!hasPdfSignature(request.file.buffer)) {
      request.file = undefined;
      return next(
        uploadError(
          ERROR_CODES.INVALID_UPLOAD_TYPE,
          'O conteúdo do documento não corresponde a um PDF válido.',
        ),
      );
    }

    return next();
  });
}

module.exports = professionalDocumentUpload;
