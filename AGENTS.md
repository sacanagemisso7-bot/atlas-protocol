# Atlas Protocol — Instruções para agentes de código

## 1. Objetivo do projeto

O Atlas Protocol é uma plataforma web para acompanhamento entre atletas e profissionais, com foco em vínculos, protocolos versionados, registros de acompanhamento, check-ins, exames, evolução, estoque simples, notificações internas, dashboards e auditoria.

O sistema organiza informações e preserva contexto histórico. Ele não diagnostica, não prescreve, não recomenda substâncias, não sugere doses, não interpreta exames automaticamente e não substitui avaliação profissional.

## 2. Fontes de verdade

Antes de alterar qualquer funcionalidade, leia nesta ordem:

1. `docs/domain-rules.md`
2. `docs/permissions.md`
3. `docs/api-contracts.md`
4. `docs/database-models.md`
5. implementação existente

Em caso de conflito, prevalece a ordem acima.

Não altere regra, permissão, contrato ou modelo silenciosamente. Mudanças de contrato exigem atualização da documentação correspondente no mesmo trabalho.

## 3. Escopo congelado da V1

Incluído:

- autenticação JWT;
- perfis `admin`, `professional` e `athlete`;
- cadastro público de atleta;
- cadastro público de profissional com upload de PDF comprobatório;
- aprovação/rejeição de profissional pelo admin;
- vínculo profissional-atleta com solicitação e aceite do atleta;
- biblioteca de substâncias/itens;
- protocolos versionados;
- registros de acompanhamento (`tracking-records`);
- check-ins semanais;
- exames com suporte a PDF;
- evolução física e timeline histórica agregada;
- estoque simples com movimentações e alertas;
- notificações internas;
- dashboard por perfil em endpoint único;
- auditoria de ações relevantes;
- home pública, autenticação e área autenticada no frontend.

Fora da V1:

- pagamentos;
- CRM;
- chat em tempo real;
- notificações push reais;
- WhatsApp/SMS;
- integrações com laboratórios;
- IA para prescrição, recomendação ou interpretação clínica;
- multiempresa/multiclínica;
- inventário avançado com compras, fornecedores, custos ou múltiplos depósitos.

## 4. Stack obrigatória

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

- Angular standalone
- TypeScript
- Angular Router
- Reactive Forms
- HttpClient
- Guards funcionais
- Interceptors funcionais

## 5. Arquitetura obrigatória do backend

Fluxo padrão:

```text
route
  -> authMiddleware
  -> roleMiddleware
  -> professionalApprovalMiddleware (quando aplicável)
  -> validationMiddleware
  -> controller
  -> service
  -> model
  -> response
```

Quando aplicável, ownership/vínculo/estado devem ser verificados no middleware ou service antes da mutação.

Responsabilidades:

- `routes`: endpoints e middlewares;
- `middlewares`: autenticação, autorização, validação e erros;
- `controllers`: camada HTTP fina;
- `services`: regras de negócio, ownership e transições;
- `models`: schemas, índices e métodos de documento;
- `validators`: validação de body, params, query e arquivos;
- `utils`: funções puras e reutilizáveis;
- `storage`: abstração para upload/remoção lógica de arquivos quando necessário.

Controllers não devem conter regra de negócio relevante.

Services não devem acessar diretamente `req` ou `res`.

Models não devem depender de controllers ou rotas.

## 6. Estrutura recomendada

```text
src/
  app.js
  server.js
  config/
  constants/
  controllers/
  middlewares/
  models/
  routes/
  services/
  storage/
  validators/
  utils/
tests/
  integration/
  unit/
scripts/
  seed.js
docs/
```

## 7. Convenções

