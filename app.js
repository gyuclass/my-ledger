/**
 * 가계부 MVP 애플리케이션 상태 및 화면 렌더링 로직 (app.js)
 * 모든 데이터 로드 및 저장(CRUD) 메서드가 Supabase 비동기 통신에 맞춰 async/await 기반으로 동작합니다.
 */

// 애플리케이션 상태 관리 객체 (State)
const state = {
  currentTab: 'dashboard',
  selectedYear: 2026,
  selectedMonth: new Date().getMonth() + 1, // 1 ~ 12
  expenseFilter: {
    category: 'all',
    paymentMethod: 'all'
  },
  charts: {
    trend: null,
    category: null
  },
  excelTransactions: [], // 파싱된 엑셀 임시 대기 목록
  excelForceYear: true   // 연도를 기준 연도로 보정할지 여부
};

// 화폐 포맷 헬퍼 함수 (천 단위 콤마 추가)
function formatWon(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0원';
  const rounded = Math.round(amount);
  if (rounded < 0) {
    return `-${Math.abs(rounded).toLocaleString()}원`;
  }
  return `${rounded.toLocaleString()}원`;
}

// 로딩 스피너 표시 함수
function showLoading() {
  const container = document.getElementById('tab-content');
  if (container) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 space-y-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p class="text-xs text-slate-400 font-semibold animate-pulse">데이터를 불러오는 중입니다...</p>
      </div>
    `;
  }
}

// 초기화 실행
document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  
  // 1. 기준 설정 세팅
  const settings = await window.StorageService.getSettings();
  state.selectedYear = settings.defaultYear || 2026;
  
  const yearSelect = document.getElementById('global-year-select');
  if (yearSelect) {
    yearSelect.value = state.selectedYear;
  }

  // 2. 초기 탭 렌더링
  await switchTab(state.currentTab);
});

// 전역 연도 변경 핸들러
async function changeGlobalYear(year) {
  state.selectedYear = parseInt(year);
  await switchTab(state.currentTab); // 현재 탭 다시 그리기
}

// 탭 전환 핸들러
async function switchTab(tabId) {
  state.currentTab = tabId;
  
  // 헤더 네비게이션 탭 액티브 스타일 클래스 처리
  const tabs = ['dashboard', 'expenses', 'income', 'yearly', 'settings'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const mBtn = document.getElementById(`m-tab-${t}`);
    
    if (btn) {
      if (t === tabId) {
        btn.classList.add('active', 'text-indigo-600');
        btn.classList.remove('text-slate-600');
      } else {
        btn.classList.remove('active', 'text-indigo-600');
        btn.classList.add('text-slate-600');
      }
    }
    
    if (mBtn) {
      if (t === tabId) {
        mBtn.classList.add('text-indigo-600');
        mBtn.classList.remove('text-slate-500');
      } else {
        mBtn.classList.remove('text-indigo-600');
        mBtn.classList.add('text-slate-500');
      }
    }
  });

  showLoading();

  // 콘텐츠 렌더링 분기
  switch (tabId) {
    case 'dashboard':
      await renderDashboard();
      break;
    case 'expenses':
      await renderExpenses();
      break;
    case 'income':
      await renderIncome();
      break;
    case 'yearly':
      await renderYearlyTable();
      break;
    case 'settings':
      await renderSettings();
      break;
  }
  
  // 아이콘 업데이트
  lucide.createIcons();
}

// ----------------------------------------------------
// 1. 대시보드 탭 (Dashboard)
// ----------------------------------------------------
async function renderDashboard() {
  const container = document.getElementById('tab-content');
  
  // 데이터 병렬 조회 및 싱크 완료 대기
  const [allExpenses, allIncomes] = await Promise.all([
    window.StorageService.getExpenses(),
    window.StorageService.getIncomes()
  ]);

  const expenses = allExpenses.filter(e => e.year === state.selectedYear);
  const incomes = allIncomes.filter(i => i.year === state.selectedYear);
  
  // 이번 달 요약
  const thisMonthExpenses = expenses.filter(e => e.month === state.selectedMonth);
  const thisMonthIncomes = incomes.filter(i => i.month === state.selectedMonth);
  
  const totalMonthExpense = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthIncome = thisMonthIncomes.reduce((sum, i) => sum + i.amount, 0);
  const monthBalance = totalMonthIncome - totalMonthExpense;
  
  // 연간 요약
  const totalYearExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalYearIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const yearBalance = totalYearIncome - totalYearExpense;

  // HTML 구성
  container.innerHTML = `
    <!-- 월 선택 퀵바 -->
    <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
      <span class="text-sm font-bold text-slate-500">조회 월 선택</span>
      <div class="flex space-x-1 overflow-x-auto py-1">
        ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
          <button onclick="changeDashboardMonth(${m})" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.selectedMonth === m ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}">
            ${m}월
          </button>
        `).join('')}
      </div>
    </div>

    <!-- 요약 카드 그리드 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="glass-card rounded-2xl p-6 hover-lift">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">${state.selectedMonth}월 총 수입</p>
            <h3 class="text-2xl font-bold text-slate-800 mt-2">${formatWon(totalMonthIncome)}</h3>
          </div>
          <div class="bg-emerald-100 text-emerald-600 p-3 rounded-xl"><i data-lucide="trending-up" class="w-6 h-6"></i></div>
        </div>
        <p class="text-xs text-slate-500 mt-4">해당 월에 입력된 모든 수입의 합산입니다.</p>
      </div>
      
      <div class="glass-card rounded-2xl p-6 hover-lift">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">${state.selectedMonth}월 총 지출</p>
            <h3 class="text-2xl font-bold text-slate-800 mt-2">${formatWon(totalMonthExpense)}</h3>
          </div>
          <div class="bg-indigo-100 text-indigo-600 p-3 rounded-xl"><i data-lucide="credit-card" class="w-6 h-6"></i></div>
        </div>
        <p class="text-xs text-slate-500 mt-4">해당 월에 입력된 모든 지출(변동+고정)의 합산입니다.</p>
      </div>

      <div class="glass-card rounded-2xl p-6 hover-lift">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">${state.selectedMonth}월 순 잔액</p>
            <h3 class="text-2xl font-bold ${monthBalance >= 0 ? 'text-emerald-600' : 'text-red-500'} mt-2">${formatWon(monthBalance)}</h3>
          </div>
          <div class="p-3 rounded-xl ${monthBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}">
            <i data-lucide="${monthBalance >= 0 ? 'smile' : 'frown'}" class="w-6 h-6"></i>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-4">수입에서 지출을 차감한 값입니다.</p>
      </div>
    </div>

    <!-- 연간 누적 요약 -->
    <div class="glass-card rounded-2xl p-6">
      <h4 class="text-sm font-bold text-slate-500 mb-4">${state.selectedYear}년 연간 누적 요약 ${window.StorageService.isSupabaseEnabled() ? '<span class="text-xs text-indigo-500 font-bold ml-1">● Supabase 실시간 연동 중</span>' : ''}</h4>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div class="p-3 bg-slate-50 rounded-xl">
          <span class="text-xs font-semibold text-slate-400 block">연 누적 수입</span>
          <span class="text-lg font-bold text-slate-700">${formatWon(totalYearIncome)}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl">
          <span class="text-xs font-semibold text-slate-400 block">연 누적 지출</span>
          <span class="text-lg font-bold text-slate-700">${formatWon(totalYearExpense)}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl">
          <span class="text-xs font-semibold text-slate-400 block">연 누적 잔액</span>
          <span class="text-lg font-bold ${yearBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}">${formatWon(yearBalance)}</span>
        </div>
      </div>
    </div>

    <!-- 차트 영역 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="glass-card rounded-2xl p-6 lg:col-span-2">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-sm font-bold text-slate-600">월별 지출 및 수입 추이</h4>
          <span class="text-xs text-slate-400">1월 ~ 12월</span>
        </div>
        <div class="relative h-64">
          <canvas id="trendChart"></canvas>
        </div>
      </div>
      
      <div class="glass-card rounded-2xl p-6">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-sm font-bold text-slate-600">${state.selectedMonth}월 분류별 지출 비중</h4>
          <span class="text-xs text-slate-400">지출 기준</span>
        </div>
        <div class="relative h-64 flex items-center justify-center">
          <canvas id="categoryChart"></canvas>
        </div>
      </div>
    </div>
  `;

  drawTrendChart(incomes, expenses);
  drawCategoryChart(thisMonthExpenses);
  
  lucide.createIcons();
}

