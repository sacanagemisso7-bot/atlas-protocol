jest.mock('../../src/models/professional-profile', () => ({
  findOne: jest.fn(),
}));

const ProfessionalProfile = require('../../src/models/professional-profile');
const professionalApprovalMiddleware = require(
  '../../src/middlewares/professional-approval-middleware'
);

function executeMiddleware(request) {
  return new Promise((resolve) => {
    professionalApprovalMiddleware(request, {}, (error) => resolve(error));
  });
}

describe('professionalApprovalMiddleware', () => {
  it('ignora usuários que não são profissionais', async () => {
    const error = await executeMiddleware({ user: { role: 'athlete' } });

    expect(error).toBeUndefined();
    expect(ProfessionalProfile.findOne).not.toHaveBeenCalled();
  });

  it('rejeita profissional sem perfil de verificação', async () => {
    ProfessionalProfile.findOne.mockResolvedValue(null);

    const error = await executeMiddleware({
      user: { id: 'professional-id', role: 'professional' },
    });

    expect(error).toEqual(
      expect.objectContaining({
        code: 'PROFESSIONAL_VERIFICATION_REQUIRED',
        statusCode: 403,
      }),
    );
  });

  it.each([
    ['pending', 'PROFESSIONAL_PENDING_APPROVAL'],
    ['rejected', 'PROFESSIONAL_REJECTED'],
  ])(
    'rejeita profissional com verificação %s',
    async (verificationStatus, expectedCode) => {
      ProfessionalProfile.findOne.mockResolvedValue({ verificationStatus });

      const error = await executeMiddleware({
        user: { id: 'professional-id', role: 'professional' },
      });

      expect(error).toEqual(
        expect.objectContaining({
          code: expectedCode,
          statusCode: 403,
        }),
      );
    },
  );

  it('permite profissional aprovado e anexa seu perfil', async () => {
    const profile = { verificationStatus: 'approved' };
    const request = {
      user: { id: 'professional-id', role: 'professional' },
    };
    ProfessionalProfile.findOne.mockResolvedValue(profile);

    const error = await executeMiddleware(request);

    expect(error).toBeUndefined();
    expect(request.professionalProfile).toBe(profile);
    expect(ProfessionalProfile.findOne).toHaveBeenCalledWith({
      userId: 'professional-id',
    });
  });
});
