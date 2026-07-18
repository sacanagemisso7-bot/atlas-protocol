# Atlas Protocol — Matriz de permissões

## 1. Legenda

- **T**: todos os registros permitidos.
- **V**: apenas atletas vinculados.
- **P**: apenas registros próprios.
- **N**: não permitido.
- **C**: permitido com condição adicional.

A autorização deve ser aplicada no backend.

## 2. Usuários

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar usuários | T | N | N |
| Ver usuário por ID | T | P | P |
| Atualizar próprio perfil | P | P | P |
| Atualizar perfil de outro usuário | T | N | N |
| Bloquear/desbloquear usuário | T | N | N |
| Alterar perfil | T | N | N |
| Excluir fisicamente | N | N | N |

## 3. Vínculos profissional-atleta

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Criar vínculo | T | C | N |
| Listar vínculos | T | P | P |
| Ver vínculo | T | P | P |
| Aceitar convite | N | N | P |
| Encerrar vínculo | T | P | P |
| Reativar vínculo encerrado | T | N | N |

Condição para profissional criar vínculo: fluxo de convite habilitado. No MVP simplificado, use apenas criação por administrador.

## 4. Biblioteca de substâncias

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar itens ativos | T | T | T |
| Ver item | T | T | T |
| Criar item | T | T | N |
| Atualizar item próprio | T | P | N |
| Desativar item | T | P | N |
| Excluir fisicamente | N | N | N |

Itens globais criados pelo admin não podem ser alterados por profissional.

## 5. Protocolos

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar | T | V | P |
| Ver detalhes | T | V | P |
| Criar | N | V | N |
| Editar rascunho | N | V | N |
| Excluir rascunho | N | V | N |
| Ativar | N | V | N |
| Criar nova versão | N | V | N |
| Pausar | N | V | N |
| Retomar | N | V | N |
| Encerrar | N | V | N |
| Cancelar rascunho | N | V | N |
| Alterar protocolo encerrado | N | N | N |

Admin pode consultar para suporte e auditoria, mas não cria nem altera protocolo no MVP.

## 6. Registros de acompanhamento

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar | T | V | P |
| Ver | T | V | P |
| Criar manualmente | N | V | C |
| Marcar como concluído | N | V | P |
| Marcar como perdido | N | V | P |
| Cancelar agendado | N | V | P |
| Editar concluído | C | C | N |
| Excluir fisicamente | N | N | N |

Atleta só cria manualmente quando o tipo permitir. Correção de concluído exige auditoria.

## 7. Check-ins

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar | T | V | P |
| Ver | T | V | P |
| Criar rascunho | N | N | P |
| Enviar | N | N | P |
| Revisar | N | V | N |
| Reabrir | T | V | N |
| Excluir fisicamente | N | N | N |

## 8. Exames

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar | T | V | P |
| Ver | T | V | P |
| Cadastrar | N | V | P |
| Atualizar metadados | N | V | P |
| Arquivar | T | V | P |
| Excluir definitivamente | N | N | N |

## 9. Evolução física

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar | T | V | P |
| Ver | T | V | P |
| Criar | N | V | P |
| Atualizar | N | V | P |
| Arquivar | T | V | P |

## 10. Estoque

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar estoque próprio | P | P | P |
| Ver item próprio | P | P | P |
| Criar item próprio | P | P | P |
| Atualizar item próprio | P | P | P |
| Registrar movimentação | P | P | P |
| Ver estoque de outro usuário | N | N | N |

No MVP, estoque é individual. Estoque compartilhado de clínica fica fora do escopo.

## 11. Notificações

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Listar próprias | P | P | P |
| Marcar própria como lida | P | P | P |
| Excluir própria | P | P | P |
| Criar manualmente | N | N | N |

Notificações são geradas pelo sistema.

## 12. Dashboard

| Dashboard | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Administrativo | T | N | N |
| Profissional | N | P | N |
| Atleta | N | N | P |

## 13. Auditoria

| Ação | Admin | Profissional | Atleta |
|---|---:|---:|---:|
| Consultar logs gerais | T | N | N |
| Consultar evento relacionado ao próprio vínculo | T | C | C |
| Criar/alterar/excluir log | N | N | N |

## 14. Regras de implementação

Toda rota privada deve combinar:

1. autenticação;
2. perfil;
3. ownership ou vínculo;
4. estado do recurso;
5. validação da operação.

Exemplo:

```text
PATCH /protocols/:id/activate
  -> auth
  -> role professional
  -> validate ObjectId
  -> load protocol
  -> verify professional ownership
  -> verify active link
  -> verify status draft
  -> verify protocol completeness
  -> activate
```

Não confiar em `professionalId` ou `athleteId` enviados pelo cliente sem comparar com o usuário autenticado.
