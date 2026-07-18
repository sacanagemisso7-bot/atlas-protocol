# Atlas Protocol — Modelos de banco de dados

## 1. Convenções gerais

- Banco: MongoDB.
- ODM: Mongoose.
- IDs: `ObjectId`.
- Timestamps: `createdAt` e `updatedAt`.
- Datas persistidas em UTC.
- Exclusão lógica quando houver histórico.
- Campos sensíveis usam `select: false`.
- Índices únicos devem ser tratados também no service.

## 2. User

Collection: `users`

```js
{
  name: String,
  email: String,
  passwordHash: String,
  role: "admin" | "professional" | "athlete",
  active: Boolean,
  blockedAt: Date | null,
  lastLoginAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- `name`: obrigatório, 2–120 caracteres;
- `email`: obrigatório, lowercase, trim, formato válido;
- `passwordHash`: obrigatório, `select: false`;
- `role`: obrigatório;
- `active`: default `true`.

Índices:

```js
{ email: 1 } // unique
{ role: 1, active: 1 }
```

Nunca retornar `passwordHash`.

## 3. ProfessionalAthleteLink

Collection: `professional_athlete_links`

```js
{
  professionalId: ObjectId,
  athleteId: ObjectId,
  status: "pending" | "active" | "ended",
  invitedBy: ObjectId | null,
  startedAt: Date | null,
  endedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- profissional deve possuir role `professional`;
- atleta deve possuir role `athlete`;
- usuário não pode vincular-se a si mesmo;
- `endedAt` obrigatório quando status for `ended`.

Índices:

```js
{ professionalId: 1, athleteId: 1, status: 1 }
{ athleteId: 1, status: 1 }
```

Regra de unicidade lógica: não pode haver mais de um vínculo `active` para o mesmo par.

## 4. Substance

Collection: `substances`

```js
{
  name: String,
  slug: String,
  category: "hormone" | "peptide" | "supplement" | "vitamin" | "medication" | "other",
  description: String | null,
  active: Boolean,
  scope: "global" | "private",
  ownerId: ObjectId | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- nome obrigatório, 2–120;
- `slug` obrigatório;
- `ownerId` obrigatório quando scope = `private`;
- `ownerId` nulo quando scope = `global`.

Índices:

```js
{ slug: 1, scope: 1, ownerId: 1 }
{ category: 1, active: 1 }
```

Não armazenar orientação automática de uso.

## 5. Protocol

Collection: `protocols`

```js
{
  athleteId: ObjectId,
  professionalId: ObjectId,
  title: String,
  objective: String | null,
  status: "draft" | "active" | "paused" | "closed" | "cancelled",
  currentVersion: Number,
  startDate: Date,
  endDate: Date | null,
  continuous: Boolean,
  activatedAt: Date | null,
  pausedAt: Date | null,
  closedAt: Date | null,
  cancelledAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- título: 3–160;
- `currentVersion`: inteiro >= 1;
- `endDate >= startDate`;
- `continuous = true` permite `endDate = null`;
- profissional precisa ter vínculo ativo.

Índices:

```js
{ athleteId: 1, status: 1 }
{ professionalId: 1, status: 1 }
{ athleteId: 1, createdAt: -1 }
```

## 6. ProtocolVersion

Collection: `protocol_versions`

```js
{
  protocolId: ObjectId,
  version: Number,
  createdBy: ObjectId,
  changeReason: String | null,
  startDate: Date,
  endDate: Date | null,
  continuous: Boolean,
  items: [
    {
      substanceId: ObjectId,
      substanceSnapshot: {
        name: String,
        category: String
      },
      instructions: String,
      frequencyType: "daily" | "weekly" | "custom",
      weekDays: [Number],
      time: String | null,
      startDate: Date | null,
      endDate: Date | null,
      active: Boolean
    }
  ],
  createdAt: Date
}
```

Regras:

- combinação `protocolId + version` única;
- snapshot obrigatório;
- `weekDays`: valores 1–7, sem duplicidade;
- `time`: formato `HH:mm`;
- versão publicada é imutável.

Índices:

```js
{ protocolId: 1, version: 1 } // unique
```

## 7. TrackingRecord

Collection: `tracking_records`

```js
{
  athleteId: ObjectId,
  professionalId: ObjectId,
  protocolId: ObjectId | null,
  protocolVersion: Number | null,
  protocolItemId: String | null,
  type: "scheduled" | "manual",
  title: String,
  scheduledFor: Date,
  status: "scheduled" | "completed" | "missed" | "cancelled",
  completedAt: Date | null,
  completedBy: ObjectId | null,
  notes: String | null,
  createdAt: Date,
  updatedAt: Date
}
```

Índices:

```js
{ athleteId: 1, scheduledFor: 1 }
{ protocolId: 1, status: 1 }
{ athleteId: 1, status: 1, scheduledFor: 1 }
```

## 8. CheckIn

Collection: `check_ins`

```js
{
  athleteId: ObjectId,
  professionalId: ObjectId,
  referenceWeek: Date,
  status: "pending" | "submitted" | "reviewed",
  answers: {
    weightKg: Number | null,
    sleepHours: Number | null,
    energyScore: Number | null,
    adherenceScore: Number | null,
    reportedEffects: [String],
    notes: String | null
  },
  submittedAt: Date | null,
  reviewedAt: Date | null,
  reviewedBy: ObjectId | null,
  reviewComment: String | null,
  reopenedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- `referenceWeek` normalizada para segunda-feira;
- `weightKg > 0`;
- scores entre 0 e 10;
- sono entre 0 e 24;
- arrays com limite razoável.

Índice:

```js
{ athleteId: 1, referenceWeek: 1 } // unique
{ professionalId: 1, status: 1, referenceWeek: -1 }
```

## 9. Exam

Collection: `exams`

```js
{
  athleteId: ObjectId,
  professionalId: ObjectId | null,
  title: String,
  examDate: Date,
  laboratory: String | null,
  results: [
    {
      marker: String,
      value: String,
      unit: String | null,
      referenceRange: String | null
    }
  ],
  fileUrl: String | null,
  notes: String | null,
  archivedAt: Date | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

Regras:

- ao menos título e data;
- valores ficam como string para suportar formatos diversos;
- sistema não interpreta resultado.

Índices:

```js
{ athleteId: 1, examDate: -1 }
{ athleteId: 1, archivedAt: 1 }
```

## 10. PhysicalProgress

Collection: `physical_progress`

```js
{
  athleteId: ObjectId,
  recordedBy: ObjectId,
  referenceDate: Date,
  weightKg: Number | null,
  bodyFatPercent: Number | null,
  measurements: {
    chestCm: Number | null,
    waistCm: Number | null,
    armCm: Number | null,
    thighCm: Number | null,
    calfCm: Number | null
  },
  notes: String | null,
  archivedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- valores não negativos;
- `bodyFatPercent` entre 0 e 100;
- pelo menos um dado corporal ou observação.

Índices:

```js
{ athleteId: 1, referenceDate: -1 }
```

## 11. InventoryItem

Collection: `inventory_items`

```js
{
  ownerId: ObjectId,
  substanceId: ObjectId | null,
  name: String,
  brand: String | null,
  batch: String | null,
  unit: "unit" | "ml" | "mg" | "g" | "capsule" | "tablet" | "vial" | "box",
  quantity: Number,
  lowStockThreshold: Number | null,
  expirationDate: Date | null,
  archivedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

Validações:

- quantidade >= 0;
- threshold >= 0;
- nome obrigatório.

Índices:

```js
{ ownerId: 1, archivedAt: 1 }
{ ownerId: 1, expirationDate: 1 }
```

## 12. InventoryMovement

Collection: `inventory_movements`

```js
{
  inventoryItemId: ObjectId,
  ownerId: ObjectId,
  type: "in" | "out" | "adjustment",
  quantity: Number,
  previousQuantity: Number,
  resultingQuantity: Number,
  reason: String,
  relatedTrackingRecordId: ObjectId | null,
  createdBy: ObjectId,
  createdAt: Date
}
```

Regras:

- quantidade > 0;
- saída não pode gerar estoque negativo;
- movimentação é imutável.

Índices:

```js
{ inventoryItemId: 1, createdAt: -1 }
{ ownerId: 1, createdAt: -1 }
```

## 13. Notification

Collection: `notifications`

```js
{
  userId: ObjectId,
  type: String,
  title: String,
  message: String,
  entityType: String | null,
  entityId: ObjectId | null,
  readAt: Date | null,
  createdAt: Date
}
```

Índices:

```js
{ userId: 1, readAt: 1, createdAt: -1 }
```

## 14. AuditLog

Collection: `audit_logs`

```js
{
  actorId: ObjectId | null,
  action: String,
  entityType: String,
  entityId: ObjectId | null,
  metadata: Object,
  ipHash: String | null,
  createdAt: Date
}
```

Regras:

- somente aplicação escreve;
- sem senha, token ou conteúdo sensível completo;
- documento imutável.

Índices:

```js
{ entityType: 1, entityId: 1, createdAt: -1 }
{ actorId: 1, createdAt: -1 }
```

## 15. Relacionamentos

```text
User (professional)
  -> ProfessionalAthleteLink
  -> User (athlete)

Protocol
  -> athleteId
  -> professionalId
  -> ProtocolVersion[]

ProtocolVersion
  -> Substance snapshots

TrackingRecord
  -> Protocol / ProtocolVersion
  -> athlete / professional

CheckIn, Exam, PhysicalProgress
  -> athlete
  -> professional when applicable

InventoryItem
  -> owner
  -> InventoryMovement[]

Notification
  -> user
```

## 16. Exclusão e cascata

Não usar cascade delete automático para histórico.

Ao desativar usuário:

- bloquear login;
- manter vínculos e histórico;
- impedir criação de novos dados;
- não apagar protocolos, check-ins, exames ou auditoria.

Ao desativar substância:

- ocultar de novas seleções;
- manter snapshots históricos.

Ao excluir rascunho:

- excluir versões de rascunho sem uso;
- não excluir dados publicados.
