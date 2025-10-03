// 설치 시 기본 설정
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ enabled: true });
    console.log('스토브 에디터 실행취소 확장 프로그램이 설치되었습니다.');
});

// 팝업에서 보낸 메시지 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'STATUS_CHANGED') {
        console.log('확장 프로그램 상태 변경:', request.enabled ? '활성화' : '비활성화');
    }
});