/**
 * 가계부 MVP 데이터 관리 서비스 (LocalStorage & Supabase Hybrid API)
 * 설정에 Supabase URL과 Key가 있으면 자동으로 DB 연동 모드로 작동하고, 없으면 LocalStorage로 자동 롤백합니다.
 * 모든 연동 작업은 비동기(Async/Await) 방식으로 구현되었습니다.
 */

// 고유 ID 생성을 위한 함수
function generateId() {
  return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

// LocalStorage 키 정의
const STORAGE_KEYS = {
  CATEGORIES: 'ledger_categories',
  EXPENSES: 'ledger_expenses',
  INCOME: 'ledger_income',
  PAYMENT_METHODS: 'ledger_payment_methods',
  SETTINGS: 'ledger_settings'
};

// 1. 초기 기본 데이터 정의
const DEFAULT_CATEGORIES = [
  { id: 'cat-insurance', name: '보험', sortOrder: 1 },
  { id: 'cat-family', name: '가족', sortOrder: 2 },
  { id: 'cat-savings', name: '저축', sortOrder: 3 },
  { id: 'cat-home', name: '집', sortOrder: 4 },
  { id: 'cat-personal', name: '개인/기타', sortOrder: 5 },
  { id: 'cat-unplanned', name: '기타(비정기)', sortOrder: 6 },
  { id: 'cat-card', name: '카드', sortOrder: 7 }
];

const DEFAULT_PAYMENT_METHODS = [
  '계좌자동이체', '신한카드', '하나카드', '카카오체크', '리카드', '현금', '토스페이'
];

const DEFAULT_SETTINGS = {
  defaultYear: 2026,
  supabaseUrl: '',
  supabaseKey: ''
};

// 2. 데이터베이스 스네이크 케이스(snake_case) <-> 카멜 케이스(camelCase) 변환 매퍼
const Mappers = {
  expenseToDB(e) {
    return {
      id: e.id,
      year: parseInt(e.year),
      month: parseInt(e.month),
      category: e.category,
      item_name: e.itemName,
      amount: parseFloat(e.amount),
      payment_method: e.paymentMethod,
      payment_day: e.paymentDay || '',
      is_fixed: !!e.isFixed,
      memo: e.memo || '',
      created_at: e.createdAt || new Date().toISOString(),
      updated_at: e.updatedAt || new Date().toISOString()
    };
  },
  expenseFromDB(row) {
    return {
      id: row.id,
      year: row.year,
      month: row.month,
      category: row.category,
      itemName: row.item_name,
      amount: parseFloat(row.amount),
      paymentMethod: row.payment_method,
      paymentDay: row.payment_day,
      isFixed: row.is_fixed,
      memo: row.memo,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  incomeToDB(i) {
    return {
      id: i.id,
      year: parseInt(i.year),
      month: parseInt(i.month),
      income_name: i.incomeName,
      amount: parseFloat(i.amount),
      memo: i.memo || '',
      created_at: i.createdAt || new Date().toISOString(),
      updated_at: i.updatedAt || new Date().toISOString()
    };
  },
  incomeFromDB(row) {
    return {
      id: row.id,
      year: row.year,
      month: row.month,
      incomeName: row.income_name,
      amount: parseFloat(row.amount),
      memo: row.memo,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  categoryToDB(c) {
    return {
      id: c.id,
      name: c.name,
      sort_order: parseInt(c.sortOrder)
    };
  },
  categoryFromDB(row) {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order
    };
  }
};

// 3. 지출 및 수입 시드(Seed) 데이터 정의
function generateSeedExpenses() {
  const seed = [];
  const addMonthlyFixed = (categoryName, itemName, amount, paymentMethod, paymentDay, startMonth = 1, endMonth = 12) => {
    for (let m = startMonth; m <= endMonth; m++) {
      seed.push({
        id: 'seed-exp-' + generateId().substring(5),
        year: 2026,
        month: m,
        category: categoryName,
        itemName: itemName,
        amount: amount,
        paymentMethod: paymentMethod,
        paymentDay: paymentDay,
        isFixed: true,
        memo: '고정지출 기본생성',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  addMonthlyFixed('보험', '메리츠 보험', 18850, '계좌자동이체', '5일');
  addMonthlyFixed('보험', '삼성화재 건강보험', 158067, '계좌자동이체', '5일');
  addMonthlyFixed('보험', 'KB운전자 손해보험', 14093, '계좌자동이체', '5일');
  addMonthlyFixed('가족', '가족모임', 100000, '계좌자동이체', '5일');
  addMonthlyFixed('가족', '부모님 용돈', 200000, '계좌자동이체', '6일');
  addMonthlyFixed('가족', '정수기(본가)', 15900, '계좌자동이체', '5일');
  addMonthlyFixed('저축', '주택청약', 100000, '계좌자동이체', '6일');
  addMonthlyFixed('저축', '청년희망적금', 300000, '계좌자동이체', '만기', 1, 2);
  addMonthlyFixed('저축', '청년도약계좌', 700000, '계좌자동이체', '5일', 1, 5);
  
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 6, category: '저축', itemName: '청년도약계좌', amount: 600000,
    paymentMethod: '계좌자동이체', paymentDay: '5일', isFixed: true, memo: '6월 특별 감액 조정',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  
  addMonthlyFixed('저축', '청년도약계좌', 700000, '계좌자동이체', '5일', 7, 12);
  addMonthlyFixed('집', '월세/관리비', 650000, '계좌자동이체', '5일');
  addMonthlyFixed('집', '인터넷/TV', 44550, '계좌자동이체', '21일');
  
  const gasFees = { 1: 29420, 2: 114720, 3: 87720, 4: 76560, 5: 75530, 6: 26350, 7: 16030 };
  Object.keys(gasFees).forEach(month => {
    seed.push({
      id: 'seed-exp-' + generateId().substring(5), year: 2026, month: parseInt(month), category: '집', itemName: '가스비(계절 변동)',
      amount: gasFees[month], paymentMethod: '계좌자동이체', paymentDay: '10일', isFixed: true, memo: '계절 변동 지출',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  });

  const electricityFees = { 1: 21710, 2: 24570, 3: 26840, 4: 26080, 5: 21100, 6: 23670, 7: 21100 };
  Object.keys(electricityFees).forEach(month => {
    seed.push({
      id: 'seed-exp-' + generateId().substring(5), year: 2026, month: parseInt(month), category: '집', itemName: '전기',
      amount: electricityFees[month], paymentMethod: '계좌자동이체', paymentDay: '5일', isFixed: true, memo: '전기요금',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  });

  const waterFees = { 1: 27535, 3: 42342, 5: 26401, 7: 24145 };
  Object.keys(waterFees).forEach(month => {
    seed.push({
      id: 'seed-exp-' + generateId().substring(5), year: 2026, month: parseInt(month), category: '집', itemName: '수도',
      amount: waterFees[month], paymentMethod: '계좌자동이체', paymentDay: '5일', isFixed: true, memo: '수도요금 (격월)',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  });

  addMonthlyFixed('개인/기타', '핸드폰', 71050, '신한카드', '15일');
  
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 3, category: '개인/기타', itemName: '미용/머리',
    amount: 85000, paymentMethod: '현금', paymentDay: '비정기', isFixed: false, memo: '커트 및 펌',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 5, category: '개인/기타', itemName: '미용/머리',
    amount: 19000, paymentMethod: '현금', paymentDay: '비정기', isFixed: false, memo: '커트',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 1, category: '개인/기타', itemName: 'ChatGPT 구독',
    amount: 33282, paymentMethod: '신한카드', paymentDay: '5일', isFixed: true, memo: '해외 결제 ($22)',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 3, category: '개인/기타', itemName: '헬스장(다개월)',
    amount: 440000, paymentMethod: '신한카드', paymentDay: '9/8까지', isFixed: false, memo: '5개월 회원권',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 3, category: '기타(비정기)', itemName: '마이너스통장 상환',
    amount: 1000000, paymentMethod: '계좌자동이체', paymentDay: '비정기', isFixed: false, memo: '일부 상환',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 4, category: '기타(비정기)', itemName: '마이너스통장 상환',
    amount: 1000000, paymentMethod: '계좌자동이체', paymentDay: '비정기', isFixed: false, memo: '일부 상환',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 3, category: '기타(비정기)', itemName: '타이어 교체',
    amount: 1220000, paymentMethod: '신한카드', paymentDay: '비정기', isFixed: false, memo: '타이어 교환',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 2, category: '기타(비정기)', itemName: '자동차보험',
    amount: 751450, paymentMethod: '신한카드', paymentDay: '연1회', isFixed: false, memo: '갱신 결제',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 1, category: '기타(비정기)', itemName: '자동차세',
    amount: 140710, paymentMethod: '계좌자동이체', paymentDay: '연납', isFixed: false, memo: '연납 분할',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: 'seed-exp-' + generateId().substring(5), year: 2026, month: 2, category: '기타(비정기)', itemName: '자동차세',
    amount: 244120, paymentMethod: '계좌자동이체', paymentDay: '연납', isFixed: false, memo: '지방세 납부',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  const shinhanCardFees = { 1: 1283070, 2: 1837537, 3: 923565, 4: 2137663, 5: 2235546, 6: 270520, 7: 478521, 8: 332466 };
  Object.keys(shinhanCardFees).forEach(month => {
    seed.push({
      id: 'seed-exp-' + generateId().substring(5), year: 2026, month: parseInt(month), category: '카드', itemName: '신한카드 생활비',
      amount: shinhanCardFees[month], paymentMethod: '신한카드', paymentDay: '5일', isFixed: true, memo: '카드생활비 합산',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  });

  const hanaCardFees = { 5: 1876611, 6: 1633682, 7: 1079412 };
  Object.keys(hanaCardFees).forEach(month => {
    seed.push({
      id: 'seed-exp-' + generateId().substring(5), year: 2026, month: parseInt(month), category: '카드', itemName: '하나카드 생활비',
      amount: hanaCardFees[month], paymentMethod: '하나카드', paymentDay: '5일', isFixed: true, memo: '카드생활비 합산',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  });

  return seed;
}

function generateSeedIncome() {
  const seed = [];
  const monthlySalary = {
    1: { amount: 4703928, memo: '연차 수당 포함' },
    2: { amount: 4795703, memo: '급여 및 연말정산 소급분' },
    3: { amount: 3709010, memo: '기본 급여' },
    4: { amount: 3382040, memo: '명절 수당 포함' },
    5: { amount: 3697670, memo: '기본 급여' },
    6: { amount: 3697670, memo: '기본 급여' },
    7: { amount: 3697670, memo: '기본 급여' }
  };

  Object.keys(monthlySalary).forEach(month => {
    seed.push({
      id: 'seed-inc-' + generateId().substring(5),
      year: 2026,
      month: parseInt(month),
      incomeName: `${month}월 급여`,
      amount: monthlySalary[month].amount,
      memo: monthlySalary[month].memo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  seed.push({
    id: 'seed-inc-' + generateId().substring(5), year: 2026, month: 2, incomeName: '기타 보너스 수입', amount: 1827250,
    memo: '보너스 정산분', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  for (let m = 8; m <= 12; m++) {
    seed.push({
      id: 'seed-inc-' + generateId().substring(5),
      year: 2026,
      month: m,
      incomeName: `${m}월 급여`,
      amount: 3697670,
      memo: '기본 급여 (추정)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return seed;
}

// 4. StorageService 클래스 정의
class StorageService {
  constructor() {
    this.supabase = null;
    this._initializeLocal();
    this._initializeSupabase();
  }

  // 로컬스토리지 기본값 초기화 (Supabase 미연동 시 백업용)
  _initializeLocal() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS)) {
        localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(DEFAULT_PAYMENT_METHODS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(generateSeedExpenses()));
      }
      if (!localStorage.getItem(STORAGE_KEYS.INCOME)) {
        localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(generateSeedIncome()));
      }
    } catch (e) {
      console.error('LocalStorage 초기화 실패:', e);
    }
  }

  // Supabase 클라이언트 세팅
  _initializeSupabase() {
    try {
      const settings = this.getSettingsLocal();
      if (settings.supabaseUrl && settings.supabaseKey) {
        // 전역 supabase 라이브러리 존재 여부 확인 후 로드
        if (window.supabase) {
          this.supabase = window.supabase.createClient(settings.supabaseUrl, settings.supabaseKey);
          console.log('Supabase 실시간 연동이 정상 활성화되었습니다.');
        } else {
          console.warn('Supabase 라이브러리 로드에 실패하여 로컬 모드로 작동합니다.');
        }
      } else {
        this.supabase = null;
        console.log('로컬 브라우저 단독 모드로 작동 중입니다. (DB 정보 없음)');
      }
    } catch (e) {
      console.error('Supabase 클라이언트 설정 오류:', e);
      this.supabase = null;
    }
  }

  isSupabaseEnabled() {
    return this.supabase !== null;
  }

  // 로컬 전용 설정 로더 (초기화 단계에서 사용)
  getSettingsLocal() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  }

  // ----------------------------------------------------
  // 카테고리 (Category) 비동기 API
  // ----------------------------------------------------
  async getCategories() {
    if (this.isSupabaseEnabled()) {
      try {
        const { data, error } = await this.supabase
          .from('ledger_categories')
          .select('*')
          .order('sort_order', { ascending: true });
        
        if (error) throw error;
        return data.map(Mappers.categoryFromDB);
      } catch (e) {
        console.error('Supabase 카테고리 조회 에러, 로컬로 복귀:', e);
      }
    }
    // LocalStorage Fallback
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  }

  async addCategory(name) {
    if (!name || name.trim() === '') {
      throw new Error('유효한 카테고리 이름을 입력해 주세요.');
    }
    
    const categories = await this.getCategories();
    if (categories.some(c => c.name === name.trim())) {
      throw new Error('이미 존재하는 카테고리 이름입니다.');
    }
    
    const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 1 : 1;
    const newCategory = {
      id: 'cat-' + generateId(),
      name: name.trim(),
      sortOrder: nextOrder
    };

    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_categories')
        .insert([Mappers.categoryToDB(newCategory)]);
      if (error) throw new Error('Supabase 카테고리 추가 실패: ' + error.message);
    } else {
      categories.push(newCategory);
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    }
    return newCategory;
  }

  async deleteCategory(id) {
    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_categories')
        .delete()
        .eq('id', id);
      if (error) throw new Error('Supabase 카테고리 삭제 실패: ' + error.message);
    } else {
      const categories = await this.getCategories();
      const filtered = categories.filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(filtered));
    }
    return true;
  }

  // ----------------------------------------------------
  // 지출 항목 (ExpenseItem) 비동기 API
  // ----------------------------------------------------
  async getExpenses() {
    if (this.isSupabaseEnabled()) {
      try {
        const { data, error } = await this.supabase
          .from('ledger_expenses')
          .select('*');
        if (error) throw error;
        return data.map(Mappers.expenseFromDB);
      } catch (e) {
        console.error('Supabase 지출 조회 에러, 로컬로 복귀:', e);
      }
    }
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
  }

  async addExpense(expense) {
    if (!expense.category || !expense.itemName || expense.amount === undefined || expense.amount === null) {
      throw new Error('필수 정보를 누락했습니다.');
    }
    const amountVal = parseFloat(expense.amount);
    if (isNaN(amountVal) || amountVal < 0) {
      throw new Error('금액은 0보다 큰 숫자여야 합니다.');
    }

    const newExpense = {
      id: expense.id || 'exp-' + generateId(),
      year: parseInt(expense.year) || new Date().getFullYear(),
      month: parseInt(expense.month) || (new Date().getMonth() + 1),
      category: expense.category,
      itemName: expense.itemName.trim(),
      amount: amountVal,
      paymentMethod: expense.paymentMethod || '현금',
      paymentDay: expense.paymentDay || '',
      isFixed: !!expense.isFixed,
      memo: (expense.memo || '').trim(),
      createdAt: expense.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_expenses')
        .insert([Mappers.expenseToDB(newExpense)]);
      if (error) throw new Error('Supabase 지출 등록 실패: ' + error.message);
    } else {
      const expenses = await this.getExpenses();
      expenses.push(newExpense);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    }
    return newExpense;
  }

  async updateExpense(id, updatedFields) {
    if (updatedFields.amount !== undefined) {
      const amountVal = parseFloat(updatedFields.amount);
      if (isNaN(amountVal) || amountVal < 0) throw new Error('금액이 유효하지 않습니다.');
    }

    if (this.isSupabaseEnabled()) {
      // Supabase 업데이트 처리를 위한 DB 행 구조 변환
      const dbFields = {};
      if (updatedFields.year !== undefined) dbFields.year = parseInt(updatedFields.year);
      if (updatedFields.month !== undefined) dbFields.month = parseInt(updatedFields.month);
      if (updatedFields.category !== undefined) dbFields.category = updatedFields.category;
      if (updatedFields.itemName !== undefined) dbFields.item_name = updatedFields.itemName.trim();
      if (updatedFields.amount !== undefined) dbFields.amount = parseFloat(updatedFields.amount);
      if (updatedFields.paymentMethod !== undefined) dbFields.payment_method = updatedFields.paymentMethod;
      if (updatedFields.paymentDay !== undefined) dbFields.payment_day = updatedFields.paymentDay;
      if (updatedFields.isFixed !== undefined) dbFields.is_fixed = !!updatedFields.isFixed;
      if (updatedFields.memo !== undefined) dbFields.memo = updatedFields.memo.trim();
      dbFields.updated_at = new Date().toISOString();

      const { error } = await this.supabase
        .from('ledger_expenses')
        .update(dbFields)
        .eq('id', id);
      if (error) throw new Error('Supabase 지출 수정 실패: ' + error.message);
    } else {
      const expenses = await this.getExpenses();
      const idx = expenses.findIndex(e => e.id === id);
      if (idx === -1) throw new Error('지출 항목을 찾지 못했습니다.');

      if (updatedFields.amount !== undefined) expenses[idx].amount = parseFloat(updatedFields.amount);
      if (updatedFields.category) expenses[idx].category = updatedFields.category;
      if (updatedFields.itemName) expenses[idx].itemName = updatedFields.itemName.trim();
      if (updatedFields.paymentMethod) expenses[idx].paymentMethod = updatedFields.paymentMethod;
      if (updatedFields.paymentDay !== undefined) expenses[idx].paymentDay = updatedFields.paymentDay;
      if (updatedFields.isFixed !== undefined) expenses[idx].isFixed = !!updatedFields.isFixed;
      if (updatedFields.memo !== undefined) expenses[idx].memo = updatedFields.memo.trim();
      if (updatedFields.year) expenses[idx].year = parseInt(updatedFields.year);
      if (updatedFields.month) expenses[idx].month = parseInt(updatedFields.month);
      expenses[idx].updatedAt = new Date().toISOString();

      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    }
    return true;
  }

  async deleteExpense(id) {
    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_expenses')
        .delete()
        .eq('id', id);
      if (error) throw new Error('Supabase 지출 삭제 실패: ' + error.message);
    } else {
      const expenses = await this.getExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));
    }
    return true;
  }

  // ----------------------------------------------------
  // 수입 (Income) 비동기 API
  // ----------------------------------------------------
  async getIncomes() {
    if (this.isSupabaseEnabled()) {
      try {
        const { data, error } = await this.supabase
          .from('ledger_incomes')
          .select('*');
        if (error) throw error;
        return data.map(Mappers.incomeFromDB);
      } catch (e) {
        console.error('Supabase 수입 조회 에러, 로컬로 복귀:', e);
      }
    }
    const data = localStorage.getItem(STORAGE_KEYS.INCOME);
    return data ? JSON.parse(data) : [];
  }

  async addIncome(income) {
    if (!income.incomeName || income.amount === undefined || income.amount === null) {
      throw new Error('필수 정보를 누락했습니다.');
    }
    const amountVal = parseFloat(income.amount);
    if (isNaN(amountVal) || amountVal < 0) throw new Error('수입 금액이 유효하지 않습니다.');

    const newIncome = {
      id: income.id || 'inc-' + generateId(),
      year: parseInt(income.year) || new Date().getFullYear(),
      month: parseInt(income.month) || (new Date().getMonth() + 1),
      incomeName: income.incomeName.trim(),
      amount: amountVal,
      memo: (income.memo || '').trim(),
      createdAt: income.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_incomes')
        .insert([Mappers.incomeToDB(newIncome)]);
      if (error) throw new Error('Supabase 수입 등록 실패: ' + error.message);
    } else {
      const incomes = await this.getIncomes();
      incomes.push(newIncome);
      localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(incomes));
    }
    return newIncome;
  }

  async updateIncome(id, updatedFields) {
    if (updatedFields.amount !== undefined) {
      const amountVal = parseFloat(updatedFields.amount);
      if (isNaN(amountVal) || amountVal < 0) throw new Error('금액 오류');
    }

    if (this.isSupabaseEnabled()) {
      const dbFields = {};
      if (updatedFields.year !== undefined) dbFields.year = parseInt(updatedFields.year);
      if (updatedFields.month !== undefined) dbFields.month = parseInt(updatedFields.month);
      if (updatedFields.incomeName !== undefined) dbFields.income_name = updatedFields.incomeName.trim();
      if (updatedFields.amount !== undefined) dbFields.amount = parseFloat(updatedFields.amount);
      if (updatedFields.memo !== undefined) dbFields.memo = updatedFields.memo.trim();
      dbFields.updated_at = new Date().toISOString();

      const { error } = await this.supabase
        .from('ledger_incomes')
        .update(dbFields)
        .eq('id', id);
      if (error) throw new Error('Supabase 수입 수정 실패: ' + error.message);
    } else {
      const incomes = await this.getIncomes();
      const idx = incomes.findIndex(i => i.id === id);
      if (idx === -1) throw new Error('수입 항목을 찾지 못했습니다.');

      if (updatedFields.amount !== undefined) incomes[idx].amount = parseFloat(updatedFields.amount);
      if (updatedFields.incomeName) incomes[idx].incomeName = updatedFields.incomeName.trim();
      if (updatedFields.memo !== undefined) incomes[idx].memo = updatedFields.memo.trim();
      if (updatedFields.year) incomes[idx].year = parseInt(updatedFields.year);
      if (updatedFields.month) incomes[idx].month = parseInt(updatedFields.month);
      incomes[idx].updatedAt = new Date().toISOString();

      localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(incomes));
    }
    return true;
  }

  async deleteIncome(id) {
    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_incomes')
        .delete()
        .eq('id', id);
      if (error) throw new Error('Supabase 수입 삭제 실패: ' + error.message);
    } else {
      const incomes = await this.getIncomes();
      const filtered = incomes.filter(i => i.id !== id);
      localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(filtered));
    }
    return true;
  }

  // ----------------------------------------------------
  // 결제 수단 (Payment Method) 비동기 API
  // ----------------------------------------------------
  async getPaymentMethods() {
    if (this.isSupabaseEnabled()) {
      try {
        const { data, error } = await this.supabase
          .from('ledger_payment_methods')
          .select('name');
        if (error) throw error;
        return data.map(row => row.name);
      } catch (e) {
        console.error('Supabase 결제수단 조회 에러, 로컬로 복귀:', e);
      }
    }
    const data = localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS);
    return data ? JSON.parse(data) : [];
  }

  async addPaymentMethod(method) {
    if (!method || method.trim() === '') throw new Error('결제수단명을 바르게 쓰세요.');
    const trimmed = method.trim();
    const methods = await this.getPaymentMethods();
    if (methods.includes(trimmed)) return trimmed;

    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_payment_methods')
        .insert([{ name: trimmed }]);
      if (error) throw new Error('Supabase 결제수단 등록 실패: ' + error.message);
    } else {
      methods.push(trimmed);
      localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(methods));
    }
    return trimmed;
  }

  async deletePaymentMethod(method) {
    if (this.isSupabaseEnabled()) {
      const { error } = await this.supabase
        .from('ledger_payment_methods')
        .delete()
        .eq('name', method);
      if (error) throw new Error('Supabase 결제수단 삭제 실패: ' + error.message);
    } else {
      const methods = await this.getPaymentMethods();
      const filtered = methods.filter(m => m !== method);
      localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(filtered));
    }
    return true;
  }

  // ----------------------------------------------------
  // 설정 (Settings) 비동기 API
  // ----------------------------------------------------
  async getSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  }

  async updateSettings(newSettings) {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      
      // Supabase 정보가 갱신되면 클라이언트 인스턴스 재초기화
      this._initializeSupabase();
      return updated;
    } catch (e) {
      console.error(e);
      throw new Error('설정 저장 중 오류가 발생했습니다.');
    }
  }

  // ----------------------------------------------------
  // 7. 로컬 데이터를 Supabase로 일괄 백업 마이그레이션 함수
  // ----------------------------------------------------
  async migrateLocalToSupabase() {
    if (!this.isSupabaseEnabled()) {
      throw new Error('Supabase가 활성화되어 있지 않습니다. 설정을 먼저 입력하세요.');
    }

    try {
      // 로컬 파일에서 읽기
      const localCats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
      const localExp = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES) || '[]');
      const localInc = JSON.parse(localStorage.getItem(STORAGE_KEYS.INCOME) || '[]');
      const localMethods = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS) || '[]');

      // 1. 결제 수단 업서트
      if (localMethods.length > 0) {
        const payload = localMethods.map(m => ({ name: m }));
        const { error } = await this.supabase
          .from('ledger_payment_methods')
          .upsert(payload, { onConflict: 'name' });
        if (error) throw new Error('결제수단 동기화 실패: ' + error.message);
      }

      // 2. 카테고리 업서트
      if (localCats.length > 0) {
        const payload = localCats.map(Mappers.categoryToDB);
        const { error } = await this.supabase
          .from('ledger_categories')
          .upsert(payload, { onConflict: 'id' });
        if (error) throw new Error('카테고리 동기화 실패: ' + error.message);
      }

      // 3. 지출 내역 업서트
      if (localExp.length > 0) {
        const payload = localExp.map(Mappers.expenseToDB);
        const { error } = await this.supabase
          .from('ledger_expenses')
          .upsert(payload, { onConflict: 'id' });
        if (error) throw new Error('지출 내역 동기화 실패: ' + error.message);
      }

      // 4. 수입 내역 업서트
      if (localInc.length > 0) {
        const payload = localInc.map(Mappers.incomeToDB);
        const { error } = await this.supabase
          .from('ledger_incomes')
          .upsert(payload, { onConflict: 'id' });
        if (error) throw new Error('수입 내역 동기화 실패: ' + error.message);
      }

      return {
        categories: localCats.length,
        expenses: localExp.length,
        incomes: localInc.length,
        paymentMethods: localMethods.length
      };

    } catch (err) {
      console.error('동기화 중 오류 발생:', err);
      throw new Error('로컬 데이터 이전 중 오류가 발생했습니다: ' + err.message);
    }
  }
}

// 싱글톤 전역 인스턴스 내보내기
window.StorageService = new StorageService();
