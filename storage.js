/**
 * 가계부 MVP 데이터 관리 서비스 (LocalStorage API)
 * 모든 코드와 데이터 및 주석은 초보자가 이해하기 쉽도록 작성되었습니다.
 * 엑셀 데이터 분석에 기반한 2026년 실제 가계부 데이터를 시드 데이터로 제공합니다.
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

// 1. 초기 기본 카테고리 정의 (실제 엑셀 기준)
const DEFAULT_CATEGORIES = [
  { id: 'cat-insurance', name: '보험', sortOrder: 1 },
  { id: 'cat-family', name: '가족', sortOrder: 2 },
  { id: 'cat-savings', name: '저축', sortOrder: 3 },
  { id: 'cat-home', name: '집', sortOrder: 4 },
  { id: 'cat-personal', name: '개인/기타', sortOrder: 5 },
  { id: 'cat-unplanned', name: '기타(비정기)', sortOrder: 6 },
  { id: 'cat-card', name: '카드', sortOrder: 7 }
];

// 2. 초기 기본 결제수단 정의
const DEFAULT_PAYMENT_METHODS = [
  '계좌자동이체', '신한카드', '하나카드', '카카오체크', '리카드', '현금', '토스페이'
];

// 3. 초기 기본 설정 정의
const DEFAULT_SETTINGS = {
  defaultYear: 2026
};

// 4. 2026년 엑셀 데이터 분석 기반 초기 지출 시드 데이터 생성
function generateSeedExpenses() {
  const seed = [];
  
  // 반복 지출 정의 헬퍼 함수
  const addMonthlyFixed = (categoryName, itemName, amount, paymentMethod, paymentDay, startMonth = 1, endMonth = 12) => {
    for (let m = startMonth; m <= endMonth; m++) {
      seed.push({
        id: generateId(),
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

  // --- 보험 카테고리 ---
  addMonthlyFixed('보험', '메리츠 보험', 18850, '계좌자동이체', '5일');
  addMonthlyFixed('보험', '삼성화재 건강보험', 158067, '계좌자동이체', '5일');
  addMonthlyFixed('보험', 'KB운전자 손해보험', 14093, '계좌자동이체', '5일');

  // --- 가족 카테고리 ---
  addMonthlyFixed('가족', '가족모임', 100000, '계좌자동이체', '5일');
  addMonthlyFixed('가족', '부모님 용돈', 200000, '계좌자동이체', '6일');
  addMonthlyFixed('가족', '정수기(본가)', 15900, '계좌자동이체', '5일');

  // --- 저축 카테고리 ---
  addMonthlyFixed('저축', '주택청약', 100000, '계좌자동이체', '6일');
  addMonthlyFixed('저축', '청년희망적금', 300000, '계좌자동이체', '만기', 1, 2); // 1~2월만 납부 후 만기
  addMonthlyFixed('저축', '청년도약계좌', 700000, '계좌자동이체', '5일', 1, 5); // 1~5월 70만원
  seed.push({
    id: generateId(),
    year: 2026,
    month: 6,
    category: '저축',
    itemName: '청년도약계좌',
    amount: 600000, // 6월엔 60만원 납부
    paymentMethod: '계좌자동이체',
    paymentDay: '5일',
    isFixed: true,
    memo: '6월 특별 감액 조정',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  addMonthlyFixed('저축', '청년도약계좌', 700000, '계좌자동이체', '5일', 7, 12); // 7~12월 70만원

  // --- 집 카테고리 ---
  addMonthlyFixed('집', '월세/관리비', 650000, '계좌자동이체', '5일');
  addMonthlyFixed('집', '인터넷/TV', 44550, '계좌자동이체', '21일');
  
  // 가스비 (계절 변동 반영)
  const gasFees = { 1: 29420, 2: 114720, 3: 87720, 4: 76560, 5: 75530, 6: 26350, 7: 16030 };
  Object.keys(gasFees).forEach(month => {
    seed.push({
      id: generateId(),
      year: 2026,
      month: parseInt(month),
      category: '집',
      itemName: '가스비(계절 변동)',
      amount: gasFees[month],
      paymentMethod: '계좌자동이체',
      paymentDay: '10일',
      isFixed: true,
      memo: '계절 변동 지출',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // 전기세 (1~7월 데이터 존재)
  const electricityFees = { 1: 21710, 2: 24570, 3: 26840, 4: 26080, 5: 21100, 6: 23670, 7: 21100 };
  Object.keys(electricityFees).forEach(month => {
    seed.push({
      id: generateId(),
      year: 2026,
      month: parseInt(month),
      category: '집',
      itemName: '전기',
      amount: electricityFees[month],
      paymentMethod: '계좌자동이체',
      paymentDay: '5일',
      isFixed: true,
      memo: '전기요금',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // 수도세 (격월 지출 반영: 1, 3, 5, 7월)
  const waterFees = { 1: 27535, 3: 42342, 5: 26401, 7: 24145 };
  Object.keys(waterFees).forEach(month => {
    seed.push({
      id: generateId(),
      year: 2026,
      month: parseInt(month),
      category: '집',
      itemName: '수도',
      amount: waterFees[month],
      paymentMethod: '계좌자동이체',
      paymentDay: '5일',
      isFixed: true,
      memo: '수도요금 (격월)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // --- 개인/기타 카테고리 ---
  addMonthlyFixed('개인/기타', '핸드폰', 71050, '신한카드', '15일');
  
  // 미용/머리 (비정기 지출)
  seed.push({
    id: generateId(), year: 2026, month: 3, category: '개인/기타', itemName: '미용/머리',
    amount: 85000, paymentMethod: '현금', paymentDay: '비정기', isFixed: false, memo: '커트 및 펌',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: generateId(), year: 2026, month: 5, category: '개인/기타', itemName: '미용/머리',
    amount: 19000, paymentMethod: '현금', paymentDay: '비정기', isFixed: false, memo: '커트',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // ChatGPT 구독 (1월 결제 데이터 존재)
  seed.push({
    id: generateId(), year: 2026, month: 1, category: '개인/기타', itemName: 'ChatGPT 구독',
    amount: 33282, paymentMethod: '신한카드', paymentDay: '5일', isFixed: true, memo: '해외 결제 ($22)',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // 헬스장 (단발성 다개월 결제)
  seed.push({
    id: generateId(), year: 2026, month: 3, category: '개인/기타', itemName: '헬스장(다개월)',
    amount: 440000, paymentMethod: '신한카드', paymentDay: '9/8까지', isFixed: false, memo: '5개월 회원권 + 락커',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // --- 기타(비정기) 카테고리 ---
  // 마이너스 통장 상환
  seed.push({
    id: generateId(), year: 2026, month: 3, category: '기타(비정기)', itemName: '마이너스통장 상환',
    amount: 1000000, paymentMethod: '계좌자동이체', paymentDay: '비정기', isFixed: false, memo: '일부 상환',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: generateId(), year: 2026, month: 4, category: '기타(비정기)', itemName: '마이너스통장 상환',
    amount: 1000000, paymentMethod: '계좌자동이체', paymentDay: '비정기', isFixed: false, memo: '일부 상환',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  
  // 타이어 교체
  seed.push({
    id: generateId(), year: 2026, month: 3, category: '기타(비정기)', itemName: '타이어 교체',
    amount: 1220000, paymentMethod: '신한카드', paymentDay: '비정기', isFixed: false, memo: '타이어 4짝 휠발란스 교환',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // 자동차보험 및 세금
  seed.push({
    id: generateId(), year: 2026, month: 2, category: '기타(비정기)', itemName: '자동차보험',
    amount: 751450, paymentMethod: '신한카드', paymentDay: '연1회', isFixed: false, memo: '갱신 결제',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: generateId(), year: 2026, month: 1, category: '기타(비정기)', itemName: '자동차세',
    amount: 140710, paymentMethod: '계좌자동이체', paymentDay: '연1회', isFixed: false, memo: '연납 분할',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  seed.push({
    id: generateId(), year: 2026, month: 2, category: '기타(비정기)', itemName: '자동차세',
    amount: 244120, paymentMethod: '계좌자동이체', paymentDay: '연1회', isFixed: false, memo: '지방세 납부',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  // --- 카드 생활비 (변동 지출 총액) ---
  const shinhanCardFees = { 1: 1283070, 2: 1837537, 3: 923565, 4: 2137663, 5: 2235546, 6: 270520, 7: 478521, 8: 332466 };
  Object.keys(shinhanCardFees).forEach(month => {
    seed.push({
      id: generateId(),
      year: 2026,
      month: parseInt(month),
      category: '카드',
      itemName: '신한카드 생활비',
      amount: shinhanCardFees[month],
      paymentMethod: '신한카드',
      paymentDay: '5일',
      isFixed: true,
      memo: '매월 카드 생활비 합계',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  const hanaCardFees = { 5: 1876611, 6: 1633682, 7: 1079412 };
  Object.keys(hanaCardFees).forEach(month => {
    seed.push({
      id: generateId(),
      year: 2026,
      month: parseInt(month),
      category: '카드',
      itemName: '하나카드 생활비',
      amount: hanaCardFees[month],
      paymentMethod: '하나카드',
      paymentDay: '5일',
      isFixed: true,
      memo: '서브 카드 생활비 합계',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  return seed;
}

// 5. 2026년 엑셀 데이터 분석 기반 초기 수입 시드 데이터 생성
function generateSeedIncome() {
  const seed = [];
  
  // 기본 월별 급여 등록
  const monthlySalary = {
    1: { amount: 4703928, memo: '연차 8.5개 포함 수당 정산' },
    2: { amount: 4795703, memo: '급여 + 연말정산 소급분 포함' },
    3: { amount: 3709010, memo: '기본 급여' },
    4: { amount: 3382040, memo: '명절 귀향비 포함' },
    5: { amount: 3697670, memo: '기본 급여' },
    6: { amount: 3697670, memo: '기본 급여' },
    7: { amount: 3697670, memo: '기본 급여' }
  };

  // 1~7월 실제 수입 데이터 기입
  Object.keys(monthlySalary).forEach(month => {
    seed.push({
      id: generateId(),
      year: 2026,
      month: parseInt(month),
      incomeName: `${month}월 급여`,
      amount: monthlySalary[month].amount,
      memo: monthlySalary[month].memo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // 2월 특별 추가 수입 (엑셀 시트 34행의 1,827,250원 추가분)
  seed.push({
    id: generateId(),
    year: 2026,
    month: 2,
    incomeName: '기타 보너스 수입',
    amount: 1827250,
    memo: '명절/기타 보너스 정산분',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 8~12월 기본 급여 자동 생성
  for (let m = 8; m <= 12; m++) {
    seed.push({
      id: generateId(),
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

// StorageService 싱글톤 객체 선언
class StorageService {
  constructor() {
    this._initialize();
  }

  // 초기화 및 LocalStorage 체크
  _initialize() {
    try {
      // 카테고리 데이터 체크 및 초기화
      if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      }
      
      // 결제수단 데이터 체크 및 초기화
      if (!localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS)) {
        localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(DEFAULT_PAYMENT_METHODS));
      }

      // 설정 데이터 체크 및 초기화
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      }

      // 지출 데이터 체크 및 초기화 (실제 데이터 적용)
      if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(generateSeedExpenses()));
      }

      // 수입 데이터 체크 및 초기화 (실제 데이터 적용)
      if (!localStorage.getItem(STORAGE_KEYS.INCOME)) {
        localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(generateSeedIncome()));
      }
    } catch (e) {
      console.error('LocalStorage 초기화 중 에러 발생:', e);
      alert('데이터 저장소를 초기화하지 못했습니다. 브라우저의 LocalStorage 제한 또는 시크릿 모드 설정을 확인해 주세요.');
    }
  }

  // ----------------------------------------------------
  // 카테고리 (Category) CRUD
  // ----------------------------------------------------
  getCategories() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data).sort((a, b) => a.sortOrder - b.sortOrder) : [];
    } catch (e) {
      console.error('카테고리 가져오기 실패:', e);
      return [];
    }
  }

  saveCategories(categories) {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      return true;
    } catch (e) {
      console.error('카테고리 저장 실패:', e);
      throw new Error('카테고리 데이터를 저장하지 못했습니다.');
    }
  }

  addCategory(name) {
    if (!name || name.trim() === '') {
      throw new Error('유효한 카테고리 이름을 입력해 주세요.');
    }
    const categories = this.getCategories();
    
    // 중복 체크
    if (categories.some(c => c.name === name.trim())) {
      throw new Error('이미 존재하는 카테고리 이름입니다.');
    }

    const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 1 : 1;
    const newCategory = {
      id: 'cat-' + generateId(),
      name: name.trim(),
      sortOrder: nextOrder
    };
    
    categories.push(newCategory);
    this.saveCategories(categories);
    return newCategory;
  }

  updateCategory(id, updatedName) {
    if (!updatedName || updatedName.trim() === '') {
      throw new Error('유효한 카테고리 이름을 입력해 주세요.');
    }
    const categories = this.getCategories();
    const catIndex = categories.findIndex(c => c.id === id);
    if (catIndex === -1) {
      throw new Error('존재하지 않는 카테고리입니다.');
    }
    
    // 이름 중복 검증 (자신 제외)
    if (categories.some((c, idx) => idx !== catIndex && c.name === updatedName.trim())) {
      throw new Error('이미 사용 중인 카테고리 이름입니다.');
    }

    categories[catIndex].name = updatedName.trim();
    this.saveCategories(categories);
    return categories[catIndex];
  }

  deleteCategory(id) {
    const categories = this.getCategories();
    const filtered = categories.filter(c => c.id !== id);
    if (categories.length === filtered.length) {
      throw new Error('삭제할 카테고리를 찾지 못했습니다.');
    }
    this.saveCategories(filtered);
    return true;
  }

  // ----------------------------------------------------
  // 지출 항목 (ExpenseItem) CRUD
  // ----------------------------------------------------
  getExpenses() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('지출 항목 가져오기 실패:', e);
      return [];
    }
  }

  saveExpenses(expenses) {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      return true;
    } catch (e) {
      console.error('지출 항목 저장 실패:', e);
      throw new Error('지출 데이터를 저장하지 못했습니다.');
    }
  }

  addExpense(expense) {
    // 필수 필드 및 양수 검증
    if (!expense.category || !expense.itemName || expense.amount === undefined || expense.amount === null) {
      throw new Error('필수 정보(분류, 항목명, 금액)를 누락했습니다.');
    }
    
    const amountVal = parseFloat(expense.amount);
    if (isNaN(amountVal) || amountVal < 0) {
      throw new Error('금액은 0보다 큰 유효한 숫자여야 합니다.');
    }

    const expenses = this.getExpenses();
    const newExpense = {
      id: generateId(),
      year: parseInt(expense.year) || new Date().getFullYear(),
      month: parseInt(expense.month) || (new Date().getMonth() + 1),
      category: expense.category,
      itemName: expense.itemName.trim(),
      amount: amountVal,
      paymentMethod: expense.paymentMethod || '현금',
      paymentDay: expense.paymentDay || '',
      isFixed: !!expense.isFixed,
      memo: (expense.memo || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expenses.push(newExpense);
    this.saveExpenses(expenses);
    return newExpense;
  }

  updateExpense(id, updatedFields) {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) {
      throw new Error('수정할 지출 항목을 찾지 못했습니다.');
    }

    // 금액 유효성 검증
    if (updatedFields.amount !== undefined) {
      const amountVal = parseFloat(updatedFields.amount);
      if (isNaN(amountVal) || amountVal < 0) {
        throw new Error('금액은 0보다 큰 유효한 숫자여야 합니다.');
      }
      expenses[idx].amount = amountVal;
    }

    if (updatedFields.category) expenses[idx].category = updatedFields.category;
    if (updatedFields.itemName) expenses[idx].itemName = updatedFields.itemName.trim();
    if (updatedFields.paymentMethod) expenses[idx].paymentMethod = updatedFields.paymentMethod;
    if (updatedFields.paymentDay !== undefined) expenses[idx].paymentDay = updatedFields.paymentDay;
    if (updatedFields.isFixed !== undefined) expenses[idx].isFixed = !!updatedFields.isFixed;
    if (updatedFields.memo !== undefined) expenses[idx].memo = updatedFields.memo.trim();
    if (updatedFields.year) expenses[idx].year = parseInt(updatedFields.year);
    if (updatedFields.month) expenses[idx].month = parseInt(updatedFields.month);

    expenses[idx].updatedAt = new Date().toISOString();
    
    this.saveExpenses(expenses);
    return expenses[idx];
  }

  deleteExpense(id) {
    const expenses = this.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    if (expenses.length === filtered.length) {
      throw new Error('삭제할 지출 항목을 찾지 못했습니다.');
    }
    this.saveExpenses(filtered);
    return true;
  }

  // ----------------------------------------------------
  // 수입 (Income) CRUD
  // ----------------------------------------------------
  getIncomes() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INCOME);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('수입 목록 가져오기 실패:', e);
      return [];
    }
  }

  saveIncomes(incomes) {
    try {
      localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(incomes));
      return true;
    } catch (e) {
      console.error('수입 목록 저장 실패:', e);
      throw new Error('수입 데이터를 저장하지 못했습니다.');
    }
  }

  addIncome(income) {
    if (!income.incomeName || income.amount === undefined || income.amount === null) {
      throw new Error('필수 정보(수입명, 금액)를 누락했습니다.');
    }
    const amountVal = parseFloat(income.amount);
    if (isNaN(amountVal) || amountVal < 0) {
      throw new Error('수입 금액은 0보다 큰 유효한 숫자여야 합니다.');
    }

    const incomes = this.getIncomes();
    const newIncome = {
      id: generateId(),
      year: parseInt(income.year) || new Date().getFullYear(),
      month: parseInt(income.month) || (new Date().getMonth() + 1),
      incomeName: income.incomeName.trim(),
      amount: amountVal,
      memo: (income.memo || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    incomes.push(newIncome);
    this.saveIncomes(incomes);
    return newIncome;
  }

  updateIncome(id, updatedFields) {
    const incomes = this.getIncomes();
    const idx = incomes.findIndex(i => i.id === id);
    if (idx === -1) {
      throw new Error('수정할 수입 항목을 찾지 못했습니다.');
    }

    if (updatedFields.amount !== undefined) {
      const amountVal = parseFloat(updatedFields.amount);
      if (isNaN(amountVal) || amountVal < 0) {
        throw new Error('수입 금액은 0보다 큰 유효한 숫자여야 합니다.');
      }
      incomes[idx].amount = amountVal;
    }

    if (updatedFields.incomeName) incomes[idx].incomeName = updatedFields.incomeName.trim();
    if (updatedFields.memo !== undefined) incomes[idx].memo = updatedFields.memo.trim();
    if (updatedFields.year) incomes[idx].year = parseInt(updatedFields.year);
    if (updatedFields.month) incomes[idx].month = parseInt(updatedFields.month);

    incomes[idx].updatedAt = new Date().toISOString();

    this.saveIncomes(incomes);
    return incomes[idx];
  }

  deleteIncome(id) {
    const incomes = this.getIncomes();
    const filtered = incomes.filter(i => i.id !== id);
    if (incomes.length === filtered.length) {
      throw new Error('삭제할 수입 항목을 찾지 못했습니다.');
    }
    this.saveIncomes(filtered);
    return true;
  }

  // ----------------------------------------------------
  // 결제 수단 (Payment Method) 관리
  // ----------------------------------------------------
  getPaymentMethods() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('결제 수단 가져오기 실패:', e);
      return [];
    }
  }

  addPaymentMethod(method) {
    if (!method || method.trim() === '') {
      throw new Error('유효한 결제 수단 이름을 입력해 주세요.');
    }
    const methods = this.getPaymentMethods();
    if (methods.includes(method.trim())) {
      throw new Error('이미 등록된 결제 수단입니다.');
    }
    methods.push(method.trim());
    localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(methods));
    return method.trim();
  }

  deletePaymentMethod(method) {
    const methods = this.getPaymentMethods();
    const filtered = methods.filter(m => m !== method);
    if (methods.length === filtered.length) {
      throw new Error('삭제할 결제 수단을 찾지 못했습니다.');
    }
    localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(filtered));
    return true;
  }

  // ----------------------------------------------------
  // 설정 (Settings) 관리
  // ----------------------------------------------------
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (e) {
      console.error('설정 가져오기 실패:', e);
      return DEFAULT_SETTINGS;
    }
  }

  updateSettings(newSettings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('설정 업데이트 실패:', e);
      throw new Error('설정을 저장하지 못했습니다.');
    }
  }
}

// 싱글톤 인스턴스 전역 내보내기
window.StorageService = new StorageService();
