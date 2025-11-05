// 토스트 알림 표시 함수
function showToast(message, type = 'info') {
  // document.body가 없으면 대기
  if (!document.body) {
    setTimeout(() => showToast(message, type), 100);
    return;
  }

  try {
    // 기존 토스트가 있으면 제거
    const existingToast = document.getElementById('stove-undo-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'stove-undo-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background-color: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

    // 애니메이션 CSS 추가
    if (!document.getElementById('stove-undo-toast-style')) {
      const style = document.createElement('style');
      style.id = 'stove-undo-toast-style';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // 3초 후 제거
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (toast && toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 3000);
  } catch (error) {
    console.error('토스트 표시 실패:', error);
  }
}

// 히스토리 관리를 위한 클래스
class EditorHistoryManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = 150;
    this.lastContent = '';
    this.isUndoing = false;
    this.isRedoing = false;
    this.maxContentSize = 100 * 1024; // 100KB
    this.warningShown = false; // 경고 한 번만 표시
  }

  saveState(content, element) {
    if (this.isUndoing || this.isRedoing) return;
    if (content === this.lastContent) return;

    try {
      // 콘텐츠 크기 체크
      const contentSize = new Blob([content]).size;

      // 대용량 콘텐츠 경고 (한 번만)
      if (contentSize > this.maxContentSize && !this.warningShown) {
        const sizeMB = (contentSize / 1024 / 1024).toFixed(2);
        console.warn(`대용량 콘텐츠 감지: ${sizeMB}MB`);
        showToast(`⚠️ 대용량 콘텐츠(${sizeMB}MB) - 실행취소 성능이 저하될 수 있습니다`, 'info');
        this.warningShown = true;

        // 대용량의 경우 히스토리 크기를 더 작게 제한
        if (this.history.length > 30) {
          // 오래된 항목부터 제거하여 30개로 제한
          const removeCount = this.history.length - 30;
          this.history.splice(0, removeCount);
          this.currentIndex -= removeCount;
          if (this.currentIndex < 0) this.currentIndex = 0;
          console.log(`대용량 콘텐츠: 히스토리 30개로 제한`);
        }
      }

      // 현재 인덱스 이후의 히스토리 제거
      this.history = this.history.slice(0, this.currentIndex + 1);

      // 새 상태 추가
      this.history.push({
        content: content,
        timestamp: Date.now(),
        selection: this.saveSelection(element)
      });

      // 히스토리 크기 제한
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      } else {
        this.currentIndex++;
      }

      this.lastContent = content;
    } catch (error) {
      console.error('상태 저장 실패:', error);
      // 저장 실패는 치명적이지 않으므로 조용히 처리
    }
  }

  saveSelection(element) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    
    try {
      const range = sel.getRangeAt(0);
      return {
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        startContainer: range.startContainer,
        endContainer: range.endContainer
      };
    } catch (e) {
      return null;
    }
  }

  restoreSelection(selectionData, element) {
    if (!selectionData) return;
    
    try {
      // 노드가 여전히 DOM에 존재하는지 확인
      if (!document.contains(selectionData.startContainer) || 
          !document.contains(selectionData.endContainer)) {
        return;
      }
      
      const range = document.createRange();
      range.setStart(selectionData.startContainer, selectionData.startOffset);
      range.setEnd(selectionData.endContainer, selectionData.endOffset);
      
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      // 선택 영역 복원 실패 시 조용히 무시
    }
  }

  undo(element) {
    if (this.currentIndex <= 0) {
      showToast('더 이상 실행취소할 수 없습니다', 'info');
      return false;
    }

    try {
      this.isUndoing = true;
      this.currentIndex--;
      const state = this.history[this.currentIndex];

      this.restoreContent(element, state);
      this.lastContent = state.content;

      setTimeout(() => { this.isUndoing = false; }, 0);
      return true;
    } catch (error) {
      console.error('Undo 실패:', error);
      this.currentIndex++; // 인덱스 복원
      this.isUndoing = false;
      return false;
    }
  }

  redo(element) {
    if (this.currentIndex >= this.history.length - 1) {
      showToast('더 이상 다시실행할 수 없습니다', 'info');
      return false;
    }

    try {
      this.isRedoing = true;
      this.currentIndex++;
      const state = this.history[this.currentIndex];

      this.restoreContent(element, state);
      this.lastContent = state.content;

      setTimeout(() => { this.isRedoing = false; }, 0);
      return true;
    } catch (error) {
      console.error('Redo 실패:', error);
      this.currentIndex--; // 인덱스 복원
      this.isRedoing = false;
      return false;
    }
  }

  restoreContent(element, state) {
    try {
      if (element.innerHTML !== undefined) {
        element.innerHTML = state.content;
      } else if (element.value !== undefined) {
        element.value = state.content;
      } else if (element.textContent !== undefined) {
        element.textContent = state.content;
      }

      this.restoreSelection(state.selection, element);

      // 입력 이벤트 트리거
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
      console.error('콘텐츠 복원 실패:', error);
      showToast('실행취소 중 오류가 발생했습니다', 'error');
      throw error;
    }
  }

  getContent(element) {
    if (element.innerHTML !== undefined) {
      return element.innerHTML;
    } else if (element.value !== undefined) {
      return element.value;
    } else if (element.textContent !== undefined) {
      return element.textContent;
    }
    return '';
  }
}

