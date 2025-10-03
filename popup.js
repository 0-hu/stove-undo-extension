// DOM 요소
const toggleSwitch = document.getElementById('toggleSwitch');
const statusElement = document.getElementById('status');
const reloadNotice = document.getElementById('reloadNotice');

// 저장된 설정 불러오기
chrome.storage.sync.get(['enabled'], (result) => {
    const isEnabled = result.enabled !== false; // 기본값: true
    toggleSwitch.checked = isEnabled;
    updateStatus(isEnabled);
});

// 토글 스위치 이벤트
toggleSwitch.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    // 설정 저장
    chrome.storage.sync.set({ enabled: isEnabled }, () => {
        updateStatus(isEnabled);
        showReloadNotice();
        
        // 백그라운드에 상태 변경 알림
        chrome.runtime.sendMessage({
            type: 'STATUS_CHANGED',
            enabled: isEnabled
        });
    });
});

// 상태 표시 업데이트
function updateStatus(isEnabled) {
    statusElement.className = 'status ' + (isEnabled ? 'active' : 'inactive');
    statusElement.textContent = isEnabled ? '✅ 활성화됨' : '⭕ 비활성화됨';
}

// 새로고침 안내 표시
function showReloadNotice() {
    reloadNotice.classList.add('show');
    setTimeout(() => {
        reloadNotice.classList.remove('show');
    }, 5000);
}