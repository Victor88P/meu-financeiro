# Meu Financeiro

App pessoal de controle financeiro, feito em HTML, CSS e JavaScript puro, sem instalar nada.

## Como abrir

Acesse **https://victor88p.github.io/meu-financeiro/** e entre com o seu e-mail e senha.
Os dados ficam no Firebase (Firestore) e aparecem em todos os aparelhos. No celular,
use "Adicionar à tela inicial" para abrir como aplicativo.

Abrindo o `index.html` direto do computador, o app roda no **modo local** (sem login,
dados só naquele navegador). Use **Cadastros → Ajustes → Baixar backup** de vez em quando.

Atalho no computador: tecla **N** abre um novo lançamento.

## O que tem

- **Início**: saldo das contas, despesa futura do cartão, saldo livre, patrimônio,
  gastos × salário do mês, despesas por categoria e gráfico dos últimos 6 meses.
- **Extrato**: por conta ou de todas as contas, com saldo do dia, busca e lançamentos agendados.
- **Novo lançamento** (botão +): despesa, receita, compra no cartão (com parcelas) ou
  transferência. A categoria pode ser buscada pelo código (ex.: `206`) ou pelo nome (ex.: `merc`).
- **Cartões**: compras viram despesa futura e não mexem no saldo. O botão
  "Antecipar / pagar" tira o valor da conta e abate da fatura. Se você pagar a mais, a
  sobra vira crédito na próxima fatura.
- **Patrimônio**:
  - **Evolução** dos últimos 12 meses (total ou sem imobilizado), com a variação no mês.
  - **Metas** (ex.: reserva de emergência, viagem): o progresso vem das aplicações vinculadas
    ou de um valor manual; com prazo, mostra quanto guardar por mês.
  - **Aplicações**: aplicado + rendimento − descontos = líquido para saque hoje.
    **Aportar** tira da conta e soma no aplicado; **Resgatar** coloca o valor líquido na
    conta e reduz a aplicação proporcionalmente. Ambos aparecem no extrato.
  - **Imobilizado** (ex.: carro pelo valor FIPE), com histórico das atualizações.
- **Cadastros**: contas (com saldo inicial), categorias com código, cartões, tema e backup.

## Estrutura

```
index.html            página única
css/style.css         visual (celular primeiro, tema claro/escuro)
js/util.js            datas, dinheiro (centavos), texto
js/firebase-config.js configuração do projeto Firebase
js/store.js           onde os dados são salvos (navegador ou Firestore)
js/finance.js         regras: saldos, extrato, faturas, resumo do mês, patrimônio
js/ui.js              componentes (janelas, campo de valor, busca de categoria)
js/charts.js          gráficos em SVG
js/forms.js           formulários
js/views/*.js         telas
sw.js, manifest       instalação no celular (PWA) e uso offline
```

## Segurança

- Login por e-mail e senha (Firebase Authentication), só com o usuário do dono.
- Regras do Firestore em `firestore.rules`: só esse usuário lê e grava em `users/{uid}`.
- Arquivos de backup (`*backup*.json`) nunca devem ser enviados ao GitHub.
