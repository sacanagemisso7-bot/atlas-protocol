# Atlas Protocol — Regras de domínio

## 1. Escopo do domínio

O sistema permite:

- cadastro e autenticação de usuários;
- vínculo entre profissional e atleta;
- criação e acompanhamento de protocolos;
- versionamento de protocolos;
- registros de acompanhamento;
- check-ins periódicos;
- armazenamento de resultados de exames;
- registro de evolução física;
- controle administrativo de estoque;
- notificações internas;
- dashboard por perfil;
- auditoria de alterações relevantes.

O sistema não:

- prescreve;
- recomenda substâncias;
- calcula dose ideal;
- sugere correções;
- diagnostica;
- interpreta exames automaticamente;
- substitui acompanhamento profissional.

## 2. Perfis

- `admin`
- `professional`
- `athlete`

Um usuário possui exatamente um perfil no MVP.

## 3. Vínculo profissional-atleta

### DR-001 — Vínculo obrigatório

Um profissional só pode acessar dados de um atleta quando existir vínculo ativo entre ambos.

### DR-002 — Criação do vínculo

O vínculo pode ser criado:

- por administrador; ou
- por profissional, mediante aceite do atleta, se o fluxo de convite estiver implementado.

No MVP simplificado, o administrador pode criar e ativar o vínculo diretamente.

### DR-003 — Encerramento do vínculo

Encerrar o vínculo impede novos acessos e alterações do profissional, mas não apaga histórico.

### DR-004 — Histórico preservado

Protocolos, respostas, check-ins e demais registros criados durante o vínculo permanecem armazenados.

## 4. Protocolos

Estados:

- `draft`
- `active`
- `paused`
- `closed`
- `cancelled`

### DR-005 — Criação

Somente profissional vinculado ao atleta pode criar protocolo.

### DR-006 — Rascunho

Protocolo em `draft`:

- pode ser editado;
- pode ter itens adicionados ou removidos;
- pode ser excluído permanentemente se nunca foi ativado;
- não gera registros de acompanhamento.

### DR-007 — Ativação

Só pode ativar um protocolo que:

- esteja em `draft`;
- tenha atleta e profissional válidos;
- tenha pelo menos um item;
- tenha data inicial;
- não tenha data final anterior à inicial.

### DR-008 — Protocolo ativo

Protocolo em `active`:

- fica visível ao atleta;
- não pode ser editado diretamente;
- mudanças geram nova versão;
- pode ser pausado ou encerrado.

### DR-009 — Versionamento

Toda mudança material em protocolo ativo cria uma nova versão.

Mudanças materiais incluem:

- inclusão ou remoção de item;
- alteração de frequência;
- alteração de período;
- alteração de observações operacionais relevantes.

A versão anterior permanece imutável.

### DR-010 — Pausa

Protocolo `active` pode virar `paused`.

Durante a pausa:

- registros futuros ficam suspensos;
- histórico anterior permanece;
- o protocolo pode voltar para `active`;
- a retomada não apaga a pausa.

### DR-011 — Encerramento

Protocolo `active` ou `paused` pode virar `closed`.

Após encerrado:

- fica somente leitura;
- não pode ser reaberto no MVP;
- não aceita novos registros vinculados, exceto observação administrativa de encerramento;
- histórico permanece disponível.

### DR-012 — Cancelamento

Somente protocolo em `draft` pode virar `cancelled`.

Protocolos ativados não são cancelados; são encerrados.

### DR-013 — Datas

- datas são persistidas em UTC;
- `endDate` não pode ser anterior a `startDate`;
- protocolo sem `endDate` é permitido apenas quando explicitamente definido como contínuo;
- o MVP não calcula datas clínicas ou recomenda duração.

## 5. Itens de protocolo

### DR-014 — Biblioteca

Um item referencia uma entrada da biblioteca de substâncias/produtos.

Categorias permitidas:

- `hormone`
- `peptide`
- `supplement`
- `vitamin`
- `medication`
- `other`

### DR-015 — Informação operacional

O sistema pode armazenar informação inserida pelo profissional para acompanhamento, mas não gera recomendação automática.

### DR-016 — Imutabilidade histórica

Excluir ou desativar item da biblioteca não pode apagar seu nome e categoria das versões históricas. Cada versão deve manter snapshot mínimo.

## 6. Registros de acompanhamento

Estados:

- `scheduled`
- `completed`
- `missed`
- `cancelled`

### DR-017 — Origem

Um registro pode ser:

- gerado a partir de protocolo ativo;
- criado manualmente pelo profissional;
- criado pelo atleta quando permitido.

