# Atlas Protocol — Contratos da API

## 1. Convenções

Base URL:

```text
/api/v1
```

Autenticação:

```http
Authorization: Bearer <token>
```

Content-Type:

```http
Content-Type: application/json
```

Paginação:

```text
?page=1&limit=20
```

Limite máximo: 100.

Ordenação padrão: `createdAt desc`.

## 2. Respostas

### Sucesso

```json
{
  "success": true,
  "data": {},
  "message": "Operação realizada com sucesso."
}
```

### Paginação

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "fields": [
      {
        "field": "email",
        "message": "Informe um e-mail válido."
      }
    ]
  }
}
```

## 3. Status HTTP

- `200`: consulta ou alteração concluída;
- `201`: recurso criado;
- `204`: exclusão sem corpo;
- `400`: payload ou parâmetro inválido;
- `401`: autenticação ausente ou inválida;
- `403`: usuário autenticado sem permissão;
- `404`: recurso inexistente ou invisível ao usuário;
- `409`: conflito de regra ou unicidade;
- `422`: estado válido sintaticamente, mas operação não permitida pelo domínio;
- `500`: erro interno.

## 4. Códigos de erro

- `VALIDATION_ERROR`
- `INVALID_OBJECT_ID`
- `AUTH_REQUIRED`
- `INVALID_TOKEN`
- `TOKEN_EXPIRED`
- `INVALID_CREDENTIALS`
- `USER_BLOCKED`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `EMAIL_ALREADY_EXISTS`
- `ACTIVE_LINK_ALREADY_EXISTS`
- `ATHLETE_LINK_REQUIRED`
- `INVALID_STATE_TRANSITION`
- `PROTOCOL_EMPTY`
- `PROTOCOL_READ_ONLY`
- `CHECKIN_ALREADY_EXISTS`
- `CHECKIN_ALREADY_SUBMITTED`
- `INVENTORY_INSUFFICIENT`
- `INVENTORY_ITEM_EXPIRED`
- `DUPLICATE_RESOURCE`
- `INTERNAL_ERROR`

## 5. Auth

### POST `/auth/register`

Cria usuário atleta. Criação de profissional e admin fica restrita ao administrador ou seed.

Request:

```json
{
  "name": "Rafael Freire",
  "email": "rafael@example.com",
  "password": "SenhaForte123!"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "ObjectId",
      "name": "Rafael Freire",
      "email": "rafael@example.com",
      "role": "athlete",
      "active": true
    },
    "token": "jwt"
  },
  "message": "Cadastro realizado com sucesso."
}
```

Erros: `VALIDATION_ERROR`, `EMAIL_ALREADY_EXISTS`.

### POST `/auth/login`

```json
{
  "email": "rafael@example.com",
  "password": "SenhaForte123!"
}
```

Response `200`: usuário seguro + token.

Erros: `INVALID_CREDENTIALS`, `USER_BLOCKED`.

### GET `/auth/me`

Retorna usuário autenticado.

### PATCH `/auth/password`

```json
{
  "currentPassword": "SenhaAtual123!",
  "newPassword": "NovaSenha123!"
}
```

## 6. Users

### GET `/users`

Admin. Filtros:

- `role`
- `active`
- `search`
- paginação

### GET `/users/:id`

Admin ou próprio usuário.

### PATCH `/users/:id`

Admin ou próprio usuário.

Campos do próprio usuário:

```json
{
  "name": "Novo nome"
}
```

Campos administrativos:

```json
{
  "name": "Nome",
  "active": true,
  "role": "professional"
}
```

### PATCH `/users/:id/block`

Admin.

```json
{
  "blocked": true
}
```

## 7. Links

### POST `/links`

Admin no MVP.

```json
{
  "professionalId": "ObjectId",
  "athleteId": "ObjectId"
}
```

Response `201`: vínculo `active`.

### GET `/links`

- admin: todos;
- profissional: próprios;
- atleta: próprios.

Filtros: `status`, `professionalId`, `athleteId`.

### PATCH `/links/:id/end`

```json
{
  "reason": "Encerramento do acompanhamento."
}
```

## 8. Substances

### GET `/substances`

Filtros:

- `category`
- `active`
- `search`
- `scope`

### POST `/substances`

Admin ou profissional.

```json
{
  "name": "Creatina",
  "category": "supplement",
  "description": "Item informativo.",
  "scope": "private"
}
```

### GET `/substances/:id`

### PATCH `/substances/:id`

Admin ou proprietário do item privado.

### DELETE `/substances/:id`

Desativação lógica. Response `204`.

## 9. Protocols

### POST `/protocols`

Profissional com vínculo ativo.

```json
{
  "athleteId": "ObjectId",
  "title": "Protocolo de acompanhamento",
  "objective": "Organização do acompanhamento.",
  "startDate": "2026-08-01T00:00:00.000Z",
  "endDate": "2026-10-01T00:00:00.000Z",
  "continuous": false,
  "items": [
    {
      "substanceId": "ObjectId",
      "instructions": "Informação registrada pelo profissional.",
      "frequencyType": "weekly",
      "weekDays": [1, 4],
      "time": "08:00"
    }
  ]
}
```

Cria protocolo `draft` e versão 1.

### GET `/protocols`

Filtros:

- `athleteId`
- `professionalId`
- `status`
- `from`
- `to`

Escopo aplicado automaticamente.

### GET `/protocols/:id`

Retorna protocolo e versão atual.

### PATCH `/protocols/:id`

Somente `draft`.

Payload parcial:

```json
{
  "title": "Novo título",
  "objective": "Novo objetivo",
  "startDate": "2026-08-02T00:00:00.000Z",
  "items": []
}
```

### DELETE `/protocols/:id`

Somente rascunho nunca ativado. Response `204`.

### POST `/protocols/:id/activate`

Sem payload obrigatório.

Erros: `PROTOCOL_EMPTY`, `ATHLETE_LINK_REQUIRED`, `INVALID_STATE_TRANSITION`.

### POST `/protocols/:id/versions`

Cria nova versão para protocolo ativo ou pausado.

```json
{
  "changeReason": "Ajuste registrado pelo profissional.",
  "startDate": "2026-08-15T00:00:00.000Z",
  "endDate": "2026-10-15T00:00:00.000Z",
  "continuous": false,
  "items": []
}
```

### GET `/protocols/:id/versions`

### GET `/protocols/:id/versions/:version`

### POST `/protocols/:id/pause`

```json
{
  "reason": "Pausa temporária."
}
```

### POST `/protocols/:id/resume`

### POST `/protocols/:id/close`

```json
{
  "reason": "Acompanhamento encerrado."
}
```

### POST `/protocols/:id/cancel`

Somente rascunho.

## 10. Tracking records

### POST `/tracking-records`

Profissional ou atleta quando permitido.

```json
{
  "athleteId": "ObjectId",
  "title": "Registro manual",
  "scheduledFor": "2026-08-05T11:00:00.000Z",
  "notes": "Observação opcional."
}
```

### GET `/tracking-records`

Filtros:

- `athleteId`
- `protocolId`
- `status`
- `from`
- `to`

### GET `/tracking-records/:id`

### POST `/tracking-records/:id/complete`

```json
{
  "completedAt": "2026-08-05T11:10:00.000Z",
  "notes": "Registro concluído."
}
```

### POST `/tracking-records/:id/miss`

```json
{
  "reason": "Não realizado."
}
```

### POST `/tracking-records/:id/cancel`

```json
{
  "reason": "Cancelado."
}
```

### PATCH `/tracking-records/:id/correction`

Profissional ou admin, com auditoria.

```json
{
  "notes": "Correção documentada.",
  "reason": "Erro de digitação."
}
```

## 11. Check-ins

### POST `/check-ins`

Atleta.

```json
{
  "referenceWeek": "2026-08-03T00:00:00.000Z",
  "answers": {
    "weightKg": 80.5,
    "sleepHours": 7.5,
    "energyScore": 8,
    "adherenceScore": 9,
    "reportedEffects": ["Observação relatada"],
    "notes": "Semana estável."
  }
}
```

Pode criar diretamente como rascunho `pending`.

### GET `/check-ins`

Filtros: `athleteId`, `status`, `from`, `to`.

### GET `/check-ins/:id`

### PATCH `/check-ins/:id`

Atleta, apenas `pending`.

### POST `/check-ins/:id/submit`

Muda para `submitted`.

### POST `/check-ins/:id/review`

Profissional vinculado.

```json
{
  "reviewComment": "Feedback de acompanhamento."
}
```

### POST `/check-ins/:id/reopen`

Admin ou profissional vinculado.

```json
{
  "reason": "Correção solicitada."
}
```

## 12. Exams

### POST `/exams`

```json
{
  "athleteId": "ObjectId",
  "title": "Exame de acompanhamento",
  "examDate": "2026-08-01T00:00:00.000Z",
  "laboratory": "Laboratório exemplo",
  "results": [
    {
      "marker": "Marcador",
      "value": "10",
      "unit": "unidade",
      "referenceRange": "informado pelo laboratório"
    }
  ],
  "notes": "Sem interpretação automática."
}
```

### GET `/exams`

Filtros: `athleteId`, `from`, `to`, `archived`.

### GET `/exams/:id`

### PATCH `/exams/:id`

Atualiza metadados permitidos.

### DELETE `/exams/:id`

Arquiva. Response `204`.

## 13. Physical progress

### POST `/progress`

```json
{
  "athleteId": "ObjectId",
  "referenceDate": "2026-08-01T00:00:00.000Z",
  "weightKg": 80.5,
  "bodyFatPercent": 12.5,
  "measurements": {
    "chestCm": 105,
    "waistCm": 82,
    "armCm": 40
  },
  "notes": "Registro de evolução."
}
```

### GET `/progress`

Filtros: `athleteId`, `from`, `to`.

### GET `/progress/:id`

### PATCH `/progress/:id`

### DELETE `/progress/:id`

Arquivamento lógico.

## 14. Inventory

### POST `/inventory`

```json
{
  "substanceId": "ObjectId",
  "name": "Produto cadastrado",
  "brand": "Marca",
  "batch": "L001",
  "unit": "vial",
  "quantity": 3,
  "lowStockThreshold": 1,
  "expirationDate": "2027-01-01T00:00:00.000Z"
}
```

### GET `/inventory`

Filtros: `search`, `expired`, `lowStock`, `archived`.

### GET `/inventory/:id`

### PATCH `/inventory/:id`

Não alterar quantidade diretamente. Quantidade muda por movimentação.

### POST `/inventory/:id/movements`

```json
{
  "type": "out",
  "quantity": 1,
  "reason": "Baixa manual."
}
```

Erros: `INVENTORY_INSUFFICIENT`, `INVENTORY_ITEM_EXPIRED`.

### GET `/inventory/:id/movements`

### DELETE `/inventory/:id`

Arquiva.

## 15. Notifications

### GET `/notifications`

Filtros: `read`, paginação.

### PATCH `/notifications/:id/read`

### PATCH `/notifications/read-all`

### DELETE `/notifications/:id`

Remove apenas da visualização do usuário, sem apagar auditoria relacionada.

## 16. Dashboards

### GET `/dashboard/admin`

Cards:

- usuários por perfil;
- usuários ativos;
- vínculos ativos;
- protocolos por status.

### GET `/dashboard/professional`

Cards:

- atletas vinculados;
- check-ins aguardando revisão;
- protocolos ativos;
- registros atrasados.

### GET `/dashboard/athlete`

Cards:

- protocolo atual;
- próximos registros;
- check-in da semana;
- notificações não lidas;
- itens de estoque baixo.

## 17. Audit

### GET `/audit-logs`

Admin.

Filtros:

- `actorId`
- `entityType`
- `entityId`
- `action`
- `from`
- `to`

## 18. Health

### GET `/health`

Público.

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-17T22:00:00.000Z"
  }
}
```

## 19. Validação transversal

- ObjectId inválido: `400 INVALID_OBJECT_ID`;
- recurso fora do escopo do usuário: preferir `404`;
- e-mail sempre normalizado;
- strings com trim;
- campos desconhecidos rejeitados nos validators;
- datas ISO 8601;
- paginação normalizada;
- filtros não autorizados ignorados ou rejeitados;
- IDs de ownership nunca confiados sem verificação.