// 에디터 감지 및 초기화
function initializeEditorUndo() {
  // 확장 프로그램 활성화 상태 확인
  chrome.storage.sync.get(['enabled'], (result) => {
    const isEnabled = result.enabled !== false;
    
    if (!isEnabled) {
      console.log('스토브 에디터 실행취소: 비활성화 상태');
      return;
    }
    
    startExtension();
  });
}

function startExtension() {
  // 설정 로드
  let settings = {
    maxHistorySize: 150,
    debounceTime: 100,
    showUIButtons: true
  };

  // 설정 불러오기
  chrome.storage.sync.get(['maxHistorySize', 'debounceTime', 'showUIButtons'], (result) => {
    if (result.maxHistorySize) settings.maxHistorySize = result.maxHistorySize;
    if (result.debounceTime !== undefined) settings.debounceTime = result.debounceTime;
    if (result.showUIButtons !== undefined) settings.showUIButtons = result.showUIButtons;
    console.log('설정 로드:', settings);
  });

  // 각 에디터별 히스토리 관리자를 WeakMap으로 관리
  const editorHistoryMap = new WeakMap();
  const editorTimeouts = new WeakMap();
  const editorListeners = new WeakMap(); // 이벤트 리스너 추적용
  const editorLastContent = new WeakMap(); // 마지막 콘텐츠 추적 (스마트 저장용)
  let activeEditor = null;
  let editorIdCounter = 0;

  // 에디터의 히스토리 관리자 가져오기 또는 생성
  function getHistoryManager(editor) {
    if (!editorHistoryMap.has(editor)) {
      const manager = new EditorHistoryManager();
      manager.maxHistorySize = settings.maxHistorySize;
      editorHistoryMap.set(editor, manager);
    }
    return editorHistoryMap.get(editor);
  }

  // UI 버튼 생성 및 업데이트
  function createUndoRedoUI(editor) {
    // 설정에서 UI 버튼 표시가 비활성화되어 있으면 스킵
    if (!settings.showUIButtons) return;

    // 이미 UI가 있으면 스킵
    if (editor.querySelector('.stove-undo-ui')) return;

    const container = document.createElement('div');
    container.className = 'stove-undo-ui';
    container.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 4px;
      padding: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    // Undo 버튼
    const undoBtn = document.createElement('button');
    undoBtn.className = 'stove-undo-btn';
    undoBtn.innerHTML = '↶';
    undoBtn.title = '실행취소 (Ctrl+Z)';
    undoBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border: none;
      background: white;
      border-radius: 3px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;

    // Redo 버튼
    const redoBtn = document.createElement('button');
    redoBtn.className = 'stove-redo-btn';
    redoBtn.innerHTML = '↷';
    redoBtn.title = '다시실행 (Ctrl+Y)';
    redoBtn.style.cssText = undoBtn.style.cssText;

    // 호버 효과
    [undoBtn, redoBtn].forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#e3f2fd';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'white';
      });
    });

    // 클릭 이벤트
    undoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const historyManager = getHistoryManager(editor);
      historyManager.undo(editor);
      updateUndoRedoUI(editor);
    });

    redoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const historyManager = getHistoryManager(editor);
      historyManager.redo(editor);
      updateUndoRedoUI(editor);
    });

    container.appendChild(undoBtn);
    container.appendChild(redoBtn);

    // 에디터에 relative position 부여 (없으면)
    const editorPosition = window.getComputedStyle(editor).position;
    if (editorPosition === 'static') {
      editor.style.position = 'relative';
    }

    editor.appendChild(container);
    updateUndoRedoUI(editor);
  }

  // UI 버튼 상태 업데이트
  function updateUndoRedoUI(editor) {
    const container = editor.querySelector('.stove-undo-ui');
    if (!container) return;

    const historyManager = getHistoryManager(editor);
    const undoBtn = container.querySelector('.stove-undo-btn');
    const redoBtn = container.querySelector('.stove-redo-btn');

    // Undo 버튼 상태
    const canUndo = historyManager.currentIndex > 0;
    undoBtn.style.opacity = canUndo ? '1' : '0.3';
    undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    undoBtn.disabled = !canUndo;

    // Redo 버튼 상태
    const canRedo = historyManager.currentIndex < historyManager.history.length - 1;
    redoBtn.style.opacity = canRedo ? '1' : '0.3';
    redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    redoBtn.disabled = !canRedo;
  }

  // 에디터 정리 (메모리 누수 방지)
  function cleanupEditor(editor) {
    if (!editor.dataset.undoEnabled) return;

    console.log(`에디터 정리 중: ${editor.dataset.undoId}`);

    // UI 제거
    const uiContainer = editor.querySelector('.stove-undo-ui');
    if (uiContainer) {
      uiContainer.remove();
    }

    // 타임아웃 정리
    const timeout = editorTimeouts.get(editor);
    if (timeout) {
      clearTimeout(timeout);
      editorTimeouts.delete(editor);
    }

    // 이벤트 리스너 제거
    const listeners = editorListeners.get(editor);
    if (listeners) {
      editor.removeEventListener('input', listeners.handleInput);
      editor.removeEventListener('paste', listeners.handleInput);
      editor.removeEventListener('cut', listeners.handleInput);
      editor.removeEventListener('focus', listeners.handleFocus);
      editorListeners.delete(editor);
    }

    // 마지막 콘텐츠 정리
    editorLastContent.delete(editor);

    // 활성 에디터 초기화
    if (activeEditor === editor) {
      activeEditor = null;
    }

    // WeakMap의 항목은 자동으로 GC됨
    delete editor.dataset.undoEnabled;
    delete editor.dataset.undoId;
  }

  // 에디터 요소 찾기 (여러 선택자 시도)
  function findEditor() {
    const selectors = [
      '[contenteditable="true"]',
      'textarea.editor',
      '.editor-content',
      '.ql-editor',
      '.ProseMirror',
      'div[role="textbox"]',
      'textarea',
      '#editor'
    ];

    // 모든 선택자에서 찾은 에디터를 수집
    const allEditors = [];
    const seen = new Set();

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // 중복 제거 (같은 요소가 여러 선택자에 매칭될 수 있음)
          if (!seen.has(element)) {
            seen.add(element);
            allEditors.push(element);
          }
        });
      } catch (e) {
        console.warn(`선택자 실행 실패: ${selector}`, e);
      }
    });

    return allEditors;
  }

  // 에디터에 이벤트 리스너 추가
  function attachToEditor(editor) {
    if (editor.dataset.undoEnabled) return;
    editor.dataset.undoEnabled = 'true';

    // 고유 ID 할당
    if (!editor.dataset.undoId) {
      editor.dataset.undoId = `editor-${editorIdCounter++}`;
    }

    const historyManager = getHistoryManager(editor);
    console.log(`스토브 에디터 실행취소 기능 활성화됨 (ID: ${editor.dataset.undoId})`);

    // UI 버튼 생성
    createUndoRedoUI(editor);

    // 초기 상태 저장 (편집 모드에서 컨텐츠가 로드될 시간을 주기 위해 지연)
    setTimeout(() => {
      // 에디터가 여전히 DOM에 존재하는지 확인
      if (document.contains(editor) && editor.dataset.undoEnabled) {
        try {
          const initialContent = historyManager.getContent(editor);
          historyManager.saveState(initialContent, editor);
          editorLastContent.set(editor, initialContent); // 초기 콘텐츠 저장
          updateUndoRedoUI(editor);
        } catch (error) {
          console.error('초기 상태 저장 실패:', error);
        }
      }
    }, 500);

    // 스마트 입력 이벤트 리스너
    const handleInput = (event) => {
      const currentContent = historyManager.getContent(editor);
      const lastContent = editorLastContent.get(editor) || '';

      // 변경 크기 계산
      const changeDelta = Math.abs(currentContent.length - lastContent.length);

      // 동적 debounce 시간 결정
      let debounceTime = settings.debounceTime;

      // 대량 변경 (100자 이상) = 즉시 저장
      if (changeDelta >= 100) {
        debounceTime = 0;
        console.log(`대량 변경 감지 (${changeDelta}자) - 즉시 저장`);
      }
      // 붙여넣기/잘라내기 이벤트 = 즉시 저장
      else if (event && (event.type === 'paste' || event.type === 'cut')) {
        debounceTime = 0;
        console.log(`${event.type} 이벤트 - 즉시 저장`);
      }
      // 일반 타이핑 = 설정된 debounce 시간
      else {
        debounceTime = settings.debounceTime;
      }

      let saveTimeout = editorTimeouts.get(editor);
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const content = historyManager.getContent(editor);
        historyManager.saveState(content, editor);
        editorLastContent.set(editor, content); // 마지막 콘텐츠 업데이트
        updateUndoRedoUI(editor);
      }, debounceTime);
      editorTimeouts.set(editor, saveTimeout);
    };

    // 포커스 추적
    const handleFocus = () => {
      activeEditor = editor;
      console.log(`에디터 포커스: ${editor.dataset.undoId}`);
    };

    // 이벤트 리스너 등록
    editor.addEventListener('input', handleInput);
    editor.addEventListener('paste', handleInput);
    editor.addEventListener('cut', handleInput);
    editor.addEventListener('focus', handleFocus);

    // 리스너 저장 (나중에 제거할 수 있도록)
    editorListeners.set(editor, { handleInput, handleFocus });
  }

  // 키보드 이벤트 가로채기
  document.addEventListener('keydown', (e) => {
    if (!activeEditor) return;

    const historyManager = getHistoryManager(activeEditor);
    const isCtrlZ = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
    const isCtrlY = (e.ctrlKey || e.metaKey) && e.key === 'y';
    const isCtrlShiftZ = (e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey;

    if (isCtrlZ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (historyManager.undo(activeEditor)) {
        console.log(`실행취소 완료 (${activeEditor.dataset.undoId})`);
      }
    } else if (isCtrlY || isCtrlShiftZ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (historyManager.redo(activeEditor)) {
        console.log(`다시실행 완료 (${activeEditor.dataset.undoId})`);
      }
    }
  }, true); // 캡처 단계에서 처리

  // 에디터 감지 및 초기화
  function checkForEditors() {
    const editors = findEditor();
    editors.forEach(attachToEditor);
  }

  // 초기 실행
  checkForEditors();

  // DOM 변경 감시 (document.body가 준비된 후에만)
  function startObserver() {
    if (document.body) {
      let checkTimeout = null;

      const observer = new MutationObserver((mutations) => {
        // 제거된 에디터 감지 및 정리 (즉시 처리)
        mutations.forEach(mutation => {
          mutation.removedNodes.forEach(node => {
            // 제거된 노드가 에디터인지 확인
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.dataset && node.dataset.undoEnabled) {
                cleanupEditor(node);
              }
              // 자식 노드 중 에디터가 있는지 확인
              const childEditors = node.querySelectorAll ? node.querySelectorAll('[data-undo-enabled="true"]') : [];
              childEditors.forEach(cleanupEditor);
            }
          });
        });

        // 새 에디터 감지 (debounce 적용)
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(checkForEditors, 300);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      setTimeout(startObserver, 100);
    }
  }
  startObserver();

  // 주기적 체크 (일부 동적 에디터 대응)
  setInterval(checkForEditors, 2000);

  // 팝업에서 히스토리 요청 처리
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_HISTORY') {
      if (activeEditor) {
        const historyManager = getHistoryManager(activeEditor);
        const historyData = {
          editorId: activeEditor.dataset.undoId,
          currentIndex: historyManager.currentIndex,
          history: historyManager.history.map((state, index) => ({
            index: index,
            timestamp: state.timestamp,
            preview: state.content.substring(0, 100).replace(/<[^>]*>/g, ''), // HTML 태그 제거
            isCurrent: index === historyManager.currentIndex
          }))
        };
        sendResponse({ success: true, data: historyData });
      } else {
        sendResponse({ success: false, message: '활성 에디터가 없습니다' });
      }
      return true; // 비동기 응답을 위해 true 반환
    }

    if (request.type === 'JUMP_TO_HISTORY') {
      if (activeEditor && request.index !== undefined) {
        const historyManager = getHistoryManager(activeEditor);
        const targetIndex = request.index;

        if (targetIndex >= 0 && targetIndex < historyManager.history.length) {
          // 현재 인덱스에서 목표 인덱스로 이동
          historyManager.currentIndex = targetIndex;
          const state = historyManager.history[targetIndex];
          historyManager.restoreContent(activeEditor, state);
          historyManager.lastContent = state.content;
          updateUndoRedoUI(activeEditor);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, message: '잘못된 히스토리 인덱스' });
        }
      } else {
        sendResponse({ success: false, message: '활성 에디터가 없습니다' });
      }
      return true;
    }
  });
}

// 페이지 로드 완료 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEditorUndo);
} else {
  initializeEditorUndo();
}

// 즉시 실행도 시도
initializeEditorUndo();

// 설정 변경 감지
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.enabled) {
    const isEnabled = changes.enabled.newValue;
    console.log('설정 변경 감지:', isEnabled ? '활성화' : '비활성화');
    
    if (!isEnabled) {
      console.log('⚠️ 변경사항을 적용하려면 페이지를 새로고침하세요');
    }
  }
});