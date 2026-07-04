/**
 * 가계부 MVP 애플리케이션 상태 및 화면 렌더링 로직 (app.js)
 * 모든 UI 요소와 이벤트 바인딩이 들어있으며 초보자도 이해할 수 있도록 쉽게 작성되었습니다.
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

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
  // 1. 기준 연도 세팅
  const settings = window.StorageService.getSettings();
  state.selectedYear = settings.defaultYear || 2026;
  
  const yearSelect = document.getElementById('global-year-select');
  if (yearSelect) {
    yearSelect.value = state.selectedYear;
  }

  // 2. 초기 탭 렌더링
  switchTab(state.currentTab);
  
  // 3. Lucide 아이콘 초기화
  lucide.createIcons();
});

// 전역 연도 변경 핸들러
function changeGlobalYear(year) {
  state.selectedYear = parseInt(year);
  switchTab(state.currentTab); // 현재 탭을 다시 그림
}

// 탭 전환 핸들러
function switchTab(tabId) {
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

  // 콘텐츠 렌더링 분기
  switch (tabId) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'expenses':
      renderExpenses();
      break;
    case 'income':
      renderIncome();
      break;
    case 'yearly':
      renderYearlyTable();
      break;
    case 'settings':
      renderSettings();
      break;
  }
  
  // 아이콘 업데이트
  lucide.createIcons();
}

// ----------------------------------------------------
// 1. 대시보드 탭 (Dashboard)
// ----------------------------------------------------
function renderDashboard() {
  const container = document.getElementById('tab-content');
  
  // 데이터 연산
  const expenses = window.StorageService.getExpenses().filter(e => e.year === state.selectedYear);
  const incomes = window.StorageService.getIncomes().filter(i => i.year === state.selectedYear);
  
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
      <!-- 이번달 수입 카드 -->
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
      
      <!-- 이번달 지출 카드 -->
      <div class="glass-card rounded-2xl p-6 hover-lift">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">${state.selectedMonth}월 총 지출</p>
            <h3 class="text-2xl font-bold text-slate-800 mt-2">${formatWon(totalMonthExpense)}</h3>
          </div>
          <div class="bg-indigo-100 text-indigo-600 p-3 rounded-xl"><i data-lucide="credit-card" class="w-6 h-6"></i></div>
        </div>
        <p class="text-xs text-slate-500 mt-4">해당 월에 입력된 모든 지출의 합산입니다.</p>
      </div>

      <!-- 이번달 잔액 카드 -->
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

    <!-- 연간 요약 카드 -->
    <div class="glass-card rounded-2xl p-6">
      <h4 class="text-sm font-bold text-slate-500 mb-4">${state.selectedYear}년 연간 누적 요약</h4>
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
      <!-- 월별 추이 차트 -->
      <div class="glass-card rounded-2xl p-6 lg:col-span-2">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-sm font-bold text-slate-600">월별 지출 및 수입 추이</h4>
          <span class="text-xs text-slate-400">1월 ~ 12월</span>
        </div>
        <div class="relative h-64">
          <canvas id="trendChart"></canvas>
        </div>
      </div>
      
      <!-- 분류별 지출 비중 차트 -->
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

  // 차트 그리기
  drawTrendChart(incomes, expenses);
  drawCategoryChart(thisMonthExpenses);
  
  lucide.createIcons();
}

function changeDashboardMonth(m) {
  state.selectedMonth = m;
  renderDashboard();
}

// 1-1. 대시보드 차트 그리기: 월별 추이
function drawTrendChart(incomes, expenses) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  
  // 1월부터 12월까지 데이터 집계
  const monthlyIncomes = Array(12).fill(0);
  const monthlyExpenses = Array(12).fill(0);
  
  incomes.forEach(i => {
    if (i.month >= 1 && i.month <= 12) {
      monthlyIncomes[i.month - 1] += i.amount;
    }
  });
  
  expenses.forEach(e => {
    if (e.month >= 1 && e.month <= 12) {
      monthlyExpenses[e.month - 1] += e.amount;
    }
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
        x: {
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
}

// 1-2. 대시보드 차트 그리기: 카테고리별 비중
function drawCategoryChart(monthExpenses) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  
  // 카테고리별 합계 산출
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
    // 데이터 없음 안내 그리기
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

  // 감각적인 파스텔/비비드 톤 색상 세트
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
// 2. 지출 관리 탭 (Expenses)
// ----------------------------------------------------
function renderExpenses() {
  const container = document.getElementById('tab-content');
  const categories = window.StorageService.getCategories();
  const paymentMethods = window.StorageService.getPaymentMethods();
  
  // 전체 지출 가져온 뒤 연/월 필터링 및 카테고리/결제수단 필터링
  let expenses = window.StorageService.getExpenses()
    .filter(e => e.year === state.selectedYear && e.month === state.selectedMonth);
    
  if (state.expenseFilter.category !== 'all') {
    expenses = expenses.filter(e => e.category === state.expenseFilter.category);
  }
  if (state.expenseFilter.paymentMethod !== 'all') {
    expenses = expenses.filter(e => e.paymentMethod === state.expenseFilter.paymentMethod);
  }
  
  // 최근 등록 역순 정렬
  expenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- 지출 입력 폼 카드 -->
      <div class="glass-card rounded-2xl p-6 h-fit">
        <h3 class="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-5 h-5 text-indigo-500"></i>
          지출 항목 등록 (${state.selectedYear}년 ${state.selectedMonth}월)
        </h3>
        
        <form id="expense-add-form" class="space-y-4" onsubmit="handleExpenseAdd(event)">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">분류</label>
            <select id="add-expense-category" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" required>
              <option value="">-- 분류 선택 --</option>
              ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">항목명</label>
            <input type="text" id="add-expense-name" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="예: 메리츠 보험" required>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">금액(원)</label>
            <input type="number" id="add-expense-amount" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="숫자만 입력" required>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">지출일</label>
              <input type="text" id="add-expense-day" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="예: 5일, 만기">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">결제수단</label>
              <select id="add-expense-method" class="w-full px-3 py-2 border rounded-lg text-sm input-premium">
                ${paymentMethods.map(pm => `<option value="${pm}">${pm}</option>`).join('')}
              </select>
            </div>
          </div>
          
          <div class="flex items-center space-x-2 pt-2">
            <input type="checkbox" id="add-expense-fixed" class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500">
            <label for="add-expense-fixed" class="text-xs font-bold text-slate-600">매월 반복되는 고정지출입니다.</label>
          </div>
          
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">메모</label>
            <textarea id="add-expense-memo" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="세부 특징 기술"></textarea>
          </div>
          
          <button type="submit" class="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-semibold rounded-lg shadow-lg transition">
            지출 추가하기
          </button>
        </form>
      </div>

      <!-- 지출 목록 리스트 -->
      <div class="glass-card rounded-2xl p-6 lg:col-span-2 flex flex-col">
        <!-- 필터 및 제어 영역 -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <div class="flex items-center space-x-3">
            <h3 class="text-base font-bold text-slate-700">지출 목록</h3>
            <span class="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded-full font-bold">총 ${expenses.length}건</span>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <!-- 이전 달 값 복사 버튼 -->
            <button onclick="copyPreviousMonthFixed()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i> 이전 달 고정값 복사
            </button>
            
            <!-- 월 필터 선택기 -->
            <select id="expense-month-filter" class="bg-slate-100 border-none rounded-lg text-xs font-bold py-1.5 px-2 text-slate-600 focus:outline-none" onchange="changeExpenseFilterMonth(this.value)">
              ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
                <option value="${m}" ${state.selectedMonth === m ? 'selected' : ''}>${m}월 지출</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- 엑셀 파일 드롭존 -->
        <div id="expense-dropzone" class="excel-dropzone rounded-xl p-5 mb-4 text-center cursor-pointer hover:border-indigo-400 transition">
          <div class="flex flex-col items-center space-y-1 text-slate-500">
            <i data-lucide="upload-cloud" class="w-8 h-8 text-indigo-500"></i>
            <p class="text-xs font-bold">카드 소비 내역 엑셀/ODS 파일 드래그 또는 클릭 업로드</p>
            <p class="text-[10px] text-slate-400 font-medium">제공해주신 엑셀 내 '소비(리카드)', '소비(하나카드)' 등 탭의 내역을 자동 파싱합니다.</p>
          </div>
          <input type="file" id="excel-file-input" class="hidden" accept=".xlsx, .xls, .ods" onchange="handleExcelUpload(event)">
        </div>

        <!-- 필터 상세 조건 -->
        <div class="grid grid-cols-2 gap-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 mb-1">분류 필터</label>
            <select class="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none" onchange="filterExpenses('category', this.value)">
              <option value="all">전체 분류</option>
              ${categories.map(c => `<option value="${c.name}" ${state.expenseFilter.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 mb-1">결제수단 필터</label>
            <select class="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none" onchange="filterExpenses('paymentMethod', this.value)">
              <option value="all">전체 결제수단</option>
              ${paymentMethods.map(pm => `<option value="${pm}" ${state.expenseFilter.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- 스크롤 가능 리스트 -->
        <div class="overflow-y-auto max-h-[500px] flex-grow pr-1 space-y-3">
          ${expenses.length === 0 ? `
            <div class="text-center py-20 text-slate-400">
              <i data-lucide="info" class="w-10 h-10 mx-auto mb-3 text-slate-300"></i>
              <p class="text-sm font-semibold">입력되거나 조건에 맞는 지출 내역이 없습니다.</p>
              <p class="text-xs text-slate-400 mt-1">좌측 폼으로 입력하시거나 이전 달 데이터를 복사해 보세요.</p>
            </div>
          ` : expenses.map(e => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl hover:shadow-sm transition">
              <div class="flex items-start space-x-3.5">
                <span class="mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded ${e.isFixed ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}">
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
                    ${e.memo ? `<span>•</span> <span class="text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">${e.memo}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="flex items-center space-x-4">
                <span class="text-sm font-bold text-slate-800 amount-cell">${formatWon(e.amount)}</span>
                <div class="flex space-x-1">
                  <button onclick="openExpenseEdit('${e.id}')" class="p-1 hover:text-indigo-600 text-slate-400 transition" title="수정">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                  </button>
                  <button onclick="deleteExpenseItem('${e.id}')" class="p-1 hover:text-red-500 text-slate-400 transition" title="삭제">
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

function changeExpenseFilterMonth(val) {
  state.selectedMonth = parseInt(val);
  renderExpenses();
}

function filterExpenses(key, val) {
  state.expenseFilter[key] = val;
  renderExpenses();
}

// 2-1. 지출 추가 비즈니스 로직
function handleExpenseAdd(event) {
  event.preventDefault();
  
  const category = document.getElementById('add-expense-category').value;
  const name = document.getElementById('add-expense-name').value;
  const amount = document.getElementById('add-expense-amount').value;
  const day = document.getElementById('add-expense-day').value;
  const method = document.getElementById('add-expense-method').value;
  const isFixed = document.getElementById('add-expense-fixed').checked;
  const memo = document.getElementById('add-expense-memo').value;

  try {
    window.StorageService.addExpense({
      year: state.selectedYear,
      month: state.selectedMonth,
      category: category,
      itemName: name,
      amount: amount,
      paymentMethod: method,
      paymentDay: day,
      isFixed: isFixed,
      memo: memo
    });
    
    // 성공 시 재렌더링 및 폼 초기화
    renderExpenses();
    document.getElementById('expense-add-form').reset();
  } catch (err) {
    alert(err.message);
  }
}

// 2-2. 지출 삭제
function deleteExpenseItem(id) {
  if (confirm('이 지출 항목을 삭제하시겠습니까?')) {
    try {
      window.StorageService.deleteExpense(id);
      renderExpenses();
    } catch (err) {
      alert(err.message);
    }
  }
}

// 2-3. 이전 달 값 복사 (고정 지출만 대상)
function copyPreviousMonthFixed() {
  let prevYear = state.selectedYear;
  let prevMonth = state.selectedMonth - 1;
  if (prevMonth === 0) {
    prevYear = state.selectedYear - 1;
    prevMonth = 12;
  }

  // 1. 이전 달 고정지출 항목 조회
  const allExpenses = window.StorageService.getExpenses();
  const prevFixedExpenses = allExpenses.filter(e => e.year === prevYear && e.month === prevMonth && e.isFixed);
  
  if (prevFixedExpenses.length === 0) {
    alert(`${prevYear}년 ${prevMonth}월에 등록된 고정지출 항목이 없습니다.`);
    return;
  }

  // 2. 현재 달의 지출 조회
  const currExpenses = allExpenses.filter(e => e.year === state.selectedYear && e.month === state.selectedMonth);
  
  let copiedCount = 0;
  prevFixedExpenses.forEach(prevExp => {
    // 이미 동일 항목명이 현재 달에 존재하는지 검사
    const exists = currExpenses.some(curr => curr.itemName === prevExp.itemName && curr.category === prevExp.category);
    if (!exists) {
      window.StorageService.addExpense({
        year: state.selectedYear,
        month: state.selectedMonth,
        category: prevExp.category,
        itemName: prevExp.itemName,
        amount: prevExp.amount,
        paymentMethod: prevExp.paymentMethod,
        paymentDay: prevExp.paymentDay,
        isFixed: true,
        memo: '이전 달 고정지출 복사'
      });
      copiedCount++;
    }
  });

  if (copiedCount > 0) {
    alert(`${copiedCount}개의 고정 지출 항목을 ${state.selectedMonth}월로 복사해 왔습니다.`);
    renderExpenses();
  } else {
    alert('이미 모든 고정 지출 항목이 이번 달에 등록되어 있습니다.');
  }
}

// 2-4. 지출 수정 모달 팝업 제어
function openExpenseEdit(id) {
  const expenses = window.StorageService.getExpenses();
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

  // 카테고리 옵션 채우기
  const catSelect = document.getElementById('edit-expense-category');
  const categories = window.StorageService.getCategories();
  catSelect.innerHTML = categories.map(c => `<option value="${c.name}" ${exp.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

  // 결제 수단 채우기
  const pmSelect = document.getElementById('edit-expense-method');
  const methods = window.StorageService.getPaymentMethods();
  pmSelect.innerHTML = methods.map(pm => `<option value="${pm}" ${exp.paymentMethod === pm ? 'selected' : ''}>${pm}</option>`).join('');

  const modal = document.getElementById('expense-modal');
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

function handleExpenseUpdate(event) {
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
    window.StorageService.updateExpense(id, {
      year, month, category, itemName: name, amount, paymentDay: day, paymentMethod: method, isFixed, memo
    });
    closeExpenseModal();
    renderExpenses();
  } catch (err) {
    alert(err.message);
  }
}


// ----------------------------------------------------
// 3. 수입 관리 탭 (Income)
// ----------------------------------------------------
function renderIncome() {
  const container = document.getElementById('tab-content');
  
  // 수입 필터 및 정렬
  const incomes = window.StorageService.getIncomes()
    .filter(i => i.year === state.selectedYear && i.month === state.selectedMonth)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = `
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
            <textarea id="add-income-memo" rows="3" class="w-full px-3 py-2 border rounded-lg text-sm input-premium" placeholder="특징 사항 기입 (예: 연차 8.5개 포함 등)"></textarea>
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
            <span class="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-bold">총 ${incomes.length}건</span>
          </div>
          
          <select class="bg-slate-100 border-none rounded-lg text-xs font-bold py-1.5 px-2 text-slate-600 focus:outline-none" onchange="changeIncomeMonth(this.value)">
            ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
              <option value="${m}" ${state.selectedMonth === m ? 'selected' : ''}>${m}월 수입</option>
            `).join('')}
          </select>
        </div>

        <div class="overflow-y-auto max-h-[500px] flex-grow pr-1 space-y-3">
          ${incomes.length === 0 ? `
            <div class="text-center py-20 text-slate-400">
              <i data-lucide="info" class="w-10 h-10 mx-auto mb-3 text-slate-300"></i>
              <p class="text-sm font-semibold">이번 달 수입 내역이 없습니다.</p>
              <p class="text-xs text-slate-400 mt-1">좌측 수입 등록 폼을 통해 수입 정보를 기입해 주세요.</p>
            </div>
          ` : incomes.map(i => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl hover:shadow-sm transition">
              <div>
                <span class="text-sm font-bold text-slate-700">${i.incomeName}</span>
                ${i.memo ? `<span class="ml-2 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded font-medium">${i.memo}</span>` : ''}
                <span class="block text-[10px] text-slate-400 mt-1 font-medium">등록일: ${new Date(i.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="flex items-center space-x-4">
                <span class="text-sm font-bold text-slate-800 amount-cell">${formatWon(i.amount)}</span>
                <div class="flex space-x-1">
                  <button onclick="openIncomeEdit('${i.id}')" class="p-1 hover:text-emerald-600 text-slate-400 transition" title="수정">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                  </button>
                  <button onclick="deleteIncomeItem('${i.id}')" class="p-1 hover:text-red-500 text-slate-400 transition" title="삭제">
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

function changeIncomeMonth(m) {
  state.selectedMonth = parseInt(m);
  renderIncome();
}

function handleIncomeAdd(event) {
  event.preventDefault();
  const name = document.getElementById('add-income-name').value;
  const amount = document.getElementById('add-income-amount').value;
  const memo = document.getElementById('add-income-memo').value;

  try {
    window.StorageService.addIncome({
      year: state.selectedYear,
      month: state.selectedMonth,
      incomeName: name,
      amount: amount,
      memo: memo
    });
    renderIncome();
    document.getElementById('income-add-form').reset();
  } catch (err) {
    alert(err.message);
  }
}

function deleteIncomeItem(id) {
  if (confirm('이 수입 항목을 삭제하시겠습니까?')) {
    try {
      window.StorageService.deleteIncome(id);
      renderIncome();
    } catch (err) {
      alert(err.message);
    }
  }
}

function openIncomeEdit(id) {
  const incomes = window.StorageService.getIncomes();
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

function handleIncomeUpdate(event) {
  event.preventDefault();
  const id = document.getElementById('edit-income-id').value;
  const year = document.getElementById('edit-income-year').value;
  const month = document.getElementById('edit-income-month').value;
  const name = document.getElementById('edit-income-name').value;
  const amount = document.getElementById('edit-income-amount').value;
  const memo = document.getElementById('edit-income-memo').value;

  try {
    window.StorageService.updateIncome(id, { year, month, incomeName: name, amount, memo });
    closeIncomeModal();
    renderIncome();
  } catch (err) {
    alert(err.message);
  }
}


// ----------------------------------------------------
// 4. 연간 표 (Yearly Table) — 기존 엑셀 뷰 재현
// ----------------------------------------------------
function renderYearlyTable() {
  const container = document.getElementById('tab-content');
  
  // 데이터 불러오기
  const categories = window.StorageService.getCategories();
  const expenses = window.StorageService.getExpenses().filter(e => e.year === state.selectedYear);
  const incomes = window.StorageService.getIncomes().filter(i => i.year === state.selectedYear);
  
  // 1. 지출 항목들의 유니크 키 맵핑 (카테고리 + 항목명 기준)
  // 기존 엑셀 시트처럼 "분류" -> "항목명" 별로 월별 금액이 매핑되는 2차원 표 구축
  const rowMap = {}; 
  expenses.forEach(e => {
    const key = `${e.category}__${e.itemName}`;
    if (!rowMap[key]) {
      rowMap[key] = {
        category: e.category,
        itemName: e.itemName,
        months: Array(12).fill(0),
        paymentDay: e.paymentDay || '' // 가장 최근에 입력되었거나 첫 지출일로 기본 노출
      };
    }
    rowMap[key].months[e.month - 1] += e.amount;
    // 지출일 최신화 유지
    if (e.paymentDay) {
      rowMap[key].paymentDay = e.paymentDay;
    }
  });

  // 카테고리 순서대로 행 정렬
  const rowList = Object.values(rowMap).sort((a, b) => {
    const orderA = categories.find(c => c.name === a.category)?.sortOrder || 99;
    const orderB = categories.find(c => c.name === b.category)?.sortOrder || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.itemName.localeCompare(b.itemName);
  });

  // 월별 수입/지출 총계 연산
  const monthlyTotalExpense = Array(12).fill(0);
  const monthlyTotalIncome = Array(12).fill(0);

  // 각 지출 항목 루프돌며 월별 합 계산
  rowList.forEach(row => {
    for (let m = 0; m < 12; m++) {
      monthlyTotalExpense[m] += row.months[m];
    }
  });

  // 수입 루프
  incomes.forEach(i => {
    if (i.month >= 1 && i.month <= 12) {
      monthlyTotalIncome[i.month - 1] += i.amount;
    }
  });

  // 월별 순잔액
  const monthlyBalance = Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    monthlyBalance[m] = monthlyTotalIncome[m] - monthlyTotalExpense[m];
  }

  // 전체 합계 계산
  const grandTotalExpense = monthlyTotalExpense.reduce((sum, val) => sum + val, 0);
  const grandTotalIncome = monthlyTotalIncome.reduce((sum, val) => sum + val, 0);
  const grandTotalBalance = grandTotalIncome - grandTotalExpense;

  container.innerHTML = `
    <div class="glass-card rounded-2xl p-6">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
        <div>
          <h3 class="text-base font-bold text-slate-700 flex items-center gap-2">
            <i data-lucide="table" class="w-5 h-5 text-indigo-500"></i>
            ${state.selectedYear}년 연간 가계부 그리드 뷰
          </h3>
          <p class="text-xs text-slate-400 mt-1">엑셀 형태의 일괄 조회 표입니다. 1~12월 지출 추이와 누적 요약을 한눈에 봅니다.</p>
        </div>
        <div class="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <span class="inline-block w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></span> <span>0원/미지출</span>
          <span class="inline-block w-3 h-3 rounded-full bg-indigo-50/50 border border-indigo-200"></span> <span>지출 발생</span>
        </div>
      </div>

      <!-- 반응형 가로 스크롤 테이블 컨테이너 -->
      <div class="yearly-grid-container">
        <table class="yearly-table">
          <thead>
            <tr class="bg-slate-50 font-bold text-slate-600 text-xs">
              <th class="sticky-col text-left">분류</th>
              <th class="sticky-col text-left">지출 항목명</th>
              <th class="text-center">지출일</th>
              ${Array.from({length: 12}, (_, i) => `<th class="text-center">${i + 1}월</th>`).join('')}
              <th class="text-right">연간 합계</th>
            </tr>
          </thead>
          <tbody class="text-xs text-slate-700">
            ${rowList.length === 0 ? `
              <tr>
                <td colspan="16" class="text-center py-20 text-slate-400">
                  <i data-lucide="info" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
                  등록된 연간 지출 내역이 없습니다.
                </td>
              </tr>
            ` : rowList.map((row, idx) => {
              const rowSum = row.months.reduce((sum, val) => sum + val, 0);
              return `
                <tr class="hover:bg-slate-50/50 transition">
                  <td class="sticky-col font-bold text-indigo-600 bg-slate-50/30">${row.category}</td>
                  <td class="sticky-col font-semibold text-slate-700 bg-slate-50/30">${row.itemName}</td>
                  <td class="text-center text-slate-400 font-medium">${row.paymentDay || '-'}</td>
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
            
            <!-- 하단 요약 행 (엑셀 스타일 총합, 수입, 잔액 행) -->
            <!-- 1. 총 지출 합계 -->
            <tr class="summary-row text-slate-700">
              <td class="sticky-col font-bold" colspan="2">총 지출 (A)</td>
              <td class="text-center">-</td>
              ${monthlyTotalExpense.map(sum => `
                <td class="amount-cell font-bold" style="text-align: right;">${sum > 0 ? sum.toLocaleString() : '-'}</td>
              `).join('')}
              <td class="amount-cell font-bold text-indigo-600" style="text-align: right;">${grandTotalExpense.toLocaleString()}</td>
            </tr>

            <!-- 2. 총 수입 합계 -->
            <tr class="summary-row text-slate-700">
              <td class="sticky-col font-bold" colspan="2">총 수입 (B)</td>
              <td class="text-center">-</td>
              ${monthlyTotalIncome.map(sum => `
                <td class="amount-cell font-bold text-emerald-600" style="text-align: right;">${sum > 0 ? sum.toLocaleString() : '-'}</td>
              `).join('')}
              <td class="amount-cell font-bold text-emerald-600" style="text-align: right;">${grandTotalIncome.toLocaleString()}</td>
            </tr>

            <!-- 3. 순 잔액 (B - A) -->
            <tr class="summary-row text-slate-800">
              <td class="sticky-col font-bold" colspan="2">순 잔액 (B - A)</td>
              <td class="text-center">-</td>
              ${monthlyBalance.map(bal => {
                const isNeg = bal < 0;
                return `
                  <td class="amount-cell font-bold ${isNeg ? 'negative-amount' : 'positive-amount'}" style="text-align: right;">
                    ${bal !== 0 ? (isNeg ? '-' : '') + Math.abs(bal).toLocaleString() : '-'}
                  </td>
                `;
              }).join('')}
              <td class="amount-cell font-bold ${grandTotalBalance < 0 ? 'negative-amount' : 'positive-amount'}" style="text-align: right;">
                ${grandTotalBalance < 0 ? '-' : ''}${Math.abs(grandTotalBalance).toLocaleString()}
              </td>
            </tr>
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
function renderSettings() {
  const container = document.getElementById('tab-content');
  const categories = window.StorageService.getCategories();
  const paymentMethods = window.StorageService.getPaymentMethods();
  const settings = window.StorageService.getSettings();

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
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
              <button onclick="deleteCategoryItem('${c.id}')" class="p-1 hover:text-red-500 text-slate-400 transition" title="삭제">
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
          <input type="text" id="new-pm-name" class="flex-grow px-3 py-1.5 border rounded-lg text-sm input-premium" placeholder="새 결제수단 입력 (예: 네이버페이)" required>
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg text-sm shadow-md transition">추가</button>
        </form>

        <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          ${paymentMethods.map(pm => `
            <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/50 rounded-lg">
              <span class="text-sm font-semibold text-slate-600">${pm}</span>
              <button onclick="deletePaymentMethodItem('${pm}')" class="p-1 hover:text-red-500 text-slate-400 transition" title="삭제">
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
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">앱 기동 시 기본 연도</label>
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

// 5-1. 카테고리 추가
function handleCategoryAdd(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-category-name');
  try {
    window.StorageService.addCategory(nameInput.value);
    nameInput.value = '';
    renderSettings();
  } catch (err) {
    alert(err.message);
  }
}

// 5-2. 카테고리 삭제
function deleteCategoryItem(id) {
  if (confirm('이 분류를 삭제하시겠습니까? (기존 지출 내역은 삭제되지 않으나 필터링 등이 변경될 수 있습니다.)')) {
    try {
      window.StorageService.deleteCategory(id);
      renderSettings();
    } catch (err) {
      alert(err.message);
    }
  }
}

// 5-3. 결제수단 추가
function handlePaymentMethodAdd(event) {
  event.preventDefault();
  const pmInput = document.getElementById('new-pm-name');
  try {
    window.StorageService.addPaymentMethod(pmInput.value);
    pmInput.value = '';
    renderSettings();
  } catch (err) {
    alert(err.message);
  }
}

// 5-4. 결제수단 삭제
function deletePaymentMethodItem(pm) {
  if (confirm(`'${pm}' 결제 수단을 삭제하시겠습니까?`)) {
    try {
      window.StorageService.deletePaymentMethod(pm);
      renderSettings();
    } catch (err) {
      alert(err.message);
    }
  }
}

// 5-5. 글로벌 설정 저장
function saveGlobalSettings() {
  const defaultYear = parseInt(document.getElementById('setting-default-year').value);
  try {
    window.StorageService.updateSettings({ defaultYear });
    state.selectedYear = defaultYear;
    document.getElementById('global-year-select').value = defaultYear;
    alert('설정이 저장되었습니다.');
    renderSettings();
  } catch (err) {
    alert(err.message);
  }
}

// =============================================================================
// 6. 엑셀/ODS 파일 자동 업로드 및 스마트 파서 기능
// =============================================================================

// 파일 인풋 트리거
function triggerExcelInput() {
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

// 드롭존 드래그 앤 드롭 이벤트 바인딩
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

// 파일 선택 인풋 핸들러
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (file) {
    parseExcelFile(file);
    // 동일 파일 재등록 가능하게 인풋 클리어
    event.target.value = '';
  }
}

// 엑셀 날짜 파싱 유틸 함수 (여러 타입에 강건 대응)
function parseExcelDate(val) {
  if (val === undefined || val === null) return null;

  // 1. 엑셀 시리얼 넘버인 경우
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }

  // 2. 문자열 날짜인 경우
  const str = String(val).trim();
  
  // YYYY.MM.DD HH:MM 또는 YYYY-MM-DD 등 정규식 매치
  const matchFull = str.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (matchFull) {
    return {
      year: parseInt(matchFull[1]),
      month: parseInt(matchFull[2]),
      day: parseInt(matchFull[3])
    };
  }

  // MM.DD 또는 MM-DD 처럼 월/일만 있는 경우
  const matchShort = str.match(/^(\d{1,2})[./-](\d{1,2})/);
  if (matchShort) {
    return {
      year: state.selectedYear, // 기동 중인 기준연도로 기본 보정
      month: parseInt(matchShort[1]),
      day: parseInt(matchShort[2])
    };
  }

  // 기본 Date.parse 작동
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    return {
      year: parsedDate.getFullYear(),
      month: parsedDate.getMonth() + 1,
      day: parsedDate.getDate()
    };
  }

  return null;
}

// 카테고리 매핑 룰 (업종/사용처 기반 스마트 유추)
function guessCategory(itemName, categoryName) {
  const name = (itemName || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();

  // 1. 보험 키워드
  if (name.includes('보험') || name.includes('손해') || name.includes('화재') || cat.includes('보험')) {
    return '보험';
  }
  // 2. 저축
  if (name.includes('적금') || name.includes('청약') || name.includes('주택') || name.includes('도약') || name.includes('저축') || cat.includes('저축') || cat.includes('금융')) {
    return '저축';
  }
  // 3. 가족
  if (name.includes('가족') || name.includes('용돈') || name.includes('부모님') || name.includes('정수기')) {
    return '가족';
  }
  // 4. 집
  if (name.includes('월세') || name.includes('관리비') || name.includes('인터넷') || name.includes('가스') || name.includes('전기') || name.includes('수도') || cat.includes('공과금') || cat.includes('임대')) {
    return '집';
  }
  // 5. 카드
  if (name.includes('신한카드') || name.includes('하나카드') || name.includes('현대카드') || name.includes('생활비') || cat.includes('카드')) {
    return '카드';
  }
  // 6. 비정기 큰 지출
  if (name.includes('타이어') || name.includes('자동차세') || name.includes('상환') || name.includes('이사') || cat.includes('세금') || cat.includes('부채')) {
    return '기타(비정기)';
  }

  // 기본값
  return '개인/기타';
}

// 시트JS 기반 스마트 파서 엔진
function parseExcelFile(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const parsedTransactions = [];
      const paymentMethods = window.StorageService.getPaymentMethods();

      // 시트 순회
      workbook.SheetNames.forEach(sheetName => {
        // '소비', '카드', '체크', '현금' 탭 중 하나에 매칭되는 경우만 분석 대상으로 포함
        if (sheetName.includes('소비') || sheetName.includes('카드') || sheetName.includes('체크') || sheetName.includes('현금')) {
          
          // 결제수단 유추: 시트 이름 괄호 속 문자(예: '소비(리카드)' -> '리카드') 추출
          let guessedMethod = '현금';
          const matchMethod = sheetName.match(/\(([^)]+)\)/);
          if (matchMethod) {
            guessedMethod = matchMethod[1].trim();
          } else {
            guessedMethod = sheetName.replace('소비', '').replace('카드', '').replace('체크', '').trim() || '카드';
          }
          
          // 해당 결제수단이 시스템에 없다면 자동 등록
          if (guessedMethod && !paymentMethods.includes(guessedMethod)) {
            try {
              window.StorageService.addPaymentMethod(guessedMethod);
              paymentMethods.push(guessedMethod);
            } catch (err) {
              console.warn('결제 수단 자동등록 실패:', err);
            }
          }

          const worksheet = workbook.Sheets[sheetName];
          // 2차원 배열 형태로 데이터를 읽음
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (rows.length < 2) return;

          // 1. 헤더 열 탐색
          let headerRowIndex = -1;
          let dateColIdx = -1;
          let amountColIdx = -1;
          let nameColIdx = -1;
          let catColIdx = -1;

          // 헤더 키워드 세트 정의
          const keywords = {
            date: ['거래', '이용일', '일자', '거래일', '이용일자', '날짜'],
            amount: ['금액', '이용금액', '결제금액', '합계', '이용 금액'],
            name: ['가맹점명', '사용처', '가맹점', '이용가맹점', '항목', '내용'],
            category: ['업종', '분류', '구분']
          };

          // 상위 15개 행을 탐색하며 헤더 유력 행 검색
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
              const cellStr = String(cell).replace(/\s/g, ''); // 공백 제거

              // 날짜 열 감지
              if (keywords.date.some(k => cellStr.includes(k))) {
                tempDateIdx = idx;
                matches++;
              }
              // 금액 열 감지
              else if (keywords.amount.some(k => cellStr.includes(k))) {
                tempAmtIdx = idx;
                matches++;
              }
              // 가맹점명 열 감지
              else if (keywords.name.some(k => cellStr.includes(k))) {
                tempNameIdx = idx;
                matches++;
              }
              // 업종 열 감지
              else if (keywords.category.some(k => cellStr.includes(k))) {
                tempCatIdx = idx;
                matches++;
              }
            });

            // 키워드가 2개 이상 일치하면 이것을 헤더 행으로 지정
            if (matches >= 2) {
              headerRowIndex = r;
              dateColIdx = tempDateIdx;
              amountColIdx = tempAmtIdx;
              nameColIdx = tempNameIdx;
              catColIdx = tempCatIdx;
              break;
            }
          }

          // 헤더 행을 못 찾은 경우 기본 디폴트 맵핑 (1열 날짜, 3열 가맹점, 4열 금액 등으로 설정 시도)
          if (headerRowIndex === -1) {
            headerRowIndex = 1; // 2번째 행을 기본 헤더로 가정
            dateColIdx = 0;
            nameColIdx = 2;
            amountColIdx = 3;
            catColIdx = 5;
          }

          // 2. 데이터 행 파싱
          for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const rawDate = dateColIdx !== -1 ? row[dateColIdx] : null;
            const rawAmount = amountColIdx !== -1 ? row[amountColIdx] : null;
            const rawName = nameColIdx !== -1 ? row[nameColIdx] : null;
            const rawCat = catColIdx !== -1 ? row[catColIdx] : null;

            // 필수 필드 체크 (날짜와 금액, 항목명이 둘 다 없으면 패스)
            if (!rawDate || !rawAmount || !rawName) continue;

            // 금액 정제
            let amountVal = 0;
            if (typeof rawAmount === 'number') {
              amountVal = rawAmount;
            } else {
              // 콤마, 원화기호 등 제거 후 파싱
              amountVal = parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
            }
            if (isNaN(amountVal) || amountVal <= 0) continue; // 0원 이하 건 제외

            // 날짜 정제
            const dateObj = parseExcelDate(rawDate);
            if (!dateObj) continue; // 날짜 해석 불가능 시 패스

            const itemName = String(rawName).trim();
            const originalCat = rawCat ? String(rawCat).trim() : '';
            const finalCat = guessCategory(itemName, originalCat);

            parsedTransactions.push({
              year: dateObj.year,
              month: dateObj.month,
              day: dateObj.day,
              itemName: itemName,
              amount: amountVal,
              category: finalCat,
              paymentMethod: guessedMethod,
              memo: originalCat ? `원본분류: ${originalCat}` : '엑셀 업로드',
              checked: true // 기본값: 체크 상태
            });
          }
        }
      });

      if (parsedTransactions.length === 0) {
        alert('엑셀 파일 분석 실패: 카드 소비 내역 시트(소비, 카드, 체크 등 단어가 포함된 시트)나 유효한 지출 정보를 찾지 못했습니다.');
        return;
      }

      // 상태 저장 후 모달 노출
      state.excelTransactions = parsedTransactions;
      openExcelPreviewModal();

    } catch (err) {
      console.error(err);
      alert('엑셀 파일을 불러오는 도중 오류가 발생했습니다. 파일 형식을 확인해 주세요.');
    }
  };

  reader.readAsArrayBuffer(file);
}

// 엑셀 미리보기 모달 열기 및 테이블 드로잉
function openExcelPreviewModal() {
  document.getElementById('excel-current-year').innerText = state.selectedYear;
  document.getElementById('excel-force-year').checked = state.excelForceYear;

  updateExcelPreviewTable();
  
  const modal = document.getElementById('excel-modal');
  modal.classList.remove('hidden');
  lucide.createIcons();
}

// 엑셀 미리보기 테이블 새로고침
function updateExcelPreviewTable() {
  const tbody = document.getElementById('excel-preview-tbody');
  const categories = window.StorageService.getCategories();
  const paymentMethods = window.StorageService.getPaymentMethods();

  tbody.innerHTML = state.excelTransactions.map((t, idx) => {
    // 연도 강제 보정 값 적용 처리
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

// 체크된 항목 카운터 갱신
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
  
  // 모든 체크박스 엘리먼트 동기화
  const checkboxes = document.querySelectorAll('.row-excel-check');
  checkboxes.forEach(cb => cb.checked = !!checked);
  
  updateExcelPreviewCount();
}

function toggleExcelForceYear(checked) {
  state.excelForceYear = !!checked;
  // 테이블 재출력하여 날짜 연도 변경사항 즉시 동기화
  updateExcelPreviewTable();
}

function closeExcelModal() {
  document.getElementById('excel-modal').classList.add('hidden');
}

// 선택된 지출 일괄 저장 실행
function saveExcelTransactions() {
  const toSave = state.excelTransactions.filter(t => t.checked);
  if (toSave.length === 0) {
    alert('등록할 항목이 선택되지 않았습니다.');
    return;
  }

  try {
    let savedCount = 0;
    toSave.forEach(t => {
      // 강제 연도 보정 적용
      const finalYear = state.excelForceYear ? state.selectedYear : t.year;
      
      window.StorageService.addExpense({
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
    });

    closeExcelModal();
    alert(`총 ${savedCount}건의 지출 내역이 성공적으로 등록되었습니다.`);
    
    // 현재 지출 화면 갱신
    renderExpenses();
  } catch (err) {
    alert('일괄 등록 중 오류가 발생했습니다: ' + err.message);
  }
}

