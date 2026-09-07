# Verificação do NET

Regras e integração da persistência (Node.js, sem dependências):

```sh
node --test tests/finance-rules.test.cjs tests/cloud-finance.test.cjs
```

Integração do formulário e do Financeiro em Chrome headless, usando Playwright:

```sh
node tests/reservation-browser.cjs
```

O Chrome deve estar instalado. Se Playwright estiver fora do node_modules do projeto,
defina JERI_PLAYWRIGHT com o caminho do pacote. JERI_SCREENSHOT é um caminho opcional
para salvar uma captura do resumo. Não é necessário iniciar um servidor.

O navegador carrega os arquivos reais do app, incluindo seus carregadores de módulos,
mas intercepta todas as requisições. Catálogo, autenticação e dados são simulados;
nenhuma reserva real ou banco remoto é alterado. Os testes de persistência executam
os módulos reais cloud-data-sync.js e cloud-write-sync.js contra um cliente simulado.

## Mapa auditado antes da implementação

| Local | Responsabilidade / problema encontrado |
| --- | --- |
| reservation-service-catalog.js | Aplicava pricing_basis, recalculava durante decoração e reaplicava dados operacionais ao mudar passageiros; tinha gravação financeira paralela atrasada. |
| finance-basic.js | NET com fallback por quantidade, mapa separado por índice, hidratação e gravação atrasadas; Financeiro considerava apenas NET ainda não pago. |
| finance-binary-cover.js | Sobrescrevia Financeiro com regra binária de saldo zerado. |
| reservation-flow.js | Somava rascunhos separados dos campos NET; filtrava serviços iguais e persistia por referência global à reserva editada. |
| reservation-net-total-live.js | Observava e reescrevia o total, contando somente inputs visíveis. |
| reservation-draft-preserver.js | Restaurava snapshots por posição várias vezes; excluir/duplicar podia restaurar o serviço errado. |
| reservation-company-cover.js / reservation-summary-order.js | Carregavam a regra binária e reordenavam o resumo continuamente. |
| reservation-enhancements.js | Outro cálculo de NET com ida/volta e pricing_basis; recalculava passageiros na abertura. |
| manager-finance-enhancements.js / reservation-roundtrip.js | Cálculos legados de NET independentes; passaram a chamar a regra central. |
| app.js / reservation-list-actions.js | Cálculos de saldo; passaram a chamar a regra central. Prestação de contas entre parceiros não determina cobertura de NET. |
| manager-services-section.js / service-net-catalog.js | Persistência da base de preço do catálogo; agora derivada da modalidade. |
| cloud-data-sync.js | Sobrescrevia venda com soma de sale_total dos serviços e limitava recebido; removia serviços de conteúdo igual. |
| cloud-write-sync.js | Também recalculava venda/recebido e descartava serviços de conteúdo igual. |
| reservation-service-dedupe.js | Removia serviços pela semelhança dos campos; agora considera identidade. |
| dashboard-calendar.js | Deduplicação visual e indicadores de completude; não calcula NET nem altera os valores persistidos. |

## Regra após a alteração

finance-rules.js concentra cálculo por modalidade, leitura de NET salvo, soma em
centavos, saldo e cobertura. Compartilhado multiplica o unitário por passageiros;
demais modalidades usam o total cadastrado. pricing_basis e receipt_rule não decidem
a cobertura financeira. NET zero explícito é preservado.

reservation-flow.js possui o estado dos serviços e o único escritor do card NET
TOTAL. O resumo soma diretamente os inputs Valor NET, inclusive quando o modal está
fechado. O catálogo altera NET somente após seleção explícita ou mudança de pessoas.
Os módulos de correção por observadores/snapshots foram aposentados.

O Financeiro usa NET integral, sem excluir serviços já pagos. O saldo de cada reserva
é consumido uma única vez na ordem das datas dos serviços, preservando a distribuição
mensal existente. A soma da cobertura de seus serviços é exatamente
max(0, net_total - max(0, venda - recebido)); saldos não são compartilhados entre reservas.

O resumo da reserva contém NET TOTAL, VALOR RECEBIDO e SALDO A RECEBER. O campo de
edição da venda permanece separado, para permitir informar a venda usada no saldo.
Não há card de cobertura da empresa na reserva nem novos textos explicativos.

## Resultados esperados

| Caso | Venda | NET | Recebido | Saldo | Empresa cobre |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 400 | 400 | 100 | 300 | 100 |
| 2 | 400 | 400 | 400 | 0 | 400 |
| 3 | 1000 | 400 | 100 | 900 | 0 |
| 4 | 1000 | 400 | 800 | 200 | 200 |
| 5 | 1000 | 400 | 1000 | 0 | 400 |

Também são verificados NET 160 + 200 + 400 = 760, preços incompatíveis no catálogo
(para provar que a modalidade prevalece), inclusão/exclusão/duplicação, NET manual,
NET zero, passageiros, persistência, reabertura, edição sem alterações, preservação
operacional e isolamento de outra reserva.