- Arquivos e diretórios: `kebab-case`.
- Variáveis e funções: `camelCase`.
- Classes e models: `PascalCase`.
- Constantes: `UPPER_SNAKE_CASE`.
- Endpoints: substantivos no plural.
- IDs MongoDB sempre validados antes de consultar.
- Datas persistidas em UTC.
- Frontend exibe horários em `America/Sao_Paulo`.
- Textos de interface em português.
- Códigos internos de erro em inglês e `UPPER_SNAKE_CASE`.
- Paginação: `page` inicia em 1, `limit` padrão 20, máximo 100.
- Ordenação: `sortBy` e `sortOrder=asc|desc`.
- Filtros de intervalo temporal: `dateFrom` e `dateTo`.

## 8. Respostas da API

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

## 9. Segurança e arquivos

- Nunca armazenar senha em texto puro.
- Nunca retornar `passwordHash`.
- bcrypt com fator configurável por ambiente.
- JWT contém apenas identificadores e perfil necessários.
- Todas as rotas privadas usam autenticação.
- Autorização real sempre no backend.
- Nunca confiar em `athleteId`, `professionalId` ou `role` enviados pelo cliente sem validar contra o usuário autenticado.
- Profissional só acessa atleta com vínculo `active` e, para exercer permissões profissionais, deve estar `approved`.
- Não registrar tokens, senhas, PDFs, exames completos ou documentos profissionais em logs/auditoria.
- `.env` e credenciais nunca entram no Git.
- Toda entrada externa deve ser validada.
- Upload profissional: PDF obrigatório, tipo e tamanho validados. A aprovação é uma simulação acadêmica do TCC e não certifica credencial médica ou profissional real.
- Upload de exame: PDF suportado, sujeito às mesmas validações.
- Arquivos devem ser tratados por serviço de storage; não acoplar regra de domínio a um provedor específico.

## 10. Regras obrigatórias da V1

- Cadastro público de atleta cria `role=athlete` ativo.
- Cadastro público de profissional cria `role=professional` com `verificationStatus=pending`.
- Profissional `pending` ou `rejected` não exerce permissões profissionais.
- Admin aprova ou rejeita profissionais.
- Vínculo é solicitado pelo profissional e aceito/rejeitado pelo atleta.
- Estados do vínculo: `pending`, `active`, `rejected`, `ended`.
- Protocolos: `draft`, `active`, `paused`, `closed`, `cancelled`.
- Mudança material em protocolo ativo/pausado cria versão imutável.
- Tracking usa `scheduledFor` e status `scheduled|completed|missed|cancelled`.
- Check-in: `pending -> submitted -> reviewed`; sem reabertura na V1.
- Respostas de check-in ficam imutáveis após envio.
- Exames podem ter PDF e dados estruturados; sem interpretação automática.
- Evolução inclui registros temporais e timeline agregada.
- Estoque é simples e individual do atleta; profissional vinculado tem leitura.
- Movimentação de estoque é imutável e não pode gerar quantidade negativa.
- Item vencido gera bloqueio/alerta conforme regra documentada.
- Notificações são internas e nunca bloqueiam a operação principal.
- Dashboard usa endpoint único `GET /dashboard` e responde conforme role.
- Ações relevantes geram auditoria.
- Não usar exclusão física em dados de negócio da V1; preferir status, `active=false` ou `archivedAt`.

## 11. Frontend e rotas

Rotas públicas:

```text
/
/login
/register
/register/professional
```

Área autenticada:

```text
/app
/app/dashboard
/app/profile
/app/protocols
/app/protocols/:id
/app/tracking
/app/check-ins
/app/check-ins/:id
/app/history
/app/exams
/app/inventory
/app/notifications
```

Profissional:

```text
/app/athletes
/app/athletes/:id
/app/links
/app/protocols/new
/app/protocols/:id/edit
/app/tracking/new
```

Admin:

```text
/app/admin/users
/app/admin/professionals
/app/admin/substances
/app/admin/audit
```

Dashboard usa rota única `/app/dashboard`, com componentes internos por perfil.

Toda tela dependente de API deve implementar:

- loading;
- success;
- empty;
- error;
- unauthorized;
- feedback de sucesso/erro em ações.

