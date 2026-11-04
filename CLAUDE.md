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
- Banco: Supabase (projeto `sayplpvhnoeytfnkbvpm`, São Paulo). Migrações em `supabase/migrations/`,
  aplicadas pelo GitHub Actions no merge (segredos SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD).

## Regras que não se quebram
- Nunca chave secreta (service_role / sb_secret) no repositório: o repositório é público.
- Nenhum dado pessoal ou real no repositório.
- Toda venda gera NFC-e no fechamento. Não existe fechamento sem nota.
- Toda tabela nova: RLS ligado e políticas na mesma migração.
- Nunca push direto na `main`: ramo próprio + pacote; o Alexandre faz o merge.

## Visual (padrão para toda tela)
Clean, bordas finas, pouco espaço vazio. Cabeçalho numa linha; indicadores em faixa fina (`.kpis`), não em
cartões altos; listas e tabelas aparecem sem rolar. Alertas importantes em popup. Funciona no celular
(menu vira gaveta, telas em uma coluna). Valores 1.234,56, datas dd/mm/aaaa.

## Verificação
`node --check` nos JS alterados; abrir com `python3 -m http.server` e conferir no navegador (desktop e 390px).
