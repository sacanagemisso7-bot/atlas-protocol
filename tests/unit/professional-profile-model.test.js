const mongoose = require('mongoose');

const ProfessionalProfile = require('../../src/models/professional-profile');

function createDocumentMetadata() {
  return {
    storageKey: '8e9df447-3e9d-4f23-83dd-9337f635665c.pdf',
    url: '/private-files/8e9df447-3e9d-4f23-83dd-9337f635665c.pdf',
    originalName: 'comprovante.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 128,
  };
}

function createProfile(overrides = {}) {
  return new ProfessionalProfile({
    userId: new mongoose.Types.ObjectId(),
    verificationDocument: createDocumentMetadata(),
    ...overrides,
  });
}

describe('ProfessionalProfile model', () => {
  it('define collection, estados, proteção do documento e índices oficiais', () => {
    expect(ProfessionalProfile.collection.name).toBe('professional_profiles');
    expect(
      ProfessionalProfile.schema.path('verificationStatus').options.enum,
    ).toEqual(expect.arrayContaining(['pending', 'approved', 'rejected']));
    expect(
      ProfessionalProfile.schema.path('verificationStatus').options.default,
    ).toBe('pending');
    expect(
      ProfessionalProfile.schema.path('verificationDocument.storageKey').options
        .select,
    ).toBe(false);
    expect(
      ProfessionalProfile.schema.path('verificationDocument.url').options.select,
    ).toBe(false);
    expect(ProfessionalProfile.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ userId: 1 }, expect.objectContaining({ unique: true })],
        [
          { verificationStatus: 1, submittedAt: 1 },
          expect.any(Object),
        ],
      ]),
    );
  });

  it('não expõe referências privadas do documento ao serializar', () => {
    const serialized = createProfile().toJSON();

    expect(serialized.verificationDocument).toMatchObject({
      originalName: 'comprovante.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
    });
    expect(serialized.verificationDocument).not.toHaveProperty('storageKey');
    expect(serialized.verificationDocument).not.toHaveProperty('url');
  });

  it('exige dados de revisão ao aprovar', async () => {
    const profile = createProfile({ verificationStatus: 'approved' });

    await expect(profile.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        reviewedAt: expect.any(Object),
        reviewedBy: expect.any(Object),
      }),
    });
  });

  it('exige motivo e dados de revisão ao rejeitar', async () => {
    const profile = createProfile({ verificationStatus: 'rejected' });

    await expect(profile.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        reviewedAt: expect.any(Object),
        reviewedBy: expect.any(Object),
        rejectionReason: expect.any(Object),
      }),
    });
  });

  it('impede dados de revisão enquanto a verificação está pendente', async () => {
    const profile = createProfile({
      reviewedAt: new Date(),
      reviewedBy: new mongoose.Types.ObjectId(),
    });

    await expect(profile.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        verificationStatus: expect.any(Object),
      }),
    });
  });
});
