# Gran Sabor — guia para o Claude

Sistema de gestão da Gran Sabor (LHMS · 3 lojas self-service por kg, central de carnes e escritório).
Tudo em português do Brasil: telas, mensagens, comentários, tabelas e commits. O Alexandre não é técnico:
explique em passos simples, clique a clique, e chame Pull Request de "pacote".

## Arquitetura (padrão Business: NOX + Venner + Drogarema)
- Telas em HTML + JS puro, sem build, publicadas no GitHub Pages. Instalável como aplicativo (PWA).
- `index.html` (login) e `sistema.html` (casca: topo, menu lateral, abas). Cada tela abre numa aba (iframe)
  e não recarrega ao trocar de aba.
- `pages/<tela>.html`: telas. `pages/em-construcao.html` cobre as que ainda não existem.
- `assets/js/menu.js`: mapa do menu (`MENU`) e das unidades (`UNIDADES`). Tela nova = preencher `arquivo`.
- `assets/js/config.js`: endereço e chave publishable do Supabase. Sem chave → modo demonstração.
- `assets/js/tela.js`: ajudas das telas (formatos BR, unidade escolhida, abrir outra tela).
- `assets/js/folha.js` (conta da folha) e `assets/js/vendas.js` (conta das vendas: total, NFC-e, caixa, indicadores): cada conta num lugar só.
- Cardápio real: tabelas `produtos` + `produto_precos` (preço por loja). A casca lê uma vez (`carregarProdutos` em sistema.js)
  e `exemplo.js` monta `PRODUTOS_VENDA` com elas; sem a tabela, ficam os produtos de exemplo. Dado real entra pela tela
  (botão "Importar planilha" da Saipos), nunca por migração.
- Banco: Supabase (projeto `sayplpvhnoeytfnkbvpm`, São Paulo). Migrações em `supabase/migrations/`,
  aplicadas pelo GitHub Actions no merge (segredos SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD).

## Regras que não se quebram
- Nunca chave secreta (service_role / sb_secret) no repositório: o repositório é público.
- Nenhum dado pessoal ou real no repositório.
- Toda venda ao consumidor gera NFC-e no fechamento, pelo botão "Emitir NFC-e" do operador. Não existe venda ao consumidor sem nota.
  Não são venda ao consumidor (sem NFC-e, com documento próprio): convênio PJ (NF-e + boleto no fechamento do período),
  consumo de funcionário (desconto na folha, evento 110) e cortesia/degustação (alerta para a Fernanda no fechamento do caixa).
- Toda tabela nova: RLS ligado e políticas na mesma migração.
- Nunca push direto na `main`: ramo próprio + pacote; o Alexandre faz o merge.

## Dados sempre atualizados em toda a cadeia (lição da Drogarema, 08/11/2026)
Na Drogarema uma tela aberta mostrava valor antigo e um pagamento saiu errado. Aqui, sempre:
- Cada dado mora num lugar só e cada conta é feita numa função só (hoje `exemplo.js`/`dadoComum`, depois o banco).
  Tela nenhuma guarda cópia própria nem número calculado congelado; derivado (custo, margem, saldo, líquido) é recalculado da origem.
- Quem grava avisa (`avisarMudanca('tabela')`) e toda tela que usa o dado se redesenha sozinha (`vigiarDados`),
  esperando a pessoa terminar de digitar. Com o banco: Supabase Realtime nas mesmas tabelas.
- Ação que gera efeito (pagar, receber, fechar período, emitir, gerar boleto/acerto, receber transferência) relê o dado
  na hora de confirmar (`mudouDesde`); se mudou desde que a janela abriu, não faz nada e mostra o valor novo.
- Uma ação alimenta a cadeia inteira de uma vez (ex.: XML → contas a pagar + estoque + custo médio → ficha → margem).
  Nada de "lançar depois em outra tela". Depois de pago, diferença vira acerto visível, nunca ajuste silencioso.
- Teste de toda entrega: alterar numa aba e conferir as outras abas abertas, e tentar confirmar com dado mudado.

## Visual (padrão para toda tela)
Clean, bordas finas, pouco espaço vazio. Cabeçalho numa linha; indicadores em faixa fina (`.kpis`), não em
cartões altos; listas e tabelas aparecem sem rolar. Alertas importantes em popup. Funciona no celular
(menu vira gaveta, telas em uma coluna). Valores 1.234,56, datas dd/mm/aaaa.

## Verificação
`node --check` nos JS alterados; abrir com `python3 -m http.server` e conferir no navegador (desktop e 390px).
