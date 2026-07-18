# Atlas Protocol — Instruções para agentes de código

## 1. Objetivo do projeto

O Atlas Protocol é uma plataforma web para acompanhamento de atletas por profissionais, com foco em protocolos, registros de acompanhamento, check-ins, exames, evolução física, estoque e notificações.

O sistema organiza informações. Ele não diagnostica, não prescreve, não recomenda substâncias, não sugere doses e não substitui acompanhamento profissional.

## 2. Fontes de verdade

Antes de alterar qualquer funcionalidade, leia:

1. `docs/domain-rules.md`
2. `docs/api-contracts.md`
3. `docs/database-models.md`
4. `docs/permissions.md`

Em caso de conflito:

1. regras de domínio;
2. permissões;
3. contratos da API;
4. modelos de banco;
5. implementação existente.

Não altere uma regra, contrato, permissão ou modelo silenciosamente. Mudanças de contrato exigem atualização da documentação correspondente.

## 3. Stack obrigatória

### Backend

- Node.js
- JavaScript
- Express.js
- MongoDB
- Mongoose
- JWT
- bcrypt
- Joi ou express-validator
- Jest
- Supertest

### Frontend

- Angular
- TypeScript
- Angular Router
- Reactive Forms
- HttpClient
- Guards e interceptors

## 4. Arquitetura do backend

Fluxo obrigatório:

```text
route
  -> authMiddleware
  -> roleMiddleware
  -> validationMiddleware
  -> controller
  -> service
  -> model
  -> response
```

Responsabilidades:

- `routes`: registra endpoints e middlewares;
- `middlewares`: autenticação, autorização, validação e erros;
- `controllers`: recebe HTTP, chama services e envia resposta;
- `services`: contém regras de negócio;
- `models`: schemas, índices e métodos do documento;
- `validators`: schemas de entrada;
- `utils`: funções puras e reutilizáveis.

Controllers não devem conter regra de negócio relevante.

Services não devem acessar diretamente `req` ou `res`.

Models não devem depender de controllers ou rotas.

## 5. Estrutura recomendada

```text
src/
  app.js
  server.js
  config/
  controllers/
  middlewares/
  models/
  routes/
  services/
  validators/
  utils/
  constants/
tests/
  integration/
  unit/
scripts/
  seed.js
docs/
```

## 6. Convenções

- Arquivos e diretórios: `kebab-case`.
- Variáveis e funções: `camelCase`.
- Classes e models: `PascalCase`.
- Constantes: `UPPER_SNAKE_CASE`.
- Endpoints: substantivos no plural.
- IDs MongoDB sempre validados antes de consultar.
- Datas persistidas em UTC.
- Textos exibidos ao usuário em português.
- Códigos internos de erro em inglês e `UPPER_SNAKE_CASE`.

## 7. Respostas da API

### Sucesso

```json
{
  "success": true,
  "data": {},
  "message": "Operação realizada com sucesso."
}
```

### Lista paginada

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem legível.",
    "fields": []
  }
}
```

Nunca retornar stack trace em produção.

## 8. Segurança

- Nunca armazenar senha em texto puro.
- Nunca retornar `passwordHash`.
- Usar bcrypt com fator de custo configurável.
- JWT deve conter apenas identificadores e perfil necessários.
- Todas as rotas privadas usam `authMiddleware`.
- Autorização deve ser verificada no backend.
- Filtros de ownership não podem depender apenas do frontend.
- Dados de um atleta só podem ser vistos pelo próprio atleta, profissional vinculado ou administrador quando previsto.
- Não registrar tokens, senhas, documentos ou exames completos em logs.
- `.env` e credenciais nunca entram no Git.
- Toda entrada externa deve ser validada.

## 9. Regras de implementação

- Implementar uma tarefa por vez.
- Não ampliar escopo sem solicitação explícita.
- Não criar módulos de pagamentos, CRM, chat em tempo real ou IA no MVP.
- Não gerar recomendações automáticas de uso.
- Não inserir dados médicos fictícios como verdade clínica.
- Não remover histórico necessário para auditoria.
- Alterações em protocolo ativo devem respeitar versionamento.
- Operações sensíveis devem gerar registro de auditoria quando previsto.
- Listagens devem suportar paginação.
- Consultas devem evitar retornar campos desnecessários.

## 10. Testes

Cada regra de negócio precisa de teste.

Mínimo por endpoint:

- caso de sucesso;
- autenticação ausente;
- perfil sem permissão;
- payload inválido;
- recurso inexistente;
- regra de negócio violada;
- ownership inválido, quando aplicável.

Antes de concluir uma tarefa, executar:

```bash
npm test
npm run lint
```

Se algum comando falhar, informar claramente. Não afirmar que passou sem executar.

## 11. Commits e escopo

Não fazer commit sem autorização.

Ao concluir uma tarefa, informar:

- arquivos criados;
- arquivos alterados;
- decisões técnicas;
- comandos executados;
- resultado dos testes;
- pendências;
- qualquer divergência documental encontrada.

## 12. Definition of Done

Uma tarefa só está concluída quando:

- segue estes documentos;
- possui validação;
- respeita autenticação e permissão;
- possui tratamento de erros;
- possui testes;
- não quebra testes existentes;
- lint passa;
- documentação foi atualizada, se o contrato mudou;
- não há segredo ou arquivo sensível versionado.
