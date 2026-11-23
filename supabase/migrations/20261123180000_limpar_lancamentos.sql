/* =====================================================================
   Limpeza dos LANÇAMENTOS de teste (pedido do Alexandre, 23/11/2026):
   a Gran Sabor começa do zero e o sistema deve mostrar só o que for
   lançado de verdade daqui em diante. Roda UMA vez, ao juntar o pacote.

   APAGA (lançamentos): contas a pagar e a receber, extrato bancário,
   caixas e vendas do PDV, exceções da escala (troca, folga, falta,
   atestado), diárias de freelancer, férias e rescisões registradas.
   Categorias criadas pela importação do fluxo de caixa (origem 'fluxo').

   FICA (cadastros): usuários, unidades, produtos e preços, colaboradores,
   turnos, horário de funcionamento, folgas fixas, feriados, freelancers,
   contratos de experiência, contas bancárias e as demais categorias.

   Não há volta: o plano grátis do Supabase não guarda cópia.
   Os gatilhos de versão disparam em cada tabela: as telas abertas se
   atualizam sozinhas (Realtime).
   ===================================================================== */

-- Rescisão registrada marcou o colaborador como desligado: volta para ativo (o mesmo que "desfazer rescisão")
update public.colaboradores c
   set situacao = 'ativo', demissao = null
 where exists (select 1 from public.rescisoes r where r.colaborador_id = c.id);

delete from public.extrato_lancamentos;
delete from public.rescisoes;
delete from public.ferias;
delete from public.freela_diarias;
delete from public.escala_dias;
delete from public.vendas;
delete from public.caixas;
delete from public.contas_pagar;
delete from public.contas_receber;

delete from public.categorias_financeiras c
 where c.origem = 'fluxo'
   and not exists (select 1 from public.produtos p where p.categoria_financeira_id = c.id);
