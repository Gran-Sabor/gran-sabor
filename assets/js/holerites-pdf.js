/* =====================================================================
   Gran Sabor · holerites-pdf.js — lê a "Folha de Pagamento Analítica"
   do contador (PDF) e devolve os holerites prontos para gravar.
   O PDF é lido no próprio navegador (pdf.js): nada sai do computador
   antes de a pessoa conferir e confirmar.
   Cada texto do PDF vem de um bloco com posição (x, y); o x diz a coluna:
   proventos (esquerda), descontos (meio) e informativos (direita: bases,
   FGTS, líquido). Os totais impressos conferem a leitura de cada holerite.
   ===================================================================== */
const HPDF = (() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const COL_DESCONTO = 222, COL_INFO = 420;   // x (em pontos) onde começam as colunas de descontos e de informativos
  const sem = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const NUM = /^-?[\d.]+,\d{2}$/;
  const iso = br => { const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(br || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const r2 = v => Math.round(v * 100) / 100;

  // Tipo do documento pelo título ("Fechamento Mensal", "Adiantamento de Salario"...)
  function tipoDoc(t) {
    const s = sem(t);
    return /adiant/.test(s) ? 'adiantamento' : /13|decimo/.test(s) ? 'decimo' : /ferias/.test(s) ? 'ferias' : /rescis/.test(s) ? 'rescisao' : /mensal|fechamento/.test(s) ? 'mensal' : 'outro';
  }

  async function carregarPdfjs() {
    if (typeof pdfjsLib !== 'undefined') return pdfjsLib;
    await new Promise((ok, falha) => { const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js'; s.onload = ok; s.onerror = () => falha(new Error('sem internet para abrir o PDF')); document.head.appendChild(s); });
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    return pdfjsLib;
  }

  // Blocos de texto de cada página: { x, y, s }. Lê os comandos de texto do PDF (e não o texto "arrumado"
  // do pdf.js, que separa as letras deste PDF com espaços falsos: "A DE V A N IA").
  async function blocos(dados, lib) {
    lib = lib || await carregarPdfjs();
    const O = lib.OPS, doc = await lib.getDocument({ data: dados }).promise, paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const ol = await (await doc.getPage(n)).getOperatorList(), bs = [];
      let x = 0, y = 0, lx = 0, ly = 0;
      for (let i = 0; i < ol.fnArray.length; i++) {
        const f = ol.fnArray[i], a = ol.argsArray[i];
        if (f === O.beginText) { x = y = lx = ly = 0; }
        else if (f === O.setTextMatrix) { x = lx = a[4]; y = ly = a[5]; }
        else if (f === O.moveText || f === O.setLeadingMoveText) { lx += a[0]; ly += a[1]; x = lx; y = ly; }
        else if (f === O.showText || f === O.showSpacedText) {
          const s = (a[0] || []).map(g => typeof g === 'number' ? '' : (g && g.unicode) || '').join('');
          if (s.trim()) bs.push({ x, y, s: s.replace(/\s+/g, ' ').trim() });
        }
      }
      paginas.push(bs);
    }
    return paginas;
  }

  // Linhas da página (mesmo y), de cima para baixo; cada palavra guarda o x do bloco de onde veio
  function linhas(bs) {
    const porY = new Map();
    bs.forEach(b => { const k = Math.round(b.y); (porY.get(k) || porY.set(k, []).get(k)).push(b); });
    return [...porY.keys()].sort((a, b) => b - a).map(k => {
      const L = porY.get(k).sort((a, b) => a.x - b.x);
      return { txt: L.map(b => b.s).join(' '), palavras: L.flatMap(b => b.s.split(' ').map(p => ({ x: b.x, t: p }))) };
    });
  }

  // Lê o PDF inteiro. Devolve { tipo, tipoTexto, comp, cnpj, empregador, holerites: [...] }
  async function ler(dados, lib) {
    const doc = { tipo: null, tipoTexto: '', comp: null, cnpj: null, empregador: '', holerites: [] };
    let h = null;
    for (const pg of await blocos(dados, lib)) {
      for (const { txt, palavras } of linhas(pg)) {
        if (/^Folha de Pagamento/i.test(txt)) continue;
        let m = /^(.*?)\s*([A-Za-zÀ-ú]+)\/(\d{4})$/.exec(txt);
        if (m && !doc.comp && MESES.includes(sem(m[2]))) { if (m[1].trim()) doc.tipoTexto = m[1].trim(); doc.comp = `${m[3]}-${String(MESES.indexOf(sem(m[2])) + 1).padStart(2, '0')}`; continue; }
        // Título do documento (linha só de letras antes do 1º holerite): "Fechamento Mensal", "Adiantamento de Salario"...
        if (!doc.holerites.length && !doc.tipoTexto && /^[A-Za-zÀ-ú0-9º°ª .-]+$/.test(txt) && !/\d{4}/.test(txt)) { doc.tipoTexto = txt.trim(); continue; }
        m = /^(.*?)\s*CNPJ\s*:\s*([\d./-]+)/.exec(txt);
        if (m) { doc.cnpj = m[2].replace(/\D/g, ''); doc.empregador ||= m[1].replace(/^\d+\s+/, '').trim(); continue; }
        m = /^(\d{6}) - (.+?) H\/M: ([\d.,]+) CARGO: (.+?) ADMISS[AÃ]O: (\d\d\/\d\d\/\d{4})/.exec(txt);
        if (m) {
          h = { matricula: m[1], nome: m[2].trim(), horasMes: num(m[3]), cargo: m[4].trim(), admissao: iso(m[5]), salario: 0, pagamento: null, itens: [], obs: [] };
          doc.holerites.push(h); continue;
        }
        if (!h) continue;
        m = /^SAL[AÁ]RIO: ([\d.,]+)/.exec(txt);
        if (m) { h.salario = num(m[1]); const p = /PAGAMENTO: (\d\d\/\d\d\/\d{4})/.exec(txt); h.pagamento = p ? iso(p[1]) : null; continue; }
        m = /^TOTAIS >>> VENCIMENTOS: ([\d.,]+) DESCONTOS: ([\d.,]+) L[IÍ]QUIDO: ([\d.,]+)/.exec(txt);
        if (m) { [h.vencimentos, h.descontos, h.liquido] = m.slice(1).map(num); h = null; continue; }
        // Linha de eventos: até três colunas (provento | desconto | informativo)
        const cols = { provento: [], desconto: [], informativo: [] };
        palavras.forEach(p => cols[p.x < COL_DESCONTO ? 'provento' : p.x < COL_INFO ? 'desconto' : 'informativo'].push(p.t));
        Object.entries(cols).forEach(([tipo, t]) => {
          if (!t.length) return;
          if (/^\d{3}$/.test(t[0])) {
            const ns = []; while (t.length > 1 && NUM.test(t[t.length - 1]) && ns.length < (tipo === 'informativo' ? 1 : 2)) ns.unshift(num(t.pop()));
            h.itens.push({ codigo: t[0], nome: t.slice(1).join(' '), tipo, ref: tipo !== 'informativo' && ns.length > 1 ? ns[0] : null, valor: ns.length ? ns[ns.length - 1] : 0 });
          } else if (tipo === 'informativo' && NUM.test(t[t.length - 1])) h.itens.push({ codigo: null, nome: t.slice(0, -1).join(' '), tipo, ref: null, valor: num(t[t.length - 1]) });
          else h.obs.push(t.join(' '));
        });
      }
    }
    doc.tipo = tipoDoc(doc.tipoTexto);
    // Confere cada holerite com os totais impressos
    doc.holerites.forEach(x => {
      x.obs = x.obs.join(' ').replace(/\s+/g, ' ').trim();
      const s = tipo => r2(x.itens.filter(i => i.tipo === tipo).reduce((a, i) => a + i.valor, 0));
      x.confere = x.vencimentos != null && Math.abs(s('provento') - x.vencimentos) < 0.01 && Math.abs(s('desconto') - x.descontos) < 0.01 && Math.abs(r2(x.vencimentos - x.descontos) - x.liquido) < 0.01;
      const info = cod => (x.itens.find(i => i.tipo === 'informativo' && i.codigo === cod) || {}).valor || 0;
      x.bases = { baseInss: info('920'), inss: info('922'), baseFgts: info('923'), fgts: info('924'), baseIrrf: info('925'), irrf: info('926') };
    });
    return doc;
  }

  return { ler, blocos, tipoDoc, carregarPdfjs };
})();
if (typeof module !== 'undefined') module.exports = HPDF;
