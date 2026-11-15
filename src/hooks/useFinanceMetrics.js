// src/hooks/useFinanceMetrics.js
import { useMemo } from 'react';
import { normalizeDateISO, formatDateToBR, parseFaturaDescription } from '../utils/financeUtils';

/* ------------------------------------------------------------------ */
/* Constantes e helpers                                                */
/* ------------------------------------------------------------------ */

const CAT = {
  APORTE: 'Aporte de Investimento',
  RENDIMENTO: 'Rendimento de Investimento',
  RESGATE: 'Resgate de Investimento'
};

// Referência estável: um `[]` novo a cada render invalidaria todos os useMemo
const EMPTY_LIST = [];

const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const statusOf = (t) => t.status || 'pago';

// "Cartão" == "cartao" == "CARTÃO" na busca
const normalizeText = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Parcelas viram "CDB (1/3)", "CDB (2/3)"... mas são o mesmo ativo
const PARCEL_SUFFIX = /\s*\(\d+\/\d+\)\s*$/;
const getAssetName = (description) =>
  (description || '').split(' [')[0].replace(PARCEL_SUFFIX, '').trim() || 'Ativo Geral';

const getYear = (dateStr) => {
  if (!dateStr) return null;
  return dateStr.includes('/') ? dateStr.split('/')[2] : dateStr.split('-')[0];
};

