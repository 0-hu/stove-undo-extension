// DOM 요소
const toggleSwitch = document.getElementById('toggleSwitch');
const statusElement = document.getElementById('status');
const reloadNotice = document.getElementById('reloadNotice');
const settingsBtn = document.getElementById('settingsBtn');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const historyTimeline = document.getElementById('historyTimeline');

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

// 설정 페이지 열기
settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// 히스토리 불러오기
refreshHistoryBtn.addEventListener('click', () => {
    // 현재 활성 탭에 메시지 전송
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_HISTORY' }, (response) => {
                if (chrome.runtime.lastError) {
                    historyTimeline.innerHTML = '<p style="text-align: center; color: #dc3545; margin: 20px 0;">⚠️ 페이지에서 응답이 없습니다. 페이지를 새로고침하세요.</p>';
                    historyTimeline.style.display = 'block';
                    return;
                }

                if (response && response.success) {
                    renderHistory(response.data);
                } else {
                    historyTimeline.innerHTML = `<p style="text-align: center; color: #666; margin: 20px 0;">${response.message || '히스토리를 불러올 수 없습니다'}</p>`;
                    historyTimeline.style.display = 'block';
                }
            });
        }
    });
});

// 히스토리 렌더링
function renderHistory(data) {
    if (!data.history || data.history.length === 0) {
        historyTimeline.innerHTML = '<p style="text-align: center; color: #666; margin: 20px 0;">히스토리가 비어있습니다</p>';
        historyTimeline.style.display = 'block';
        return;
    }

    let html = `<div style="margin-bottom: 10px; color: #666; font-size: 12px;">에디터: ${data.editorId} | 총 ${data.history.length}개</div>`;

    // 히스토리 역순으로 표시 (최신이 위로)
    const reversedHistory = [...data.history].reverse();

    reversedHistory.forEach((item) => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isCurrent = item.isCurrent;

        html += `
            <div style="
                padding: 8px;
                margin-bottom: 6px;
                background: ${isCurrent ? '#e3f2fd' : 'white'};
                border: 1px solid ${isCurrent ? '#2196f3' : '#ddd'};
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 12px;
            " data-index="${item.index}" class="history-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: ${isCurrent ? '#2196f3' : '#333'};">
                        ${isCurrent ? '● ' : ''}#${data.history.length - item.index}
                    </span>
                    <span style="color: #666; font-size: 11px;">${timeStr}</span>
                </div>
                <div style="color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${item.preview || '(내용 없음)'}
                </div>
            </div>
        `;
    });

    historyTimeline.innerHTML = html;
    historyTimeline.style.display = 'block';

    // 히스토리 항목 클릭 이벤트
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('mouseenter', (e) => {
            e.currentTarget.style.background = '#f0f0f0';
        });
        item.addEventListener('mouseleave', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            e.currentTarget.style.background = index === data.currentIndex ? '#e3f2fd' : 'white';
        });
        item.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            jumpToHistory(index);
        });
    });
}

// 특정 히스토리로 이동
function jumpToHistory(index) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'JUMP_TO_HISTORY', index: index }, (response) => {
                if (response && response.success) {
                    // 성공 후 히스토리 다시 불러오기
                    setTimeout(() => {
                        refreshHistoryBtn.click();
                    }, 100);
                } else {
                    alert(response.message || '히스토리로 이동할 수 없습니다');
                }
            });
        }
    });
}