### DR-018 — Conclusão

Atleta pode marcar registro próprio como `completed`, informando data e observação opcional.

### DR-019 — Atraso

Um registro vencido não vira automaticamente `completed`.

Pode ser classificado como `missed` por regra agendada ou ação autorizada.

### DR-020 — Protocolo encerrado

Não permitir criar novo registro vinculado a protocolo `closed`.

### DR-021 — Histórico

Registro `completed` não deve ser excluído permanentemente. Correções devem gerar auditoria.

## 7. Check-ins

Estados:

- `pending`
- `submitted`
- `reviewed`

### DR-022 — Unicidade

Só pode existir um check-in do mesmo atleta para a mesma semana de referência.

A semana começa na segunda-feira no timezone `America/Sao_Paulo`.

### DR-023 — Envio

Atleta envia o check-in.

Após `submitted`:

- o atleta não edita o conteúdo no MVP;
- correção exige reabertura pelo profissional ou administrador;
- deve registrar `submittedAt`.

### DR-024 — Revisão

Somente profissional vinculado pode revisar.

A revisão registra:

- profissional;
- comentário;
- data;
- status `reviewed`.

### DR-025 — Conteúdo

O check-in pode registrar:

- peso;
- medidas;
- sono;
- energia;
- adesão;
- efeitos relatados;
- observações;
- fotos, se upload for implementado depois.

Nenhum campo gera diagnóstico automático.

## 8. Exames

### DR-026 — Propriedade

Exame pertence a um atleta.

### DR-027 — Cadastro

Atleta ou profissional vinculado pode cadastrar conforme permissões.

### DR-028 — Resultados

Resultados são dados informados. O sistema não classifica automaticamente como seguro, perigoso, normal ou anormal.

### DR-029 — Arquivo

Upload de arquivo é opcional e pode ficar fora do MVP.

### DR-030 — Exclusão

Exame pode ser arquivado, não apagado definitivamente, quando já foi usado em acompanhamento.

## 9. Evolução física

### DR-031 — Registro temporal

Cada evolução possui data de referência.

### DR-032 — Valores

Valores numéricos não podem ser negativos.

### DR-033 — Comparação

O sistema pode exibir diferença entre registros, sem atribuir causa ou recomendação.

### DR-034 — Propriedade

Atleta vê apenas sua evolução. Profissional vê apenas atletas vinculados.

## 10. Estoque

### DR-035 — Escopo administrativo

O estoque serve para organização de itens cadastrados pelo usuário.

### DR-036 — Quantidade

Quantidade não pode ser negativa.

### DR-037 — Unidade

Unidades permitidas no MVP:

- `unit`
- `ml`
- `mg`
- `g`
- `capsule`
- `tablet`
- `vial`
- `box`

### DR-038 — Validade

Item vencido recebe alerta e não pode ser marcado como utilizado em registro futuro.

### DR-039 — Baixa

A baixa automática só ocorre quando houver regra determinística definida no item. Caso contrário, a baixa é manual.

### DR-040 — Estoque insuficiente

O sistema pode alertar insuficiência estimada, mas não recomendar compra, dose ou substituição.

## 11. Notificações

### DR-041 — Tipos

- vínculo criado ou encerrado;
- protocolo ativado, pausado ou encerrado;
- check-in pendente;
- check-in revisado;
- registro agendado;
- estoque baixo;
- item vencido.

### DR-042 — Leitura

Usuário só marca suas próprias notificações como lidas.

### DR-043 — Falha de entrega

Notificação interna não pode bloquear operação principal.

## 12. Dashboard

### DR-044 — Dados por perfil

Dashboard deve respeitar ownership e permissões.

### DR-045 — Sem cálculo clínico

Cards e gráficos mostram contagens, adesão informada e evolução histórica. Não produzem avaliação médica.

## 13. Auditoria

### DR-046 — Eventos auditáveis

Registrar:

- login relevante e bloqueios;
- criação e alteração de vínculo;
- ativação, pausa, versionamento e encerramento de protocolo;
- alteração de registro concluído;
- envio e revisão de check-in;
- arquivamento de exame;
- mudanças administrativas em usuário.

### DR-047 — Imutabilidade

Auditoria não pode ser alterada por usuários comuns.

### DR-048 — Conteúdo seguro

Não gravar senha, token ou documento completo em auditoria.

## 14. Exclusão lógica

Preferir `archivedAt`, `deletedAt` ou `active: false` para:

- usuários;
- vínculos;
- substâncias;
- exames;
- registros históricos.

Exclusão física é permitida apenas para rascunhos sem dependências e dados de teste.