const safeISO = (date) => (date ? normalizeDateISO(date) : '');

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useFinanceMetrics({
  transactions = EMPTY_LIST,
  filterMonth = 'all',
  filterYear = new Date().getFullYear().toString(),
  isProjected = false,
  chartType = 'despesa',
  searchTerm = '',
  statusFilter = 'todos'
}) {
  const currentYear = new Date().getFullYear().toString();

  // 1. Anos disponíveis para o filtro (-3 até +15 anos + anos das transações)
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    transactions.forEach((t) => {
      const y = getYear(t.date);
      if (y && /^\d{4}$/.test(y)) yearsSet.add(y);
    });
    const baseYear = parseInt(currentYear, 10);
    for (let i = -3; i <= 15; i++) yearsSet.add(String(baseYear + i));
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYear]);

  // 2. Transações do Mês/Ano selecionado (suporta 'all' em ambos)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return true;
      const [y, m] = normalizeDateISO(t.date).split('-');
      if (filterYear !== 'all' && filterYear !== y) return false;
      if (filterMonth !== 'all' && filterMonth !== m) return false;
      return true;
    });
  }, [transactions, filterMonth, filterYear]);

  // 3. Totais acumulados reais (histórico completo pago)
  const { saldoRealTotal, investidoRealTotal } = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        if (statusOf(t) !== 'pago') return acc;
        const valor = num(t.amount);

        // Saldo em conta: rendimentos reinvestidos NÃO entram
        if (t.type === 'receita' && t.category !== CAT.RENDIMENTO) acc.saldoRealTotal += valor;
        if (t.type === 'despesa') acc.saldoRealTotal -= valor;

        // Carteira: aportes e rendimentos somam, resgates subtraem
        if (t.category === CAT.APORTE || t.category === CAT.RENDIMENTO) acc.investidoRealTotal += valor;
        if (t.category === CAT.RESGATE) acc.investidoRealTotal -= valor;

        return acc;
      },
      { saldoRealTotal: 0, investidoRealTotal: 0 }
    );
  }, [transactions]);

  // 4. Totais do período (operacional vs. carteira)
  const periodMetrics = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => {
        const pago = statusOf(t) === 'pago';
        const valor = num(t.amount);
        const isAporte = t.category === CAT.APORTE;
        const isRendimento = t.category === CAT.RENDIMENTO;
        const isResgate = t.category === CAT.RESGATE;

        if (t.type === 'receita') {
          if (pago) {
            if (isRendimento) acc.rendimentosPagosMes += valor;
            else if (!isResgate) acc.receitasPagas += valor;
          } else if (isRendimento) {
            acc.rendimentosPendentesMes += valor;
          } else {
            acc.aReceber += valor;
            if (isResgate) acc.resgatesPendentesMes += valor;
          }
        } else if (pago) {
          if (isAporte) acc.aportesPagosMes += valor;
          else acc.despesasPagas += valor;
        } else {
          acc.aPagar += valor;
          if (isAporte) acc.aportesPendentesMes += valor;
        }
        return acc;
      },
      {
        receitasPagas: 0,
        despesasPagas: 0,
        aPagar: 0,
        aReceber: 0,
        aportesPagosMes: 0,
        aportesPendentesMes: 0,
        rendimentosPagosMes: 0,
        rendimentosPendentesMes: 0,
        resgatesPendentesMes: 0
      }
    );
  }, [filteredTransactions]);

  const {
    receitasPagas, despesasPagas, aPagar, aReceber,
    aportesPagosMes, aportesPendentesMes,
    rendimentosPagosMes, rendimentosPendentesMes,
    resgatesPendentesMes
  } = periodMetrics;

  // 5. Consolidação para os cards
  const receitasOperacionaisAberto = aReceber - resgatesPendentesMes;
  const despesasOperacionaisAberto = aPagar - aportesPendentesMes;

  const displayReceitas = isProjected ? receitasPagas + receitasOperacionaisAberto : receitasPagas;
  const displayDespesas = isProjected ? despesasPagas + despesasOperacionaisAberto : despesasPagas;
  const displayBalancoMensal = displayReceitas - displayDespesas;

  const displaySaldoGlobal = isProjected ? saldoRealTotal + aReceber - aPagar : saldoRealTotal;

  const displayTotalInvestido = isProjected
    ? investidoRealTotal + aportesPendentesMes + rendimentosPendentesMes - resgatesPendentesMes
    : investidoRealTotal;

  const aportesTotaisMes = isProjected
    ? aportesPagosMes + aportesPendentesMes + rendimentosPagosMes + rendimentosPendentesMes
    : aportesPagosMes + rendimentosPagosMes;
  const taxaPoupancaMes = displayReceitas > 0 ? Math.round((aportesTotaisMes / displayReceitas) * 100) : 0;

  // 6. Carteira por ativo (aportes + rendimentos - resgates)
  const carteiraInvestimentos = useMemo(() => {
    // Set evita o O(n²) do antigo filteredTransactions.some(...) dentro do loop
    const idsNoPeriodo = isProjected ? new Set(filteredTransactions.map((t) => t.id)) : null;
    const ativos = new Map(); // chave normalizada -> { name, value }

    transactions.forEach((t) => {
      const isInvest = t.category === CAT.APORTE || t.category === CAT.RENDIMENTO || t.category === CAT.RESGATE;
      if (!isInvest) return;

      const pago = statusOf(t) === 'pago';
      const deveContar = pago || (isProjected && idsNoPeriodo.has(t.id));
      if (!deveContar) return;

      const name = getAssetName(t.description);
      const key = normalizeText(name);
      const entry = ativos.get(key) || { name, value: 0 };
      entry.value += t.category === CAT.RESGATE ? -num(t.amount) : num(t.amount);
      ativos.set(key, entry);
    });

    return Array.from(ativos.values())
      .map(({ name, value }) => ({ name, value: round2(value) }))
      .filter((ativo) => ativo.value > 0.01)
      .sort((a, b) => b.value - a.value);
  }, [transactions, isProjected, filteredTransactions]);

  const chartData = useMemo(() => {
    if (chartType === 'investimento') return carteiraInvestimentos;

    const porCategoria = new Map();
    filteredTransactions.forEach((t) => {
      if (t.type !== chartType) return;
      if (!isProjected && statusOf(t) !== 'pago') return;
      if (t.category === CAT.APORTE || t.category === CAT.RESGATE || t.category === CAT.RENDIMENTO) return;
      porCategoria.set(t.category, (porCategoria.get(t.category) || 0) + num(t.amount));
    });

    return Array.from(porCategoria, ([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, isProjected, chartType, carteiraInvestimentos]);

  const chartTotalValue = useMemo(
    () => round2(chartData.reduce((acc, item) => acc + item.value, 0)),
    [chartData]
  );

  // 7. Extrato: busca, ordenação e agrupamento por data

  // Índice de busca recalculado só quando o período muda (não a cada tecla).
  // Usa o título "limpo" e os itens da fatura, em vez do texto serializado cru.
  const searchIndex = useMemo(() => {
    const index = new Map();
    filteredTransactions.forEach((t) => {
      const parsed = parseFaturaDescription(t.description, t.category) || {};
      const itens = (parsed.items || []).map((i) => i.nome);
      index.set(t.id, normalizeText([parsed.mainTitle ?? t.description, t.category, ...itens].join(' ')));
    });
    return index;
  }, [filteredTransactions]);

  const sortedTransactions = useMemo(() => {
    const query = normalizeText(searchTerm);
    return filteredTransactions
      .filter((t) => {
        const matchesSearch = !query || (searchIndex.get(t.id) || '').includes(query);
        const matchesStatus = statusFilter === 'todos' || statusOf(t) === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => safeISO(b.date).localeCompare(safeISO(a.date)));
  }, [filteredTransactions, searchIndex, searchTerm, statusFilter]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map(); // Map mantém a ordem de inserção (datas mais recentes primeiro)
    sortedTransactions.forEach((t) => {
      const dateKey = t.date ? formatDateToBR(t.date) : 'Sem data';
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(t);
    });
    return Array.from(groups.entries());
  }, [sortedTransactions]);

  return {
    availableYears,
    filteredTransactions,
    sortedTransactions,
    groupedTransactions,
    displayReceitas: round2(displayReceitas),
    displayDespesas: round2(displayDespesas),
    displayBalancoMensal: round2(displayBalancoMensal),
    displaySaldoGlobal: round2(displaySaldoGlobal),
    displayTotalInvestido: round2(displayTotalInvestido),
    aPagar: round2(aPagar),
    aReceber: round2(aReceber),
    taxaPoupancaMes,
    chartData,
    chartTotalValue
  };
}
