# Voucher Clean | Jeri Rota Manager

Implementação proposta para revisão, sem alterar reservas nem banco de dados.

## Objetivo
- Layout limpo e operacional, com prioridade para dados verificáveis e QR Code original.
- Idiomas de emissão: Português (pt), English (en), Français (fr), Español (es).
- Novo padrão de emissão **minimalista**, sem fotografias.
- Layout **clássico** preservado para vouchers antigos e como opção em português.
- **Valores ocultos por padrão** ao emitir vouchers novos. É possível optar por incluí-los.
- Sem preços NET ou comissões de fornecedores no documento.
- As preferências são armazenadas em \`vouchers.snapshot_data.language\`, \`snapshot_data.template\` e \`snapshot_data.services[].title_i18n\`.
- Sem migração SQL: campos extras entram no JSON de snapshot já existente.

## Como usar
1. Acessar Reservas e selecionar Voucher.
2. Escolher *Voucher completo* ou o voucher de um único serviço.
3. Selecionar **Minimalista — sem imagens**.
4. Escolher idioma: português, inglês, francês ou espanhol.
5. Opcionalmente, em "Personalizar o nome dos serviços por idioma", preencher os títulos que devem aparecer traduzidos. Conteúdos de cadastro, descrições livres, horários e endereços não são automaticamente traduzidos.
6. Deixar "Exibir valores no voucher" desmarcado para documento operacional sem valores.
7. Conferir pré-visualização e emitir. O QR Code é construído do mesmo token de validação, sem mudança do endpoint.
8. A página pública de validação passa a respeitar o idioma gravado no snapshot.

## Compatibilidade
- Vouchers emitidos anteriormente **sem** \`snapshot_data.template\` seguem com o layout clássico.
- Novas emissões usam o layout minimalista por padrão.
- O mesmo mecanismo de exportação PDF (html2canvas + jsPDF) e upload para Supabase Storage é reaproveitado.
- A aparência de serviços deve ser conferida ao editar uma reserva antiga antes de reemitir.

## Testes antes de publicar em produção
- Criar reserva de teste em 4 idiomas e gerar PDFs; conferir acentos e fontes.
- Confirmar o QR Code com smartphone e status na rota \`/v/{token}\`.
- Abrir voucher antigo já emitido: deve conservar o visual clássico.
- Reemitir um voucher alterando idioma; confirmar incremento da versão e token correto.
- Emitir com e sem valores. Confirmar que sem valores não há totais financeiros.
- Testar 1, 10 e 20+ serviços; PDFs extensos podem exigir refinamento de quebra de página.
- Conferir nomes de serviços e observações em cada idioma, pois são textos livres.
- Confirmar que a reserva e permissões de usuário se comportam normalmente.

## Arquivos
- \`voucher-clean-template.js\`: traduções e HTML minimalista.
- \`voucher-clean.css\`: impressão e pré-visualização em A4.
- \`voucher-premium-template.js\`: escolha do renderizador, mantendo legado.
- \`voucher-module-premium.js\`: seletores, snapshot e títulos localizados.
- \`voucher-public.js\`: página de validação traduzida.
- \`index.html\` e \`v/index.html\`: carregamento dos assets.

## Atualização de paginação e condições (27/10/2026)
- Modelo operacional sem imagens, inspirado em documentos de confirmação: cabeçalho institucional, campos essenciais, tabela de serviços e QR funcional.
- O PDF é capturado página por página; falhas de altura são sinalizadas, não geram página órfã cortada.
- Uma página de condições gerais é gerada a partir de um **resumo** dos Termos da Jeri Rota (versão publicada 2026-09-11), com link ao texto integral: https://www.jerirota.com.br/termos-e-condicoes/
- O contrato assinado, sua versão de termos aceita e regras específicas têm prioridade; não copiar percentuais da Rota Combo.
- Campo **CPF do titular**, opcional e validado, na reserva. `public.reservations.holder_cpf` foi criado; PDF exibe somente o CPF mascarado. A rota pública de QR nunca deve expor o CPF completo.
- Testar 9, 12, 13 e 25 serviços. Mais de 12 serviços são distribuídos em páginas equilibradas, seguidas de uma página dedicada às condições.
- Ao reemitir voucher anterior, uma nova versão substitui a anterior conforme regra de versionamento já existente.
- Campos livres de serviços/observações podem exigir tradução humana para francês, inglês ou espanhol.
