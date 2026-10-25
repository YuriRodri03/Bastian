import { useMemo } from 'react';
import { normalizeDateISO, formatDateToBR } from '../utils/financeUtils';

export function useFinanceMetrics({
  transactions = [],
  filterMonth = 'all',
  filterYear = new Date().getFullYear().toString(),
  isProjected = false,
  chartType = 'despesa',
  searchTerm = '',
  statusFilter = 'todos'
}) {
  const currentYear = new Date().getFullYear().toString();

  // 1. Anos disponíveis para o filtro
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    transactions.forEach(t => {
      if (t.date) {
        const y = t.date.includes('/') ? t.date.split('/')[2] : t.date.split('-')[0];
        if (y) yearsSet.add(y);
      }
    });
    const baseYear = parseInt(currentYear, 10);
    for (let i = -2; i <= 5; i++) {
      yearsSet.add(String(baseYear + i));
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYear]);

  // 2. Transações filtradas pelo Mês/Ano selecionado
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return true;
      const iso = normalizeDateISO(t.date);
      const [y, m] = iso.split('-');
      if (filterYear !== y) return false;
      if (filterMonth !== 'all' && filterMonth !== m) return false;
      return true;
    });
  }, [transactions, filterMonth, filterYear]);

  // 3. Totais Acumulados Reais (Histórico Completo Pago)
  const { saldoRealTotal, investidoRealTotal } = useMemo(() => {
    return transactions.reduce((acc, t) => {
      if ((t.status || 'pago') === 'pago') {
        const valor = Number(t.amount) || 0;
        if (t.type === 'receita') acc.saldoRealTotal += valor;
        if (t.type === 'despesa') acc.saldoRealTotal -= valor;
        
        if (t.category === 'Aporte de Investimento') acc.investidoRealTotal += valor;
        if (t.category === 'Resgate de Investimento') acc.investidoRealTotal -= valor;
      }
      return acc;
    }, { saldoRealTotal: 0, investidoRealTotal: 0 });
  }, [transactions]);

  // 4. Totais do Período Selecionado (Isolando Operacional vs. Carteira)
  const periodMetrics = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const tStatus = t.status || 'pago';
      const valor = Number(t.amount) || 0;
      const isAporte = t.category === 'Aporte de Investimento';
      const isResgate = t.category === 'Resgate de Investimento';
      
      if (t.type === 'receita') {
        if (tStatus === 'pago') {
          if (!isResgate) acc.receitasPagas += valor;
        } else {
          acc.aReceber += valor;
          if (isResgate) acc.resgatesPendentesMes += valor;
        }
      } else {
        if (tStatus === 'pago') {
          if (isAporte) acc.aportesPagosMes += valor;
          else acc.despesasPagas += valor;
        } else {
          acc.aPagar += valor;
          if (isAporte) acc.aportesPendentesMes += valor;
        }
      }
      return acc;
    }, { 
      receitasPagas: 0, despesasPagas: 0, aPagar: 0, aReceber: 0, 
      aportesPagosMes: 0, aportesPendentesMes: 0, resgatesPendentesMes: 0 
    });
  }, [filteredTransactions]);

  const {
    receitasPagas, despesasPagas, aPagar, aReceber,
    aportesPagosMes, aportesPendentesMes, resgatesPendentesMes
  } = periodMetrics;

  // 5. Consolidação para exibição nos Cards
  const receitasOperacionaisAberto = aReceber - resgatesPendentesMes;
  const despesasOperacionaisAberto = aPagar - aportesPendentesMes;

  const displayReceitas = isProjected ? receitasPagas + receitasOperacionaisAberto : receitasPagas;
  const displayDespesas = isProjected ? despesasPagas + despesasOperacionaisAberto : despesasPagas;
  const displayBalancoMensal = displayReceitas - displayDespesas; 

  const displaySaldoGlobal = isProjected 
    ? saldoRealTotal + aReceber - aPagar 
    : saldoRealTotal;

  const displayTotalInvestido = isProjected
    ? investidoRealTotal + aportesPendentesMes - resgatesPendentesMes
    : investidoRealTotal;

  const aportesTotaisMes = isProjected ? (aportesPagosMes + aportesPendentesMes) : aportesPagosMes;
  const taxaPoupancaMes = displayReceitas > 0 ? Math.round((aportesTotaisMes / displayReceitas) * 100) : 0;

  // 6. Detalhamento da Carteira e Gráfico
  const carteiraInvestimentos = useMemo(() => {
    const ativos = {};
    transactions.forEach(t => {
      const isPaid = (t.status || 'pago') === 'pago';
      const isPendingInFilter = !isPaid && filteredTransactions.some(ft => ft.id === t.id); 
      const deveContar = isProjected ? (isPaid || isPendingInFilter) : isPaid;

      if (deveContar) {
        const nomeAtivo = t.description.trim();
        if (t.category === 'Aporte de Investimento') {
          ativos[nomeAtivo] = (ativos[nomeAtivo] || 0) + Number(t.amount);
        } else if (t.category === 'Resgate de Investimento') {
          ativos[nomeAtivo] = (ativos[nomeAtivo] || 0) - Number(t.amount);
        }
      }
    });
    
    return Object.entries(ativos)
      .map(([name, value]) => ({ name, value }))
      .filter(ativo => ativo.value > 0.01)
      .sort((a, b) => b.value - a.value);
  }, [transactions, isProjected, filteredTransactions]);

  const chartData = useMemo(() => {
    if (chartType === 'investimento') return carteiraInvestimentos;

    const listFilter = filteredTransactions.filter(t => {
      const matchType = t.type === chartType;
      const matchStatus = isProjected ? true : (t.status || 'pago') === 'pago';
      const isNotInvestmentTransfer = t.category !== 'Aporte de Investimento' && t.category !== 'Resgate de Investimento';
      return matchType && matchStatus && isNotInvestmentTransfer;
    });

    const agrupado = listFilter.reduce((acc, transacao) => {
      const index = acc.findIndex(item => item.name === transacao.category);
      if (index !== -1) acc[index].value += Number(transacao.amount);
      else acc.push({ name: transacao.category, value: Number(transacao.amount) });
      return acc;
    }, []);
    return agrupado.sort((a, b) => b.value - a.value);
  }, [filteredTransactions, isProjected, chartType, carteiraInvestimentos]);

  const chartTotalValue = useMemo(() => {
    return chartData.reduce((acc, item) => acc + item.value, 0);
  }, [chartData]);

  // 7. Extrato Ordenado e Agrupado por Data
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions]
      .filter(t => {
        const query = searchTerm.toLowerCase().trim();
        const matchesSearch = !query || 
          t.description.toLowerCase().includes(query) || 
          t.category.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'todos' ? true : (t.status || 'pago') === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = normalizeDateISO(a.date);
        const dateB = normalizeDateISO(b.date);
        return dateB.localeCompare(dateA);
      });
  }, [filteredTransactions, searchTerm, statusFilter]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    sortedTransactions.forEach(t => {
      const dateKey = formatDateToBR(t.date);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return Object.entries(groups);
  }, [sortedTransactions]);

  return {
    availableYears,
    filteredTransactions,
    sortedTransactions,
    groupedTransactions,
    displayReceitas,
    displayDespesas,
    displayBalancoMensal,
    displaySaldoGlobal,
    displayTotalInvestido,
    aPagar,
    aReceber,
    taxaPoupancaMes,
    chartData,
    chartTotalValue
  };
}