async function changeDashboardMonth(m) {
  state.selectedMonth = m;
  showLoading();
  await renderDashboard();
}

function drawTrendChart(incomes, expenses) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const monthlyIncomes = Array(12).fill(0);
  const monthlyExpenses = Array(12).fill(0);
  
  incomes.forEach(i => {
    if (i.month >= 1 && i.month <= 12) monthlyIncomes[i.month - 1] += i.amount;
  });
  
  expenses.forEach(e => {
    if (e.month >= 1 && e.month <= 12) monthlyExpenses[e.month - 1] += e.amount;
  });

  if (state.charts.trend) {
    state.charts.trend.destroy();
  }

  state.charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 12}, (_, i) => `${i + 1}월`),
      datasets: [
        {
          label: '수입',
          data: monthlyIncomes,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 4,
        },
        {
          label: '지출',
          data: monthlyExpenses,
          backgroundColor: 'rgba(99, 102, 241, 0.75)',
          borderColor: '#6366f1',
          borderWidth: 1.5,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Noto Sans KR', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw.toLocaleString()}원`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return (value / 10000).toLocaleString() + '만';
            },
            font: { size: 10 }
          }
        },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

function drawCategoryChart(monthExpenses) {
  const chartCanvas = document.getElementById('categoryChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  
  const categoryTotals = {};
  monthExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  
  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (state.charts.category) {
    state.charts.category.destroy();
  }

  if (labels.length === 0) {
    const chartContainer = ctx.canvas.parentNode;
    chartContainer.innerHTML = `
      <div class="text-center text-slate-400 py-12">
        <i data-lucide="info" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <p class="text-xs font-semibold">이번 달 지출 내역이 없습니다.</p>
      </div>
      <canvas id="categoryChart" class="hidden"></canvas>
    `;
    return;
  }

  const colors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', 
    '#3b82f6', '#8b5cf6', '#14b8a6', '#64748b'
  ];

  state.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { family: 'Noto Sans KR', size: 10 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${context.label}: ${value.toLocaleString()}원 (${percentage}%)`;
            }
          }
        }
      },
      cutout: '60%'
    }
  });
}


// ----------------------------------------------------
// 2. 지출 관리 탭 (Expenses) - UI 2단 레이아웃 개편
// ----------------------------------------------------

// 고정지출 템플릿(마스터)의 해당 연월 유효성 검사기
function isFixedExpenseValidForMonth(fixed, targetYear, targetMonth) {
  const startVal = fixed.startYear * 100 + fixed.startMonth;
  const targetVal = targetYear * 100 + targetMonth;
  if (targetVal < startVal) return false;

  if (fixed.endYear && fixed.endMonth) {
    const endVal = fixed.endYear * 100 + fixed.endMonth;
    if (targetVal > endVal) return false;
  }
  return true;
}

// 렌더링 전 고정지출 템플릿의 지출 내역 자동 주입 동기화 함수
async function syncFixedExpensesForMonth(targetYear, targetMonth) {
  const [fixedList, currentExpenses] = await Promise.all([
    window.StorageService.getFixedExpenses(),
    window.StorageService.getExpenses()
  ]);

  const thisMonthExpenses = currentExpenses.filter(e => e.year === targetYear && e.month === targetMonth);
  const validFixedTemplates = fixedList.filter(f => isFixedExpenseValidForMonth(f, targetYear, targetMonth));

  let insertedCount = 0;

  for (const t of validFixedTemplates) {
    const exists = thisMonthExpenses.some(e => e.itemName === t.itemName && e.category === t.category);
    if (!exists) {
      await window.StorageService.addExpense({
        year: targetYear,
        month: targetMonth,
        category: t.category,
        itemName: t.itemName,
        amount: t.amount,
        paymentMethod: t.paymentMethod,
        paymentDay: t.paymentDay,
        isFixed: true,
        memo: t.memo ? `(자동주입) ${t.memo}` : '고정지출 자동반영'
      });
      insertedCount++;
    }
  }

  if (insertedCount > 0) {
    console.log(`${targetYear}년 ${targetMonth}월에 신규 고정지출 ${insertedCount}건이 자동 반영되었습니다.`);
  }
}

async function renderExpenses() {
  const container = document.getElementById('tab-content');
  
  // 0. 고정지출 싱크 자동 실행 (조회하는 달에 맞는 템플릿 실시간 동기화)
  await syncFixedExpensesForMonth(state.selectedYear, state.selectedMonth);

  // 1. 데이터 일괄 조회 대기 (실시간 월 집계 계산용 수입 데이터도 함께 쿼리)
  const [categories, paymentMethods, allExpenses, fixedList, allIncomes] = await Promise.all([
    window.StorageService.getCategories(),
    window.StorageService.getPaymentMethods(),
    window.StorageService.getExpenses(),
    window.StorageService.getFixedExpenses(),
    window.StorageService.getIncomes()
  ]);
  
  // 현재 월의 유효한 고정지출 템플릿
  const currentMonthFixedTemplates = fixedList.filter(f => isFixedExpenseValidForMonth(f, state.selectedYear, state.selectedMonth));
  
  // 신규: 이번 달 유효한 고정지출의 합계 금액 계산 (추가/수정 시 즉각 실시간 반영용)
  const totalFixedAmount = currentMonthFixedTemplates.reduce((sum, f) => sum + f.amount, 0);

  // 현재 조회하는 연월의 지출 및 수입 내역 (콤마 실시간 대시보드 계산용)
  let expenses = allExpenses.filter(e => e.year === state.selectedYear && e.month === state.selectedMonth);
  const incomes = allIncomes.filter(i => i.year === state.selectedYear && i.month === state.selectedMonth);
    
  // 실시간 합계 구하기
  const totalMonthExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const monthBalance = totalMonthIncome - totalMonthExpense;

  // 필터 분기
  if (state.expenseFilter.category !== 'all') {
    expenses = expenses.filter(e => e.category === state.expenseFilter.category);
  }
  if (state.expenseFilter.paymentMethod !== 'all') {
    expenses = expenses.filter(e => e.paymentMethod === state.expenseFilter.paymentMethod);
  }
  
  expenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 2단 분리 레이아웃 구조 렌더링
  container.innerHTML = `
    <!-- 지출관리 맨 위의 실시간 미니 요약 대시보드 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="glass-card rounded-xl p-4 bg-emerald-50/40 border border-emerald-100/50 flex justify-between items-center hover-lift">
        <div>
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">${state.selectedMonth}월 총 수입</span>
          <span class="text-base font-extrabold text-emerald-600">${formatWon(totalMonthIncome)}</span>
        </div>
        <div class="bg-emerald-100/50 text-emerald-600 p-2 rounded-lg"><i data-lucide="trending-up" class="w-4 h-4"></i></div>
      </div>
      
      <div class="glass-card rounded-xl p-4 bg-indigo-50/30 border border-indigo-100/30 flex justify-between items-center hover-lift">
        <div>
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">${state.selectedMonth}월 총 지출</span>
          <span class="text-base font-extrabold text-indigo-600">${formatWon(totalMonthExpense)}</span>
        </div>
        <div class="bg-indigo-100/40 text-indigo-600 p-2 rounded-lg"><i data-lucide="credit-card" class="w-4 h-4"></i></div>
      </div>

      <div class="glass-card rounded-xl p-4 ${monthBalance >= 0 ? 'bg-emerald-50/40 border-emerald-100/50' : 'bg-red-50/30 border-red-100/30'} flex justify-between items-center hover-lift">
        <div>
          <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">${state.selectedMonth}월 순 잔액</span>
          <span class="text-base font-extrabold ${monthBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}">${formatWon(monthBalance)}</span>
        </div>
        <div class="p-2 rounded-lg ${monthBalance >= 0 ? 'bg-emerald-100/50 text-emerald-600' : 'bg-red-100/50 text-red-500'}">
          <i data-lucide="${monthBalance >= 0 ? 'smile' : 'frown'}" class="w-4 h-4"></i>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- [좌측 단] 고정지출 원본 관리 섹션 (신규: 고정지출 유효 총합 위젯 탑재) -->
      <div class="glass-card rounded-2xl p-6 flex flex-col h-fit">
        <div class="flex items-start justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 class="text-sm font-bold text-slate-700 flex flex-col">
            <span class="flex items-center gap-1.5"><i data-lucide="pin" class="w-4 h-4 text-indigo-500"></i> 고정지출 원본 관리</span>
            <span class="text-[11px] text-indigo-600 font-black mt-1 bg-indigo-50 px-2 py-0.5 rounded w-fit">
              이번 달 고정비 총합: ${formatWon(totalFixedAmount)}
            </span>
          </h3>
          <button onclick="openFixedModal()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 shrink-0">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> 등록
          </button>
        </div>

        <p class="text-[11px] text-slate-400 font-medium mb-3 leading-relaxed">
          여기에 등록해 두면, 설정된 유효 기간에 맞춰 매월 지출 내역에 자동으로 주입됩니다.
        </p>

        <!-- 고정비 원본 목록 -->
        <div class="space-y-3 max-h-[450px] overflow-y-auto pr-1">
          ${currentMonthFixedTemplates.length === 0 ? `
            <div class="text-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed">
              <p class="text-xs font-bold">이번 달에 유효한 고정비가 없습니다.</p>
              <p class="text-[10px] text-slate-300 mt-1">상단 등록 버튼을 눌러 새로 생성해보세요.</p>
            </div>
          ` : currentMonthFixedTemplates.map(f => {
            const endText = f.endYear ? `${f.endYear}.${String(f.endMonth).padStart(2,'0')} 만기` : '계속 발생';
            return `
              <div class="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 rounded-xl transition flex flex-col justify-between">
                <div class="flex justify-between items-start">
                  <div>
                    <div class="flex items-center space-x-1.5">
                      <span class="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">${f.category}</span>
                      <span class="text-xs font-bold text-slate-700">${f.itemName}</span>
                    </div>
                    <span class="block text-[10px] text-slate-400 font-semibold mt-1">
                      기간: ${f.startYear}.${String(f.startMonth).padStart(2,'0')} ~ ${endText}
                    </span>
                    ${f.memo ? `<span class="block text-[9px] text-slate-400 mt-0.5">${f.memo}</span>` : ''}
                  </div>
                  <span class="text-xs font-bold text-slate-700">${formatWon(f.amount)}</span>
                </div>
                <div class="flex justify-end space-x-2 mt-2 pt-2 border-t border-slate-200/40">
                  <button onclick="openFixedModal('${f.id}')" class="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition">수정</button>
                  <button onclick="deleteFixedExpenseItem('${f.id}')" class="text-[10px] font-bold text-red-400 hover:text-red-600 transition">삭제</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- [우측 단] 실제 지출 내역 목록 -->
      <div class="glass-card rounded-2xl p-6 lg:col-span-2 flex flex-col">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-3">
            <h3 class="text-base font-bold text-slate-700">${state.selectedYear}년 ${state.selectedMonth}월 지출 목록</h3>
            <span class="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded-full font-bold">총 ${expenses.length}건</span>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <button onclick="openExpenseCreateForm()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> 일반 지출 수동 등록
            </button>
            
            <div class="flex space-x-1 overflow-x-auto py-1 max-w-full scrollbar-hide">
              ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
                <button onclick="changeExpenseFilterMonth(${m})" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${state.selectedMonth === m ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}">
                  ${m}월
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 엑셀 드롭존 -->
        <div id="expense-dropzone" class="excel-dropzone rounded-xl p-4 mb-4 text-center cursor-pointer hover:border-indigo-400 transition">
          <div class="flex flex-col items-center space-y-1 text-slate-500">
            <i data-lucide="upload-cloud" class="w-6 h-6 text-indigo-500"></i>
            <p class="text-[11px] font-bold">카드 소비 내역 엑셀/ODS 파일 드래그 또는 클릭 업로드</p>
            <p class="text-[9px] text-slate-400 font-medium">리카드, 하나카드 등 탭의 내역을 자동 분석 및 파싱해 줍니다.</p>
          </div>
          <input type="file" id="excel-file-input" class="hidden" accept=".xlsx, .xls, .ods" onchange="handleExcelUpload(event)">
        </div>

        <!-- 필터 영역 -->
        <div class="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div>
            <label class="block text-[9px] font-bold text-slate-400 mb-1">분류 필터</label>
            <select class="w-full bg-white border border-slate-200 rounded-lg text-[11px] p-1.5 focus:outline-none" onchange="filterExpenses('category', this.value)">
              <option value="all">전체 분류</option>
              ${categories.map(c => `<option value="${c.name}" ${state.expenseFilter.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[9px] font-bold text-slate-400 mb-1">결제수단 필터</label>
            <select class="w-full bg-white border border-slate-200 rounded-lg text-[11px] p-1.5 focus:outline-none" onchange="filterExpenses('paymentMethod', this.value)">
              <option value="all">전체 결제수단</option>
              ${paymentMethods.map(pm => `<option value="${pm}" ${state.expenseFilter.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- 지출 내역 리스트 -->
        <div class="overflow-y-auto max-h-[500px] flex-grow pr-1 space-y-3">
          ${expenses.length === 0 ? `
            <div class="text-center py-20 text-slate-400">
              <i data-lucide="info" class="w-10 h-10 mx-auto mb-3 text-slate-300"></i>
              <p class="text-sm font-semibold">지출 내역이 없습니다.</p>
            </div>
          ` : expenses.map(e => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl hover:shadow-sm transition">
              <div class="flex items-start space-x-3">
                <span class="mt-0.5 px-2 py-0.5 text-[9px] font-bold rounded ${e.isFixed ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}">
                  ${e.isFixed ? '고정' : '변동'}
                </span>
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${e.category}</span>
                    <span class="text-sm font-semibold text-slate-700">${e.itemName}</span>
                  </div>
                  <div class="flex items-center space-x-2 mt-1.5 text-xs text-slate-400 font-medium">
                    <span>${e.paymentDay ? `${e.paymentDay}` : '지출일 없음'}</span>
                    <span>•</span>
                    <span>${e.paymentMethod}</span>
                    ${e.memo ? `<span>•</span> <span class="text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded text-xs">${e.memo}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="flex items-center space-x-4">
                <span class="text-sm font-bold text-slate-800 amount-cell">${formatWon(e.amount)}</span>
                <div class="flex space-x-1">
                  <button onclick="openExpenseEdit('${e.id}')" class="p-1 hover:text-indigo-600 text-slate-400 transition">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                  </button>
                  <button onclick="deleteExpenseItem('${e.id}')" class="p-1 hover:text-red-500 text-slate-400 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
    </div>
  `;
  
  lucide.createIcons();
  bindDropzoneEvents();
}

async function changeExpenseFilterMonth(val) {
  state.selectedMonth = parseInt(val);
  showLoading();
  await renderExpenses();
}

async function filterExpenses(key, val) {
  state.expenseFilter[key] = val;
  showLoading();
  await renderExpenses();
}

async function openExpenseCreateForm() {
  document.getElementById('edit-expense-id').value = '';
  document.getElementById('edit-expense-year').value = state.selectedYear;
  document.getElementById('edit-expense-month').value = state.selectedMonth;
  document.getElementById('edit-expense-name').value = '';
  document.getElementById('edit-expense-amount').value = '';
  document.getElementById('edit-expense-day').value = '';
  document.getElementById('edit-expense-fixed').checked = false;
  document.getElementById('edit-expense-memo').value = '';

  const categories = await window.StorageService.getCategories();
  const catSelect = document.getElementById('edit-expense-category');
  catSelect.innerHTML = '<option value="">-- 분류 선택 --</option>' + categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

  const methods = await window.StorageService.getPaymentMethods();
  const pmSelect = document.getElementById('edit-expense-method');
  pmSelect.innerHTML = '<option value="">-- 결제수단 선택 --</option>' + methods.map(pm => `<option value="${pm}">${pm}</option>`).join('');

  document.getElementById('expense-modal').classList.remove('hidden');
  lucide.createIcons();
}

async function handleExpenseAdd(event) {
  event.preventDefault();
  
  const category = document.getElementById('add-expense-category').value;
  const name = document.getElementById('add-expense-name').value;
  const amount = document.getElementById('add-expense-amount').value;
  const day = document.getElementById('add-expense-day').value;
  const method = document.getElementById('add-expense-method').value;
  const isFixed = document.getElementById('add-expense-fixed').checked;
  const memo = document.getElementById('add-expense-memo').value;

  try {
    showLoading();
    await window.StorageService.addExpense({
      year: state.selectedYear,
      month: state.selectedMonth,
      category,
      itemName: name,
      amount,
      paymentMethod: method,
      paymentDay: day,
      isFixed,
      memo
    });
    
    await renderExpenses();
  } catch (err) {
    alert(err.message);
    await renderExpenses();
  }
}

async function deleteExpenseItem(id) {
  if (confirm('지출 항목을 삭제하시겠습니까? (이번 달의 실지출 데이터에서만 삭제됩니다.)')) {
    try {
      showLoading();
      await window.StorageService.deleteExpense(id);
      await renderExpenses();
    } catch (err) {
      alert(err.message);
      await renderExpenses();
    }
  }
}

async function openExpenseEdit(id) {
  const expenses = await window.StorageService.getExpenses();
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('edit-expense-id').value = exp.id;
  document.getElementById('edit-expense-year').value = exp.year;
  document.getElementById('edit-expense-month').value = exp.month;
  document.getElementById('edit-expense-name').value = exp.itemName;
  document.getElementById('edit-expense-amount').value = exp.amount;
  document.getElementById('edit-expense-day').value = exp.paymentDay;
  document.getElementById('edit-expense-fixed').checked = exp.isFixed;
  document.getElementById('edit-expense-memo').value = exp.memo;

  const categories = await window.StorageService.getCategories();
  const catSelect = document.getElementById('edit-expense-category');
  catSelect.innerHTML = categories.map(c => `<option value="${c.name}" ${exp.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

  const methods = await window.StorageService.getPaymentMethods();
  const pmSelect = document.getElementById('edit-expense-method');
  pmSelect.innerHTML = methods.map(pm => `<option value="${pm}" ${exp.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`).join('');

  document.getElementById('expense-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

async function handleExpenseUpdate(event) {
  event.preventDefault();
  const id = document.getElementById('edit-expense-id').value;
  const year = document.getElementById('edit-expense-year').value;
  const month = document.getElementById('edit-expense-month').value;
  const category = document.getElementById('edit-expense-category').value;
  const name = document.getElementById('edit-expense-name').value;
  const amount = document.getElementById('edit-expense-amount').value;
  const day = document.getElementById('edit-expense-day').value;
  const method = document.getElementById('edit-expense-method').value;
  const isFixed = document.getElementById('edit-expense-fixed').checked;
  const memo = document.getElementById('edit-expense-memo').value;

  try {
    showLoading();
    if (id === '') {
      await window.StorageService.addExpense({
        year, month, category, itemName: name, amount, paymentDay: day, paymentMethod: method, isFixed, memo
      });
    } else {
      await window.StorageService.updateExpense(id, {
        year, month, category, itemName: name, amount, paymentDay: day, paymentMethod: method, isFixed, memo
      });
    }
    closeExpenseModal();
    await renderExpenses();
  } catch (err) {
    alert(err.message);
    await renderExpenses();
  }
}

async function openFixedModal(id = null) {
  const categories = await window.StorageService.getCategories();
  const methods = await window.StorageService.getPaymentMethods();

  const catSelect = document.getElementById('edit-fixed-category');
  catSelect.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

  const pmSelect = document.getElementById('edit-fixed-method');
  pmSelect.innerHTML = methods.map(pm => `<option value="${pm}">${pm}</option>`).join('');

  if (id) {
    document.getElementById('fixed-modal-title').innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-indigo-500"></i> 고정지출 템플릿 수정`;
    const list = await window.StorageService.getFixedExpenses();
    const fixed = list.find(f => f.id === id);
    if (!fixed) return;

    document.getElementById('edit-fixed-id').value = fixed.id;
    document.getElementById('edit-fixed-category').value = fixed.category;
    document.getElementById('edit-fixed-method').value = fixed.paymentMethod;
    document.getElementById('edit-fixed-name').value = fixed.itemName;
    document.getElementById('edit-fixed-amount').value = fixed.amount;
    document.getElementById('edit-fixed-day').value = fixed.paymentDay;
    document.getElementById('edit-fixed-memo').value = fixed.memo;

    document.getElementById('edit-fixed-start-year').value = fixed.startYear;
    document.getElementById('edit-fixed-start-month').value = fixed.startMonth;
    document.getElementById('edit-fixed-end-year').value = fixed.endYear || '';
    document.getElementById('edit-fixed-end-month').value = fixed.endMonth || '1';
  } else {
    document.getElementById('fixed-modal-title').innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-indigo-500"></i> 고정지출 템플릿 등록`;
    document.getElementById('edit-fixed-id').value = '';
    document.getElementById('edit-fixed-name').value = '';
    document.getElementById('edit-fixed-amount').value = '';
    document.getElementById('edit-fixed-day').value = '';
    document.getElementById('edit-fixed-memo').value = '';
    document.getElementById('edit-fixed-start-year').value = state.selectedYear;
    document.getElementById('edit-fixed-start-month').value = state.selectedMonth;
    document.getElementById('edit-fixed-end-year').value = '';
  }

  document.getElementById('fixed-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeFixedModal() {
  document.getElementById('fixed-modal').classList.add('hidden');
}

async function handleFixedExpenseSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('edit-fixed-id').value;
  const category = document.getElementById('edit-fixed-category').value;
  const method = document.getElementById('edit-fixed-method').value;
  const name = document.getElementById('edit-fixed-name').value;
  const amount = parseFloat(document.getElementById('edit-fixed-amount').value);
  const day = document.getElementById('edit-fixed-day').value;
  const memo = document.getElementById('edit-fixed-memo').value;

  const startYear = parseInt(document.getElementById('edit-fixed-start-year').value);
  const startMonth = parseInt(document.getElementById('edit-fixed-start-month').value);
  const endYearVal = document.getElementById('edit-fixed-end-year').value;
  const endMonthVal = document.getElementById('edit-fixed-end-month').value;

  const endYear = endYearVal ? parseInt(endYearVal) : null;
  const endMonth = endYearVal ? parseInt(endMonthVal) : null;

  try {
    showLoading();
    
    let oldFixed = null;
    if (id) {
      const list = await window.StorageService.getFixedExpenses();
      oldFixed = list.find(f => f.id === id);
    }

    if (id) {
      await window.StorageService.updateFixedExpense(id, {
        category, paymentMethod: method, itemName: name, amount, paymentDay: day, startYear, startMonth, endYear, endMonth, memo
      });
    } else {
      await window.StorageService.addFixedExpense({
        category, paymentMethod: method, itemName: name, amount, paymentDay: day, startYear, startMonth, endYear, endMonth, memo
      });
    }

    // 신규: 원본 템플릿 수정 시 주입되어 있던 실제 지출 내역도 함께 일괄 업데이트
    if (id && oldFixed) {
      const expenses = await window.StorageService.getExpenses();
      const toUpdate = expenses.filter(e => e.isFixed && e.itemName === oldFixed.itemName && e.category === oldFixed.category);
      await Promise.all(toUpdate.map(e => window.StorageService.updateExpense(e.id, {
        ...e,
        category: category,
        itemName: name,
        amount: amount,
        paymentMethod: method,
        paymentDay: day,
        memo: memo ? `(자동주입) ${memo}` : '고정지출 자동반영'
      })));
    }

    closeFixedModal();
    await renderExpenses();
  } catch (err) {
    alert(err.message);
    await renderExpenses();
  }
}

async function deleteFixedExpenseItem(id) {
  if (confirm('고정지출 템플릿 원본을 삭제하시겠습니까?\n(원본 삭제 시 이미 생성된 이번 달의 지출 내역에서도 동반 삭제됩니다.)')) {
    try {
      showLoading();
      const list = await window.StorageService.getFixedExpenses();
      const fixedTemp = list.find(f => f.id === id);

      await window.StorageService.deleteFixedExpense(id);

      // 신규: 고정지출 템플릿 원본 삭제 시, 실제 지출 목록에 자동 주입되어 있던 내역도 함께 자동 일괄 제거
      if (fixedTemp) {
        const expenses = await window.StorageService.getExpenses();
        const toDelete = expenses.filter(e => e.isFixed && e.itemName === fixedTemp.itemName && e.category === fixedTemp.category);
        await Promise.all(toDelete.map(e => window.StorageService.deleteExpense(e.id)));
      }

      await renderExpenses();
    } catch (err) {
      alert(err.message);
      await renderExpenses();
    }
  }
}


// ----------------------------------------------------
// 3. 수입 관리 탭 (Income)
// ----------------------------------------------------
async function renderIncome() {
  const container = document.getElementById('tab-content');
  
  const incomes = await window.StorageService.getIncomes();
  
  const yearIncomes = incomes.filter(i => i.year === state.selectedYear);
  const totalYearIncome = yearIncomes.reduce((sum, i) => sum + i.amount, 0);

  const filtered = incomes
    .filter(i => i.year === state.selectedYear && i.month === state.selectedMonth)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = `
    <!-- 연간 누적 총 수입 요약 대시보드 카드 -->
    <div class="glass-card rounded-2xl p-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white mb-6 flex justify-between items-center shadow-lg hover-lift">
      <div>
        <span class="text-xs font-bold text-emerald-100 block uppercase tracking-wider">${state.selectedYear}년 연간 총 수입</span>
        <span class="text-2xl font-black mt-1 block">${formatWon(totalYearIncome)}</span>
      </div>
      <div class="p-3 bg-white/10 rounded-xl"><i data-lucide="award" class="w-7 h-7 text-emerald-100"></i></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- 수입 입력 폼 -->
      <div class="glass-card rounded-2xl p-6 h-fit">
        <h3 class="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-5 h-5 text-emerald-500"></i>
          수입 등록 (${state.selectedYear}년 ${state.selectedMonth}월)
        </h3>
        
        <form id="income-add-form" class="space-y-4" onsubmit="handleIncomeAdd(event)">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">수입명</label>
            <input type="text" id="add-income-name" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="예: 1월 급여, 보너스" required>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">금액(원)</label>
            <input type="number" id="add-income-amount" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="숫자만 입력" required>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">메모</label>
            <textarea id="add-income-memo" rows="3" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="특징 사항 기입"></textarea>
          </div>
          
          <button type="submit" class="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-semibold rounded-lg shadow-lg transition">
            수입 추가하기
          </button>
        </form>
      </div>

      <!-- 수입 목록 -->
      <div class="glass-card rounded-2xl p-6 lg:col-span-2 flex flex-col">
        <div class="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <div class="flex items-center space-x-3">
            <h3 class="text-base font-bold text-slate-700">수입 목록</h3>
            <span class="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-bold">총 ${filtered.length}건</span>
          </div>
          
          <div class="flex space-x-1 overflow-x-auto py-1 max-w-full scrollbar-hide">
            ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
              <button onclick="changeIncomeMonth(${m})" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${state.selectedMonth === m ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}">
                ${m}월
              </button>
            `).join('')}
          </div>
        </div>

        <div class="overflow-y-auto max-h-[500px] flex-grow pr-1 space-y-3">
          ${filtered.length === 0 ? `
            <div class="text-center py-20 text-slate-400">
              <i data-lucide="info" class="w-10 h-10 mx-auto mb-3 text-slate-300"></i>
              <p class="text-sm font-semibold">이번 달 수입 내역이 없습니다.</p>
            </div>
          ` : filtered.map(i => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl hover:shadow-sm transition">
              <div>
                <span class="text-sm font-bold text-slate-700">${i.incomeName}</span>
                ${i.memo ? `<span class="ml-2 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded font-medium">${i.memo}</span>` : ''}
                <span class="block text-[10px] text-slate-400 mt-1 font-medium">등록일: ${new Date(i.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="flex items-center space-x-4">
                <span class="text-sm font-bold text-slate-800 amount-cell">${formatWon(i.amount)}</span>
                <div class="flex space-x-1">
                  <button onclick="openIncomeEdit('${i.id}')" class="p-1 hover:text-emerald-600 text-slate-400 transition">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                  </button>
                  <button onclick="deleteIncomeItem('${i.id}')" class="p-1 hover:text-red-500 text-slate-400 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
  
  lucide.createIcons();
}

async function changeIncomeMonth(m) {
  state.selectedMonth = parseInt(m);
  showLoading();
  await renderIncome();
}

async function handleIncomeAdd(event) {
  event.preventDefault();
  const name = document.getElementById('add-income-name').value;
  const amount = document.getElementById('add-income-amount').value;
  const memo = document.getElementById('add-income-memo').value;

  try {
    showLoading();
    await window.StorageService.addIncome({
      year: state.selectedYear,
      month: state.selectedMonth,
      incomeName: name,
      amount,
      memo
    });
    await renderIncome();
  } catch (err) {
    alert(err.message);
    await renderIncome();
  }
}

async function deleteIncomeItem(id) {
  if (confirm('삭제하시겠습니까?')) {
    try {
      showLoading();
      await window.StorageService.deleteIncome(id);
      await renderIncome();
    } catch (err) {
      alert(err.message);
      await renderIncome();
    }
  }
}

async function openIncomeEdit(id) {
  const incomes = await window.StorageService.getIncomes();
  const inc = incomes.find(i => i.id === id);
  if (!inc) return;

  document.getElementById('edit-income-id').value = inc.id;
  document.getElementById('edit-income-year').value = inc.year;
  document.getElementById('edit-income-month').value = inc.month;
  document.getElementById('edit-income-name').value = inc.incomeName;
  document.getElementById('edit-income-amount').value = inc.amount;
  document.getElementById('edit-income-memo').value = inc.memo;

  document.getElementById('income-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeIncomeModal() {
  document.getElementById('income-modal').classList.add('hidden');
}

async function handleIncomeUpdate(event) {
  event.preventDefault();
  const id = document.getElementById('edit-income-id').value;
  const year = document.getElementById('edit-income-year').value;
  const month = document.getElementById('edit-income-month').value;
  const name = document.getElementById('edit-income-name').value;
  const amount = document.getElementById('edit-income-amount').value;
  const memo = document.getElementById('edit-income-memo').value;

  try {
    showLoading();
    await window.StorageService.updateIncome(id, { year, month, incomeName: name, amount, memo });
    closeIncomeModal();
    await renderIncome();
  } catch (err) {
    alert(err.message);
    await renderIncome();
  }
}


// ----------------------------------------------------
// 4. 연간 표 (Yearly Table) - rowspan 셀 병합 & 합계 수평 정렬 완벽 복구
// ----------------------------------------------------
async function renderYearlyTable() {
  const container = document.getElementById('tab-content');
  
  // 신규: 데이터 로딩 버그 긴급 수정 ( getPaymentMethods 체이닝 제거 및 3대 데이터 정확히 로드 )
  const [categories, allExpenses, allIncomes] = await Promise.all([
    window.StorageService.getCategories(),
    window.StorageService.getExpenses(),
    window.StorageService.getIncomes()
  ]);

  const expenses = allExpenses.filter(e => e.year === state.selectedYear);
  const incomes = allIncomes.filter(i => i.year === state.selectedYear);
  
  const rowMap = {}; 
  expenses.forEach(e => {
    const key = `${e.category}__${e.itemName}`;
    if (!rowMap[key]) {
      rowMap[key] = {
        category: e.category,
        itemName: e.itemName,
        months: Array(12).fill(0),
        paymentDay: e.paymentDay || ''
      };
    }
    rowMap[key].months[e.month - 1] += e.amount;
    if (e.paymentDay) rowMap[key].paymentDay = e.paymentDay;
  });

  const rowList = Object.values(rowMap).sort((a, b) => {
    const orderA = categories.find(c => c.name === a.category)?.sortOrder || 99;
    const orderB = categories.find(c => c.name === b.category)?.sortOrder || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.itemName.localeCompare(b.itemName);
  });

  // 셀 병합(rowspan)을 위한 빈도수 계산
  const categoryCounts = {};
  rowList.forEach(row => {
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
  });

  const monthlyTotalExpense = Array(12).fill(0);
  const monthlyTotalIncome = Array(12).fill(0);

  rowList.forEach(row => {
    for (let m = 0; m < 12; m++) {
      monthlyTotalExpense[m] += row.months[m];
    }
  });

  incomes.forEach(i => {
    if (i.month >= 1 && i.month <= 12) {
      monthlyTotalIncome[i.month - 1] += i.amount;
    }
  });

  const monthlyBalance = Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    monthlyBalance[m] = monthlyTotalIncome[m] - monthlyTotalExpense[m];
  }

  const grandTotalExpense = monthlyTotalExpense.reduce((sum, val) => sum + val, 0);
  const grandTotalIncome = monthlyTotalIncome.reduce((sum, val) => sum + val, 0);
  const grandTotalBalance = grandTotalIncome - grandTotalExpense;

  let prevCategory = null;

  container.innerHTML = `
    <div class="glass-card rounded-2xl p-6">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
        <div>
          <h3 class="text-base font-bold text-slate-700 flex items-center gap-2">
            <i data-lucide="table" class="w-5 h-5 text-indigo-500"></i>
            ${state.selectedYear}년 연간 가계부 그리드 뷰
          </h3>
          <p class="text-xs text-slate-400 mt-1">상하좌우 자동 스크롤 고정 및 실시간 연간 합계를 최상단에 제공합니다.</p>
        </div>
        <div class="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <span class="inline-block w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></span> <span>0원/미지출</span>
          <span class="inline-block w-3 h-3 rounded-full bg-indigo-50/50 border border-indigo-200"></span> <span>지출 발생</span>
        </div>
      </div>

      <div class="yearly-grid-container">
        <table class="yearly-table">
          <thead>
            <tr class="bg-slate-50 font-bold text-slate-600 text-xs">
              <th class="sticky-col-1 text-left">분류</th>
              <th class="sticky-col-2 text-left">지출 항목명</th>
              <th class="sticky-col-3 text-center">지출일</th>
              ${Array.from({length: 12}, (_, i) => `<th class="text-center">${i + 1}월</th>`).join('')}
              <th class="text-right">연간 합계</th>
            </tr>
          </thead>
          <tbody class="text-xs text-slate-700">
            
            <!-- 신규: 합계 행의 3단 개별 셀 분리 정렬 매핑 수리 (colspan을 제거하여 스크롤 시 정렬이 완벽하게 맞물림) -->
            <tr class="summary-row text-slate-700 font-bold border-b-2 border-slate-300">
              <td class="sticky-col-1 bg-slate-100 font-bold text-emerald-700">수입 누계</td>
              <td class="sticky-col-2 bg-slate-100 font-bold text-emerald-700">총 수입 (B)</td>
              <td class="sticky-col-3 bg-slate-100 text-center font-bold text-emerald-700">-</td>
              ${monthlyTotalIncome.map(sum => `
                <td class="amount-cell font-bold bg-slate-100/50 text-emerald-600" style="text-align: right;">${sum > 0 ? sum.toLocaleString() : '-'}</td>
              `).join('')}
              <td class="amount-cell font-bold bg-slate-100 text-emerald-600" style="text-align: right;">${grandTotalIncome.toLocaleString()}</td>
            </tr>

            <tr class="summary-row text-slate-700 font-bold border-b-2 border-slate-300">
              <td class="sticky-col-1 bg-slate-100 font-bold text-indigo-700">지출 누계</td>
              <td class="sticky-col-2 bg-slate-100 font-bold text-indigo-700">총 지출 (A)</td>
              <td class="sticky-col-3 bg-slate-100 text-center font-bold text-indigo-700">-</td>
              ${monthlyTotalExpense.map(sum => `
                <td class="amount-cell font-bold bg-slate-100/50 text-slate-800" style="text-align: right;">${sum > 0 ? sum.toLocaleString() : '-'}</td>
              `).join('')}
              <td class="amount-cell font-bold bg-slate-100 text-indigo-600" style="text-align: right;">${grandTotalExpense.toLocaleString()}</td>
            </tr>

            <tr class="summary-row text-slate-800 font-bold border-b-4 border-double border-slate-400">
              <td class="sticky-col-1 bg-slate-100 font-bold text-slate-800">최종 정산</td>
              <td class="sticky-col-2 bg-slate-100 font-bold text-slate-800">순 잔액 (B - A)</td>
              <td class="sticky-col-3 bg-slate-100 text-center font-bold text-slate-800">-</td>
              ${monthlyBalance.map(bal => {
                const isNeg = bal < 0;
                return `
                  <td class="amount-cell font-bold bg-slate-100/50 ${isNeg ? 'negative-amount' : 'positive-amount'}" style="text-align: right;">
                    ${bal !== 0 ? (isNeg ? '-' : '') + Math.abs(bal).toLocaleString() : '-'}
                  </td>
                `;
              }).join('')}
              <td class="amount-cell font-bold bg-slate-100 ${grandTotalBalance < 0 ? 'negative-amount' : 'positive-amount'}" style="text-align: right;">
                ${grandTotalBalance < 0 ? '-' : ''}${Math.abs(grandTotalBalance).toLocaleString()}
              </td>
            </tr>

            <!-- 데이터 행 목록 (셀 병합 & 3단 고정 클래스 추가) -->
            ${rowList.length === 0 ? `
              <tr>
                <td colspan="16" class="text-center py-20 text-slate-400">등록된 지출 내역이 없습니다.</td>
              </tr>
            ` : rowList.map(row => {
              const rowSum = row.months.reduce((sum, val) => sum + val, 0);
              
              const isFirstRowOfCat = (row.category !== prevCategory);
              prevCategory = row.category;

              return `
                <tr class="hover:bg-slate-50/50 transition">
                  ${isFirstRowOfCat ? `
                    <td rowspan="${categoryCounts[row.category]}" class="sticky-col-1 font-bold text-indigo-600 bg-slate-50/40 text-center align-middle border-b border-slate-200">
                      ${row.category}
                    </td>
                  ` : ''}
                  <td class="sticky-col-2 font-semibold text-slate-700">${row.itemName}</td>
                  <td class="sticky-col-3 text-center text-slate-400 font-medium">${row.paymentDay || '-'}</td>
                  ${row.months.map(amount => `
                    <td class="amount-cell ${amount > 0 ? 'bg-indigo-50/10 text-slate-800 font-semibold' : 'text-slate-300'}" style="text-align: right;">
                      ${amount > 0 ? amount.toLocaleString() : '-'}
                    </td>
                  `).join('')}
                  <td class="amount-cell font-bold text-slate-800 bg-slate-50/20" style="text-align: right;">
                    ${rowSum > 0 ? rowSum.toLocaleString() : '-'}
                  </td>
                </tr>
              `;
            }).join('')}

          </tbody>
        </table>
      </div>
    </div>
  `;

  lucide.createIcons();
}


// ----------------------------------------------------
// 5. 설정 탭 (Settings)
// ----------------------------------------------------
async function renderSettings() {
  const container = document.getElementById('tab-content');
  
  const [categories, paymentMethods, settings] = await Promise.all([
    window.StorageService.getCategories(),
    window.StorageService.getPaymentMethods(),
    window.StorageService.getSettings()
  ]);

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- Supabase 연동 설정 카드 -->
      <div class="glass-card rounded-2xl p-6 md:col-span-2">
        <h3 class="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="database" class="w-5 h-5 text-indigo-500"></i>
          Supabase 실시간 데이터 연동 설정
        </h3>
        <form id="supabase-config-form" class="space-y-4" onsubmit="saveSupabaseSettings(event)">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Project URL</label>
              <input type="url" id="sb-url" value="${settings.supabaseUrl || ''}" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="https://xxxxxx.supabase.co" required>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Anon API Key</label>
              <input type="password" id="sb-key" value="${settings.supabaseKey || ''}" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="API Key 입력" required>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div class="flex space-x-2">
              <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow-md transition">연동 및 저장</button>
              ${settings.supabaseUrl ? `<button type="button" onclick="clearSupabaseSettings()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm transition">연동 해제</button>` : ''}
            </div>
            
            <!-- 백업(마이그레이션) 버튼 -->
            ${window.StorageService.isSupabaseEnabled() ? `
              <button type="button" onclick="migrateLocalData()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow-md transition flex items-center gap-1.5">
                <i data-lucide="upload" class="w-4 h-4"></i> 로컬 데이터를 Supabase로 동기화 (백업)
              </button>
            ` : '<span class="text-xs text-slate-400 font-medium">※ Supabase 설정 저장 및 활성화 후 동기화 가능합니다.</span>'}
          </div>
        </form>
      </div>

      <!-- 분류 관리 카드 -->
      <div class="glass-card rounded-2xl p-6">
        <h3 class="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="folder" class="w-5 h-5 text-indigo-500"></i>
          카테고리(분류) 관리
        </h3>
        
        <form class="flex space-x-2 mb-4" onsubmit="handleCategoryAdd(event)">
          <input type="text" id="new-category-name" class="flex-grow px-3 py-1.5 border rounded-lg text-sm input-premium" placeholder="새 분류 입력 (예: 식비)" required>
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg text-sm shadow-md transition">추가</button>
        </form>

        <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          ${categories.map(c => `
            <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/50 rounded-lg">
              <span class="text-sm font-semibold text-slate-600">${c.name}</span>
              <button onclick="deleteCategoryItem('${c.id}')" class="p-1 hover:text-red-500 text-slate-400 transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 결제수단 관리 카드 -->
      <div class="glass-card rounded-2xl p-6">
        <h3 class="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="credit-card" class="w-5 h-5 text-indigo-500"></i>
          결제수단 관리
        </h3>
        
        <form class="flex space-x-2 mb-4" onsubmit="handlePaymentMethodAdd(event)">
          <input type="text" id="new-pm-name" class="flex-grow px-3 py-1.5 border rounded-lg text-sm input-premium" placeholder="새 결제수단 입력" required>
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg text-sm shadow-md transition">추가</button>
        </form>

        <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          ${paymentMethods.map(pm => `
            <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/50 rounded-lg">
              <span class="text-sm font-semibold text-slate-600">${pm}</span>
              <button onclick="deletePaymentMethodItem('${pm}')" class="p-1 hover:text-red-500 text-slate-400 transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 기준 설정 카드 -->
      <div class="glass-card rounded-2xl p-6 md:col-span-2">
        <h3 class="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="sliders" class="w-5 h-5 text-indigo-500"></i>
          기본 환경 설정
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">기동 시 기본 연도</label>
            <select id="setting-default-year" class="w-full px-3 py-2 border rounded-lg text-sm input-premium">
              <option value="2025" ${settings.defaultYear === 2025 ? 'selected' : ''}>2025년</option>
              <option value="2026" ${settings.defaultYear === 2026 ? 'selected' : ''}>2026년</option>
              <option value="2027" ${settings.defaultYear === 2027 ? 'selected' : ''}>2027년</option>
            </select>
          </div>
          <button onclick="saveGlobalSettings()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded-lg text-sm shadow-md transition h-fit">
            설정 저장
          </button>
        </div>
      </div>

    </div>
  `;

  lucide.createIcons();
}

async function saveSupabaseSettings(event) {
  event.preventDefault();
  let url = document.getElementById('sb-url').value.trim();
  const key = document.getElementById('sb-key').value.trim();

  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (url.endsWith('/rest/v1')) {
    url = url.replace('/rest/v1', '');
  }
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  try {
    showLoading();
    await window.StorageService.updateSettings({ supabaseUrl: url, supabaseKey: key });
    alert('Supabase 연동 정보가 설정되었습니다. 데이터 연동 모드로 재기동합니다.');
    await renderSettings();
  } catch (err) {
    alert(err.message);
    await renderSettings();
  }
}

async function clearSupabaseSettings() {
  if (confirm('Supabase 연동을 해제하고 로컬 단독 모드로 변경하시겠습니까?')) {
    try {
      showLoading();
      await window.StorageService.updateSettings({ supabaseUrl: '', supabaseKey: '' });
      alert('연동이 해제되었습니다. 로컬 저장소 모드로 자동 구동됩니다.');
      await renderSettings();
    } catch (err) {
      alert(err.message);
      await renderSettings();
    }
  }
}

// 로컬 -> Supabase DB로 기존 데이터 밀어넣기
async function migrateLocalData() {
  if (confirm('기존 브라우저 로컬 저장소에 기입된 데이터 전체를 Supabase DB로 백업(이전)하시겠습니까? (DB 내 중복 id 항목은 덮어씁니다.)')) {
    try {
      showLoading();
      const res = await window.StorageService.migrateLocalToSupabase();
      alert(`데이터 이전 성공!\n- 결제수단: ${res.paymentMethods}건\n- 카테고리: ${res.categories}건\n- 고정지출 원본: ${res.fixedExpenses}건\n- 지출: ${res.expenses.toLocaleString()}원 상당\n- 수입: ${res.incomes.toLocaleString()}원 상당이 Supabase DB로 업로드되었습니다.`);
      await renderSettings();
    } catch (err) {
      alert(err.message);
      await renderSettings();
    }
  }
}

async function handleCategoryAdd(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-category-name');
  try {
    showLoading();
    await window.StorageService.addCategory(nameInput.value);
    nameInput.value = '';
    await renderSettings();
  } catch (err) {
    alert(err.message);
    await renderSettings();
  }
}

async function deleteCategoryItem(id) {
  if (confirm('삭제하시겠습니까?')) {
    try {
      showLoading();
      await window.StorageService.deleteCategory(id);
      await renderSettings();
    } catch (err) {
      alert(err.message);
      await renderSettings();
    }
  }
}

async function handlePaymentMethodAdd(event) {
  event.preventDefault();
  const pmInput = document.getElementById('new-pm-name');
  try {
    showLoading();
    await window.StorageService.addPaymentMethod(pmInput.value);
    pmInput.value = '';
    await renderSettings();
  } catch (err) {
    alert(err.message);
    await renderSettings();
  }
}

async function deletePaymentMethodItem(pm) {
  if (confirm(`'${pm}' 결제 수단을 삭제하시겠습니까?`)) {
    try {
      showLoading();
      await window.StorageService.deletePaymentMethod(pm);
      await renderSettings();
    } catch (err) {
      alert(err.message);
      await renderSettings();
    }
  }
}

async function saveGlobalSettings() {
  const defaultYear = parseInt(document.getElementById('setting-default-year').value);
  try {
    showLoading();
    await window.StorageService.updateSettings({ defaultYear });
    state.selectedYear = defaultYear;
    document.getElementById('global-year-select').value = defaultYear;
    alert('설정이 저장되었습니다.');
    await renderSettings();
  } catch (err) {
    alert(err.message);
    await renderSettings();
  }
}


// =============================================================================
// 6. 엑셀/ODS 파일 자동 업로드 및 스마트 파서 기능 (비동기 최적화)
// =============================================================================

function triggerExcelInput() {
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

function bindDropzoneEvents() {
  const dropzone = document.getElementById('expense-dropzone');
  if (!dropzone) return;

  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  const highlight = () => dropzone.classList.add('dragover');
  const unhighlight = () => dropzone.classList.remove('dragover');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, unhighlight, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      parseExcelFile(files[0]);
    }
  }, false);
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (file) {
    parseExcelFile(file);
    event.target.value = '';
  }
}

function parseExcelDate(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
  const str = String(val).trim();
  const matchFull = str.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (matchFull) {
    return { year: parseInt(matchFull[1]), month: parseInt(matchFull[2]), day: parseInt(matchFull[3]) };
  }
  const matchShort = str.match(/^(\d{1,2})[./-](\d{1,2})/);
  if (matchShort) {
    return { year: state.selectedYear, month: parseInt(matchShort[1]), day: parseInt(matchShort[2]) };
  }
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    return { year: parsedDate.getFullYear(), month: parsedDate.getMonth() + 1, day: parsedDate.getDate() };
  }
  return null;
}

function guessCategory(itemName, categoryName) {
  const name = (itemName || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();
  if (name.includes('보험') || name.includes('손해') || name.includes('화재') || cat.includes('보험')) return '보험';
  if (name.includes('적금') || name.includes('청약') || name.includes('주택') || name.includes('도약') || name.includes('저축') || cat.includes('저축') || cat.includes('금융')) return '저축';
  if (name.includes('가족') || name.includes('용돈') || name.includes('부모님') || name.includes('정수기')) return '가족';
  if (name.includes('월세') || name.includes('관리비') || name.includes('인터넷') || name.includes('가스') || name.includes('전기') || name.includes('수도') || cat.includes('공과금') || cat.includes('임대')) return '집';
  if (name.includes('신한카드') || name.includes('하나카드') || name.includes('현대카드') || name.includes('생활비') || cat.includes('카드')) return '카드';
  if (name.includes('타이어') || name.includes('자동차세') || name.includes('상환') || name.includes('이사') || cat.includes('세금') || cat.includes('부채')) return '기타(비정기)';
  return '개인/기타';
}

async function parseExcelFile(file) {
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const parsedTransactions = [];
      const paymentMethods = await window.StorageService.getPaymentMethods();

      for (const sheetName of workbook.SheetNames) {
        if (sheetName.includes('소비') || sheetName.includes('카드') || sheetName.includes('체크') || sheetName.includes('현금')) {
          
          let guessedMethod = '현금';
          const matchMethod = sheetName.match(/\(([^)]+)\)/);
          if (matchMethod) {
            guessedMethod = matchMethod[1].trim();
          } else {
            guessedMethod = sheetName.replace('소비', '').replace('카드', '').replace('체크', '').trim() || '카드';
          }
          
          if (guessedMethod && !paymentMethods.includes(guessedMethod)) {
            try {
              await window.StorageService.addPaymentMethod(guessedMethod);
              paymentMethods.push(guessedMethod);
            } catch (err) {
              console.warn(err);
            }
          }

          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (rows.length < 2) continue;

          let headerRowIndex = -1;
          let dateColIdx = -1;
          let amountColIdx = -1;
          let nameColIdx = -1;
          let catColIdx = -1;

          const keywords = {
            date: ['거래', '이용일', '일자', '거래일', '이용일자', '날짜'],
            amount: ['금액', '이용금액', '결제금액', '합계', '이용 금액'],
            name: ['가맹점명', '사용처', '가맹점', '이용가맹점', '항목', '내용'],
            category: ['업종', '분류', '구분']
          };

          for (let r = 0; r < Math.min(rows.length, 15); r++) {
            const row = rows[r];
            if (!row || !Array.isArray(row)) continue;

            let matches = 0;
            let tempDateIdx = -1;
            let tempAmtIdx = -1;
            let tempNameIdx = -1;
            let tempCatIdx = -1;

            row.forEach((cell, idx) => {
              if (cell === undefined || cell === null) return;
              const cellStr = String(cell).replace(/\s/g, '');

              if (keywords.date.some(k => cellStr.includes(k))) { tempDateIdx = idx; matches++; }
              else if (keywords.amount.some(k => cellStr.includes(k))) { tempAmtIdx = idx; matches++; }
              else if (keywords.name.some(k => cellStr.includes(k))) { tempNameIdx = idx; matches++; }
              else if (keywords.category.some(k => cellStr.includes(k))) { tempCatIdx = idx; matches++; }
            });

            if (matches >= 2) {
              headerRowIndex = r;
              dateColIdx = tempDateIdx;
              amountColIdx = tempAmtIdx;
              nameColIdx = tempNameIdx;
              catColIdx = tempCatIdx;
              break;
            }
          }

          if (headerRowIndex === -1) {
            headerRowIndex = 1;
            dateColIdx = 0;
            nameColIdx = 2;
            amountColIdx = 3;
            catColIdx = 5;
          }

          for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const rawDate = dateColIdx !== -1 ? row[dateColIdx] : null;
            const rawAmount = amountColIdx !== -1 ? row[amountColIdx] : null;
            const rawName = nameColIdx !== -1 ? row[nameColIdx] : null;
            const rawCat = catColIdx !== -1 ? row[catColIdx] : null;

            if (!rawDate || !rawAmount || !rawName) continue;

            let amountVal = 0;
            if (typeof rawAmount === 'number') {
              amountVal = rawAmount;
            } else {
              amountVal = parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
            }
            if (isNaN(amountVal) || amountVal <= 0) continue;

            const dateObj = parseExcelDate(rawDate);
            if (!dateObj) continue;

            const itemName = String(rawName).trim();
            const originalCat = rawCat ? String(rawCat).trim() : '';
            const finalCat = guessCategory(itemName, originalCat);

            parsedTransactions.push({
              year: dateObj.year,
              month: dateObj.month,
              day: dateObj.day,
              itemName,
              amount: amountVal,
              category: finalCat,
              paymentMethod: guessedMethod,
              memo: originalCat ? `원본분류: ${originalCat}` : '엑셀 업로드',
              checked: true
            });
          }
        }
      }

      if (parsedTransactions.length === 0) {
        alert('엑셀 파일 분석 실패: 카드 소비 내역을 찾지 못했습니다.');
        return;
      }

      state.excelTransactions = parsedTransactions;
      await openExcelPreviewModal();

    } catch (err) {
      console.error(err);
      alert('엑셀 파일 읽기 오류');
    }
  };

  reader.readAsArrayBuffer(file);
}

async function openExcelPreviewModal() {
  document.getElementById('excel-current-year').innerText = state.selectedYear;
  document.getElementById('excel-force-year').checked = state.excelForceYear;

  await updateExcelPreviewTable();
  
  const modal = document.getElementById('excel-modal');
  modal.classList.remove('hidden');
  lucide.createIcons();
}

async function updateExcelPreviewTable() {
  const tbody = document.getElementById('excel-preview-tbody');
  
  const [categories, paymentMethods] = await Promise.all([
    window.StorageService.getCategories(),
    window.StorageService.getPaymentMethods()
  ]);

  tbody.innerHTML = state.excelTransactions.map((t, idx) => {
    const displayYear = state.excelForceYear ? state.selectedYear : t.year;
    const dateStr = `${displayYear}.${String(t.month).padStart(2, '0')}.${String(t.day).padStart(2, '0')}`;

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="text-center">
          <input type="checkbox" class="w-4 h-4 rounded row-excel-check" data-idx="${idx}" ${t.checked ? 'checked' : ''} onchange="toggleExcelRow(${idx}, this.checked)">
        </td>
        <td class="text-center font-semibold text-slate-500">${dateStr}</td>
        <td>
          <input type="text" value="${t.itemName}" class="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none p-1 font-semibold text-slate-700" onchange="updateExcelRowField(${idx}, 'itemName', this.value)">
        </td>
        <td class="amount-cell font-bold text-slate-800">
          <input type="number" value="${t.amount}" class="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none p-1 text-right font-bold" onchange="updateExcelRowField(${idx}, 'amount', this.value)">
        </td>
        <td>
          <select class="w-full bg-white border border-slate-200 rounded p-1 text-xs focus:outline-none" onchange="updateExcelRowField(${idx}, 'category', this.value)">
            ${categories.map(c => `<option value="${c.name}" ${t.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="w-full bg-white border border-slate-200 rounded p-1 text-xs focus:outline-none" onchange="updateExcelRowField(${idx}, 'paymentMethod', this.value)">
            ${paymentMethods.map(pm => `<option value="${pm}" ${t.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="text" value="${t.memo}" class="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none p-1 text-slate-500 text-xs" onchange="updateExcelRowField(${idx}, 'memo', this.value)">
        </td>
      </tr>
    `;
  }).join('');

  updateExcelPreviewCount();
}

function updateExcelPreviewCount() {
  const total = state.excelTransactions.length;
  const checked = state.excelTransactions.filter(t => t.checked).length;
  
  document.getElementById('excel-total-count').innerText = total;
  document.getElementById('excel-checked-count').innerText = checked;
  document.getElementById('excel-select-all').checked = total === checked && total > 0;
}

function toggleExcelRow(idx, checked) {
  state.excelTransactions[idx].checked = !!checked;
  updateExcelPreviewCount();
}

function updateExcelRowField(idx, field, val) {
  if (field === 'amount') {
    state.excelTransactions[idx][field] = parseFloat(val) || 0;
  } else {
    state.excelTransactions[idx][field] = val;
  }
}

function toggleExcelSelectAll(checked) {
  state.excelTransactions.forEach(t => t.checked = !!checked);
  const checkboxes = document.querySelectorAll('.row-excel-check');
  checkboxes.forEach(cb => cb.checked = !!checked);
  updateExcelPreviewCount();
}

async function toggleExcelForceYear(checked) {
  state.excelForceYear = !!checked;
  await updateExcelPreviewTable();
}

function closeExcelModal() {
  document.getElementById('excel-modal').classList.add('hidden');
}

async function saveExcelTransactions() {
  const toSave = state.excelTransactions.filter(t => t.checked);
  if (toSave.length === 0) {
    alert('등록할 항목이 없습니다.');
    return;
  }

  try {
    showLoading();
    let savedCount = 0;
    for (const t of toSave) {
      const finalYear = state.excelForceYear ? state.selectedYear : t.year;
      await window.StorageService.addExpense({
        year: finalYear,
        month: t.month,
        category: t.category,
        itemName: t.itemName,
        amount: t.amount,
        paymentMethod: t.paymentMethod,
        paymentDay: `${t.day}일`,
        isFixed: false,
        memo: t.memo
      });
      savedCount++;
    }

    closeExcelModal();
    alert(`총 ${savedCount}건의 지출 내역이 등록되었습니다.`);
    await renderExpenses();
  } catch (err) {
    alert(err.message);
    await renderExpenses();
  }
}
