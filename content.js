// 히스토리 관리를 위한 클래스
class EditorHistoryManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = 50;
    this.lastContent = '';
    this.isUndoing = false;
    this.isRedoing = false;
  }

  saveState(content, element) {
    if (this.isUndoing || this.isRedoing) return;
    if (content === this.lastContent) return;

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
    if (this.currentIndex <= 0) return false;
    
    this.isUndoing = true;
    this.currentIndex--;
    const state = this.history[this.currentIndex];
    
    this.restoreContent(element, state);
    this.lastContent = state.content;
    
    setTimeout(() => { this.isUndoing = false; }, 0);
    return true;
  }

  redo(element) {
    if (this.currentIndex >= this.history.length - 1) return false;
    
    this.isRedoing = true;
    this.currentIndex++;
    const state = this.history[this.currentIndex];
    
    this.restoreContent(element, state);
    this.lastContent = state.content;
    
    setTimeout(() => { this.isRedoing = false; }, 0);
    return true;
  }

  restoreContent(element, state) {
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
  const historyManager = new EditorHistoryManager();
  let activeEditor = null;
  let saveTimeout = null;

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

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
    return [];
  }

  // 에디터에 이벤트 리스너 추가
  function attachToEditor(editor) {
    if (editor.dataset.undoEnabled) return;
    editor.dataset.undoEnabled = 'true';

    console.log('스토브 에디터 실행취소 기능 활성화됨');

    // 초기 상태 저장
    const initialContent = historyManager.getContent(editor);
    historyManager.saveState(initialContent, editor);

    // 입력 이벤트 리스너
    const handleInput = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const content = historyManager.getContent(editor);
        historyManager.saveState(content, editor);
      }, 300);
    };

    editor.addEventListener('input', handleInput);
    editor.addEventListener('paste', handleInput);
    editor.addEventListener('cut', handleInput);

    // 포커스 추적
    editor.addEventListener('focus', () => {
      activeEditor = editor;
    });
  }

  // 키보드 이벤트 가로채기
  document.addEventListener('keydown', (e) => {
    if (!activeEditor) return;

    const isCtrlZ = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
    const isCtrlY = (e.ctrlKey || e.metaKey) && e.key === 'y';
    const isCtrlShiftZ = (e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey;

    if (isCtrlZ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      if (historyManager.undo(activeEditor)) {
        console.log('실행취소 완료');
      }
    } else if (isCtrlY || isCtrlShiftZ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      if (historyManager.redo(activeEditor)) {
        console.log('다시실행 완료');
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
      const observer = new MutationObserver(checkForEditors);
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