## 12. Regras de implementação

- Implementar uma tarefa por vez.
- Não ampliar escopo sem solicitação explícita.
- Não gerar recomendações automáticas de uso.
- Não inserir dados clínicos fictícios como verdade.
- Não remover histórico necessário para auditoria.
- Não criar `DELETE` físico para dados de negócio.
- Alterações em protocolo ativo devem respeitar versionamento.
- Operações sensíveis geram auditoria quando previstas.
- Listagens suportam paginação.
- Consultas evitam campos desnecessários.
- API e documentação devem permanecer sincronizadas.

## 13. Testes

Cada regra de negócio precisa de teste.

Mínimo por endpoint relevante:

- caso de sucesso;
- autenticação ausente;
- perfil sem permissão;
- payload inválido;
- recurso inexistente;
- regra de negócio violada;
- ownership/vínculo inválido;
- estado inválido, quando aplicável.

Cobrir explicitamente:

- profissional pendente não exerce permissões;
- aprovação/rejeição profissional;
- vínculo solicitado/aceito/rejeitado/encerrado;
- profissional não vinculado não acessa atleta;
- protocolo ativo cria nova versão ao ser alterado;
- versão anterior permanece imutável;
- segundo check-in na mesma semana é bloqueado;
- check-in enviado não é editável pelo atleta;
- tracking respeita transições;
- estoque insuficiente é bloqueado;
- item vencido é tratado conforme regra;
- dashboard não vaza dados de outros usuários;
- auditoria não contém conteúdo sensível.

Antes de concluir tarefa backend:

```bash
npm test
npm run lint
```

Frontend:

```bash
npm run build
```

Não afirmar que passou sem executar.

## 14. Seed mínimo

O seed de demonstração deve ser pequeno e seguro:

- 1 admin;
- 1 profissional aprovado;
- 1 atleta;
- 1 usuário adicional para cenários de acesso negado, quando necessário;
- poucas substâncias fictícias;
- 1 vínculo ativo;
- dados mínimos de backup para protocolo versionado, check-in, tracking, exame, evolução e estoque.

A apresentação deve priorizar o fluxo criado ao vivo. Seed é contingência, não substituto da demonstração.

## 15. Ordem oficial de desenvolvimento

1. Consolidar `develop`, tracking e check-ins.
2. Atualizar contratos/documentação.
3. Cadastro profissional + upload + aprovação admin.
4. Vínculos com solicitação/aceite/rejeição/encerramento.
5. Padronizar tracking e check-ins.
6. Dashboard API.
7. Frontend do atleta.
8. Frontend do profissional.
9. Exames + PDF.
10. Evolução + timeline.
11. Estoque simples + alertas.
12. Notificações internas.
13. Auditoria.
14. Admin completo.
15. Seed mínimo.
16. Deploy frontend.
17. Testes E2E, segurança e QA.
18. Documentação final, TCC e ensaio.

## 16. Commits e escopo

Não fazer commit sem autorização.

Padrão de commits:

```text
<type>(<scope>): descrição em português
```

Exemplos:

```text
feat(auth): adicionando cadastro e verificacao de profissionais
fix(tracking): padronizando filtros de intervalo de datas
test(links): adicionando testes do fluxo de aceite de vinculo
```

Ao concluir uma tarefa, informar:

- arquivos criados;
- arquivos alterados;
- decisões técnicas;
- comandos executados;
- resultado dos testes/build;
- pendências;
- divergências documentais encontradas.

## 17. Definition of Done

Uma tarefa só está concluída quando:

- segue estes documentos;
- possui validação;
- respeita autenticação, role, ownership e vínculo;
- possui tratamento de erros;
- possui testes adequados;
- não quebra testes existentes;
- lint/build passa;
- documentação foi atualizada se o contrato mudou;
- não há segredo ou arquivo sensível versionado;
- não introduz exclusão física indevida;
- recurso funciona no fluxo real e, quando aplicável, no deploy.
