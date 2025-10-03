# 스토브 에디터 실행취소 확장 프로그램

스토브 커뮤니티 에디터에서 Ctrl+Z(실행취소) 기능을 활성화하는 크롬 확장 프로그램입니다.

## 📁 파일 구조

```
stove-undo-extension/
├── icon16.png          (기존 파일)
├── icon48.png          (기존 파일)
├── icon128.png         (기존 파일)
├── manifest.json
├── content.js
├── popup.html
├── popup.js
└── background.js
```

## 🚀 설치 방법

1. 모든 파일을 같은 폴더에 저장
2. 크롬에서 `chrome://extensions/` 접속
3. 우측 상단 "개발자 모드" 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. 폴더 선택

## ⌨️ 사용법

- **Ctrl+Z**: 실행취소
- **Ctrl+Y** 또는 **Ctrl+Shift+Z**: 다시실행
- 최대 50개 히스토리 저장
- 확장 프로그램 아이콘 클릭으로 활성화/비활성화 가능

## 📝 버전

- v1.0.0 - 초기 릴리즈