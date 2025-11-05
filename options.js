// 기본 설정값
const DEFAULT_SETTINGS = {
  enabled: true,
  maxHistorySize: 150,
  debounceTime: 100,
  showUIButtons: true
};

// DOM 요소
const maxHistorySize = document.getElementById('maxHistorySize');
const maxHistorySizeValue = document.getElementById('maxHistorySizeValue');
const debounceTime = document.getElementById('debounceTime');
const debounceTimeValue = document.getElementById('debounceTimeValue');
const showUIButtons = document.getElementById('showUIButtons');
const saveButton = document.getElementById('saveButton');
const saveStatus = document.getElementById('saveStatus');

// 설정 불러오기
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    maxHistorySize.value = settings.maxHistorySize;
    maxHistorySizeValue.textContent = `${settings.maxHistorySize}개`;

    debounceTime.value = settings.debounceTime;
    debounceTimeValue.textContent = `${settings.debounceTime}ms`;

    showUIButtons.checked = settings.showUIButtons;
  });
}

// 범위 슬라이더 값 업데이트
maxHistorySize.addEventListener('input', () => {
  maxHistorySizeValue.textContent = `${maxHistorySize.value}개`;
});

debounceTime.addEventListener('input', () => {
  debounceTimeValue.textContent = `${debounceTime.value}ms`;
});

// 설정 저장
saveButton.addEventListener('click', () => {
  const settings = {
    enabled: true, // 항상 활성화 (popup에서 제어)
    maxHistorySize: parseInt(maxHistorySize.value),
    debounceTime: parseInt(debounceTime.value),
    showUIButtons: showUIButtons.checked
  };

  chrome.storage.sync.set(settings, () => {
    // 저장 완료 메시지 표시
    saveStatus.classList.add('show');
    setTimeout(() => {
      saveStatus.classList.remove('show');
    }, 2000);

    console.log('설정이 저장되었습니다:', settings);
  });
});

// 페이지 로드 시 설정 불러오기
loadSettings();
