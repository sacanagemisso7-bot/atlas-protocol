# Atlas Protocol Backend

Fundação técnica da API do Atlas Protocol, construída com Node.js, Express e MongoDB.

## Requisitos

- Node.js 20 ou superior
- npm
- MongoDB disponível localmente ou por uma URI acessível

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env` e ajuste os valores:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/atlas_protocol
```

## Execução

Desenvolvimento, com reinício automático:

```bash
npm run dev
```

Produção:

```bash
npm start
```

Após iniciar a aplicação, o health check público estará disponível em:

```text
GET http://localhost:3000/api/v1/health
```

## Qualidade

```bash
npm test
npm run lint
```

O comando de testes usa Jest e Supertest. A aplicação usada pelos testes não abre uma porta nem exige uma conexão ativa com o MongoDB.
