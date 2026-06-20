import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function App() {
  // ── Notes list ──────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('dark');

  // ── Tab system ──────────────────────────────────────────────────────────────
  const [openTabs, setOpenTabs] = useState([]);

  // ── Left pane ───────────────────────────────────────────────────────────────
  const [activeNote, setActiveNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('Ready');
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview' | 'board'
  const leftTextareaRef = useRef(null);

  // ── Right pane / split view ─────────────────────────────────────────────────
  const [isSplitView, setIsSplitView] = useState(false);
  const [splitNote, setSplitNote] = useState(null);
  const [splitContent, setSplitContent] = useState('');
  const [splitSaveStatus, setSplitSaveStatus] = useState('Ready');
  const [splitRatio, setSplitRatio] = useState(50);
  const [splitViewMode, setSplitViewMode] = useState('edit'); // 'edit' | 'preview' | 'board'
  const rightTextareaRef = useRef(null);

  // Which pane receives the next sidebar click or is currently focused/active
  const [focusedPane, setFocusedPane] = useState('left');

  // ── Hover link preview state ──────────────────────────────────────────────
  const [hoverPreview, setHoverPreview] = useState(null); // { type, target, rect, title, content }

  // ── Passwords ─────────────────────────────────────────────────────────────────
  const [unlockedNotes, setUnlockedNotes] = useState({});
  const unlockedNotesRef = useRef({});

  // ── Pins ────────────────────────────────────────────────────────────────────
  const [pinnedNotes, setPinnedNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('agna_pinned') || '[]'); } catch { return []; }
  });

  // ── Password modal ──────────────────────────────────────────────────────────
  const [showPassModal, setShowPassModal] = useState(false);
  const [modalMode, setModalMode] = useState('unlock');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  // ── New Note Name Modal (Ctrl+T) ────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState('blank'); // 'blank' | 'jira' | 'meeting' | 'todo'
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const newNoteInputRef = useRef(null);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState({ pane: null, zone: null });

  // ── Share modal state ──────────────────────────────────────────────────────
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareStatus, setShareStatus] = useState('idle'); // 'idle' | 'generating' | 'success' | 'error'
  const [shareError, setShareError] = useState('');
  const [generatedPdfPath, setGeneratedPdfPath] = useState('');

  // ── Window / sidebar ────────────────────────────────────────────────────────
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem('agna_sidebar_pinned') || 'false'); } catch { return false; }
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const noteContentRef = useRef('');
  const splitContentRef = useRef('');
  const activeNoteRef = useRef(null);
  const splitNoteRef = useRef(null);
  const lastActiveNoteRef = useRef(null);
  const isDraggingDividerRef = useRef(false);

  const saveTimeoutRef = useRef(null);
  const splitSaveTimeoutRef = useRef(null);
  const sidebarLeaveTimerRef = useRef(null);

  // Spotlight refs
  const containerRef = useRef(null);
  const blob1Ref = useRef(null);
  const blob2Ref = useRef(null);
  const blob3Ref = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const pos1Ref = useRef({ x: -1000, y: -1000 });
  const pos2Ref = useRef({ x: -1000, y: -1000 });
  const pos3Ref = useRef({ x: -1000, y: -1000 });

  // Sync state → refs
  useEffect(() => { noteContentRef.current = noteContent; }, [noteContent]);
  useEffect(() => { splitContentRef.current = splitContent; }, [splitContent]);
  useEffect(() => { activeNoteRef.current = activeNote; }, [activeNote]);
  useEffect(() => { splitNoteRef.current = splitNote; }, [splitNote]);

  // ── Sidebar hover ───────────────────────────────────────────────────────────
  const handleSidebarEnter = () => {
    if (sidebarLeaveTimerRef.current) { clearTimeout(sidebarLeaveTimerRef.current); sidebarLeaveTimerRef.current = null; }
    setIsSidebarHovered(true);
  };
  const handleSidebarLeave = () => {
    sidebarLeaveTimerRef.current = setTimeout(() => setIsSidebarHovered(false), 300);
  };

  // ── Window state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.electronAPI?.onWindowStateChanged) {
      window.electronAPI.onWindowStateChanged(state => setIsMaximized(state.isMaximized));
    }
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+T → New note with name dialog
      if (mod && e.key === 't') {
        e.preventDefault();
        setNewNoteName('Untitled');
        setShowNewNoteModal(true);
        setTimeout(() => { newNoteInputRef.current?.select(); }, 60);
        return;
      }

      // Ctrl+Q → Toggle split view
      if (mod && e.key === 'q') {
        e.preventDefault();
        setIsSplitView(prev => {
          if (prev) { setSplitNote(null); setSplitContent(''); setSplitSaveStatus('Ready'); }
          return !prev;
        });
        return;
      }

      // Escape → dismiss modals
      if (e.key === 'Escape') {
        if (showNewNoteModal) { setShowNewNoteModal(false); return; }
        if (showPassModal) {
          if (modalMode === 'unlock') {
            dismissPassModal(true);
          } else {
            dismissPassModal(false);
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showNewNoteModal, showPassModal, modalMode]);

  const dismissPassModal = (shouldRestore = false) => {
    setShowPassModal(false);
    setPasswordInput('');
    setPasswordConfirm('');
    setPasswordError('');
    if (shouldRestore && modalMode === 'unlock') {
      if (lastActiveNoteRef.current) {
        const prev = lastActiveNoteRef.current;
        lastActiveNoteRef.current = null;
        loadNoteIntoPane(prev, 'left');
      } else {
        setActiveNote(null);
        setNoteContent('');
        setNoteTitle('');
      }
    }
  };

  // ── Split View Draggable Divider Handler ──────────────────────────────────
  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    isDraggingDividerRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDividerRef.current) return;
      const editorArea = document.querySelector('.editor-area');
      if (editorArea) {
        const rect = editorArea.getBoundingClientRect();
        let ratio = ((e.clientX - rect.left) / rect.width) * 100;
        if (ratio < 20) ratio = 20;
        if (ratio > 80) ratio = 80;
        setSplitRatio(ratio);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingDividerRef.current) {
        isDraggingDividerRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ── Spotlight animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };
    let animId; let time = 0;
    const animate = () => {
      time += 0.04;
      const t = mouseRef.current;
      const x1 = pos1Ref.current.x + (t.x - pos1Ref.current.x) * 0.14;
      const y1 = pos1Ref.current.y + (t.y - pos1Ref.current.y) * 0.14;
      pos1Ref.current = { x: x1, y: y1 };
      const x2 = pos2Ref.current.x + (t.x + Math.sin(time) * 10 - pos2Ref.current.x) * 0.09;
      const y2 = pos2Ref.current.y + (t.y + Math.cos(time) * 10 - pos2Ref.current.y) * 0.09;
      pos2Ref.current = { x: x2, y: y2 };
      const x3 = pos3Ref.current.x + (t.x + Math.cos(time * 0.7) * 16 - pos3Ref.current.x) * 0.06;
      const y3 = pos3Ref.current.y + (t.y + Math.sin(time * 0.7) * 16 - pos3Ref.current.y) * 0.06;
      pos3Ref.current = { x: x3, y: y3 };
      if (blob1Ref.current) blob1Ref.current.style.transform = `translate3d(${x1}px,${y1}px,0) translate(-50%,-50%)`;
      if (blob2Ref.current) blob2Ref.current.style.transform = `translate3d(${x2}px,${y2}px,0) translate(-50%,-50%)`;
      if (blob3Ref.current) blob3Ref.current.style.transform = `translate3d(${x3}px,${y3}px,0) translate(-50%,-50%)`;
      animId = requestAnimationFrame(animate);
    };
    const container = containerRef.current;
    if (container) { container.addEventListener('mousemove', handleMouseMove); animate(); }
    return () => { container?.removeEventListener('mousemove', handleMouseMove); cancelAnimationFrame(animId); };
  }, []);

  useEffect(() => { fetchNotes(); document.body.className = `theme-${theme}`; }, [theme]);
  useEffect(() => { localStorage.setItem('agna_pinned', JSON.stringify(pinnedNotes)); }, [pinnedNotes]);
  useEffect(() => { localStorage.setItem('agna_sidebar_pinned', JSON.stringify(isSidebarPinned)); }, [isSidebarPinned]);

  // ── Fetch notes ──────────────────────────────────────────────────────────────
  const fetchNotes = async (selectFilename = null) => {
    try {
      const list = await window.electronAPI.getNotes();
      setNotes(list);
      if (selectFilename) {
        const found = list.find(n => n.filename === selectFilename);
        if (found) await loadNoteIntoPane(found, 'left');
      } else if (list.length > 0 && !activeNoteRef.current) {
        await loadNoteIntoPane(list[0], 'left');
      }
    } catch (err) { console.error('Error fetching notes:', err); }
  };

  // ── Tab management ───────────────────────────────────────────────────────────
  const addTab = (note) => {
    setOpenTabs(prev => {
      if (prev.find(t => t.filename === note.filename)) return prev;
      return [...prev, {
        filename: note.filename,
        title: note.title,
        isEncrypted: note.isEncrypted,
        isWeb: note.isWeb,
        url: note.url
      }];
    });
  };

  const closeTab = (filename, e) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t.filename !== filename);
      if (activeNoteRef.current?.filename === filename) {
        const fallback = next[next.length - 1];
        if (fallback) {
          const n = notes.find(n => n.filename === fallback.filename);
          if (n) loadNoteIntoPane(n, 'left');
        } else { setActiveNote(null); setNoteContent(''); setNoteTitle(''); }
      }
      if (splitNoteRef.current?.filename === filename) { setSplitNote(null); setSplitContent(''); }
      return next;
    });
  };

  // ── Core: load a note into a pane ────────────────────────────────────────────
  const loadNoteIntoPane = async (note, pane) => {
    dismissPassModal(false);

    // Flush pending saves
    if (pane === 'left' && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null;
      await savePaneNow('left');
    }
    if (pane === 'right' && splitSaveTimeoutRef.current) {
      clearTimeout(splitSaveTimeoutRef.current); splitSaveTimeoutRef.current = null;
      await savePaneNow('right');
    }

    addTab(note);

    if (note.isEncrypted) {
      if (activeNoteRef.current && activeNoteRef.current.filename !== note.filename) {
        lastActiveNoteRef.current = activeNoteRef.current;
      } else if (!activeNoteRef.current) {
        lastActiveNoteRef.current = null;
      }

      const savedPass = unlockedNotesRef.current[note.filename];
      if (savedPass) {
        try {
          const res = await window.electronAPI.decryptNote(note.filename, savedPass);
          if (res.success) {
            applyPaneNote(pane, note, res.content);
            return;
          }
          unlockedNotesRef.current = { ...unlockedNotesRef.current };
          delete unlockedNotesRef.current[note.filename];
          setUnlockedNotes({ ...unlockedNotesRef.current });
        } catch { /* fall through to prompt */ }
      }
      applyPaneNote(pane, note, '');
      openPasswordModal('unlock');
    } else {
      try {
        const content = await window.electronAPI.readNote(note.filename);
        applyPaneNote(pane, note, content || '');
      } catch (err) {
        console.error('Error reading note:', err);
        applyPaneNote(pane, note, '');
      }
    }
  };

  const applyPaneNote = (pane, note, content) => {
    const isBoard = content && content.includes('<!-- type: board -->');
    if (pane === 'left') {
      setActiveNote(note);
      setNoteTitle(note.title);
      setNoteContent(content);
      noteContentRef.current = content;
      setSaveStatus('Ready');
      if (viewMode === 'board' && !isBoard && !note.isWeb) {
        setViewMode('edit');
      }
    } else {
      setSplitNote(note);
      setSplitContent(content);
      splitContentRef.current = content;
      setSplitSaveStatus('Ready');
      if (splitViewMode === 'board' && !isBoard && !note.isWeb) {
        setSplitViewMode('edit');
      }
    }
  };

  const openPasswordModal = (mode) => {
    setPasswordInput('');
    setPasswordConfirm('');
    setPasswordError('');
    setModalMode(mode);
    setShowPassModal(true);
  };

  // ── Note select from sidebar ─────────────────────────────────────────────────
  const handleNoteSelect = async (note, targetPane = null) => {
    const pane = targetPane || (isSplitView ? focusedPane : 'left');
    if (pane === 'left' && activeNoteRef.current?.filename === note.filename) {
      return;
    }
    if (pane === 'right' && splitNoteRef.current?.filename === note.filename) {
      return;
    }

    // Encrypted notes always open full-width in left pane — close split view
    if (note.isEncrypted) {
      setIsSplitView(false);
      setSplitNote(null); setSplitContent(''); setSplitSaveStatus('Ready');
      await loadNoteIntoPane(note, 'left');
    } else {
      await loadNoteIntoPane(note, pane);
    }
    setIsSidebarHovered(false);
  };

  // ── Drag & Drop handlers ─────────────────────────────────────────────────────
  const handleDragStart = (e, note) => {
    setDraggedNote(note);
    e.dataTransfer.effectAllowed = 'link';
    e.dataTransfer.setData('text/plain', note.filename);
  };

  const handleDragEnd = () => {
    setDraggedNote(null);
    setDragOverTarget({ pane: null, zone: null });
  };

  const handleDropZoneDragOver = (e, pane) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;

    let zone = 'center';
    if (!isSplitView) {
      if (ratio < 0.25) {
        zone = 'left-split';
      } else if (ratio > 0.75) {
        zone = 'right-split';
      }
    }
    setDragOverTarget({ pane, zone });
  };

  const handleDropZoneDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTarget({ pane: null, zone: null });
    }
  };

  const handleDropOnPane = async (e, pane) => {
    e.preventDefault();
    const zone = dragOverTarget.zone;
    setDragOverTarget({ pane: null, zone: null });
    if (!draggedNote) return;

    if (zone === 'right-split') {
      if (draggedNote.isEncrypted) { setDraggedNote(null); return; }
      setIsSplitView(true);
      await loadNoteIntoPane(draggedNote, 'right');
    } else if (zone === 'left-split') {
      if (draggedNote.isEncrypted) { setDraggedNote(null); return; }
      setIsSplitView(true);
      const currentActive = activeNote;
      await loadNoteIntoPane(draggedNote, 'left');
      if (currentActive) {
        await loadNoteIntoPane(currentActive, 'right');
      }
    } else {
      await loadNoteIntoPane(draggedNote, pane);
    }
    setDraggedNote(null);
  };

  // ── Save helpers ─────────────────────────────────────────────────────────────
  const savePaneNow = async (pane) => {
    const note = pane === 'left' ? activeNoteRef.current : splitNoteRef.current;
    const content = pane === 'left' ? noteContentRef.current : splitContentRef.current;
    const setStatus = pane === 'left' ? setSaveStatus : setSplitSaveStatus;
    if (!note) return;
    try {
      if (note.isEncrypted) {
        const pass = unlockedNotesRef.current[note.filename];
        if (pass) { await window.electronAPI.decryptAndSave(note.filename, pass, content); setStatus('Saved'); }
        else { setStatus('Locked'); }
      } else {
        await window.electronAPI.writeNote(note.filename, content);
        setStatus('Saved');
      }
    } catch (e) { setStatus('Error'); console.error('Save failed:', e); }
  };

  const handleContentChange = (pane, val) => {
    if (pane === 'left') {
      setNoteContent(val); noteContentRef.current = val;
      setSaveStatus('Saving...');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => savePaneNow('left'), 600);
    } else {
      setSplitContent(val); splitContentRef.current = val;
      setSplitSaveStatus('Saving...');
      if (splitSaveTimeoutRef.current) clearTimeout(splitSaveTimeoutRef.current);
      splitSaveTimeoutRef.current = setTimeout(() => savePaneNow('right'), 600);
    }
  };

  // ── Note Template Skeletons ──────────────────────────────────────────────
  const TEMPLATE_SKELETONS = {
    blank: '',
    blank_board: `<!-- type: board -->\n# New Board\n\n## Tasks\n- [ ] task: First task`,
    jira: `<!-- type: board -->\n# Sprint Daily Board\n\nSprint Goal: Complete Agna editor polishing.\n\n## Standup Checklist\n- [ ] task: Deploy native Windows 11 Acrylic layout\n- [/] task: Fix split view event handlers\n- [x] task: Configure keybinding overlays\n- [ ] task: Connect link preview modal`,
    meeting: `# Meeting Notes\n\n**Date**: ${new Date().toLocaleDateString()}\n**Attendees**: Team Agna\n\n## Agenda\n1. Review drag-and-drop split view UX\n2. Discuss link hover popups\n\n## Action Items\n- [ ] task: Clean up redundant CSS classes\n- [ ] task: Test password unlocking edge cases`,
    todo: `<!-- type: board -->\n# Task Board\n\n## Priorities\n- [ ] task: Complete Jira Kanban board clone\n- [ ] task: Fix stale note references\n- [x] task: Refactor locked note password fields`
  };

  // ── Formatting toolbar insert helper ─────────────────────────────────────────
  const insertMarkdown = (pane, format) => {
    const ref = pane === 'left' ? leftTextareaRef : rightTextareaRef;
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (format) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        cursorOffset = selected ? replacement.length : 1;
        break;
      case 'header':
        replacement = `\n## ${selected || 'Heading'}\n`;
        cursorOffset = replacement.length;
        break;
      case 'bullet':
        replacement = `\n- ${selected || 'item'}`;
        cursorOffset = replacement.length;
        break;
      case 'number':
        replacement = `\n1. ${selected || 'item'}`;
        cursorOffset = replacement.length;
        break;
      case 'task':
        replacement = `\n- [ ] task: ${selected || 'new task'}`;
        cursorOffset = replacement.length;
        break;
      case 'code':
        replacement = `\n\`\`\`\n${selected || 'code'}\n\`\`\`\n`;
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    const val = text.substring(0, start) + replacement + text.substring(end);
    handleContentChange(pane, val);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 50);
  };

  // ── Jira Kanban Board Parser and Helpers ─────────────────────────────────────
  const parseBoardTasks = (content) => {
    const lines = content.split('\n');
    const tasks = [];
    const regex = /^\s*-\s+\[([ x/])\]\s*(.*)$/i;

    lines.forEach((line, index) => {
      const match = line.match(regex);
      if (match) {
        const statusChar = match[1].toLowerCase();
        let status = 'todo';
        if (statusChar === '/') status = 'progress';
        else if (statusChar === 'x') status = 'done';

        // Strip clean display text (remove task: prefix if present)
        let rawText = match[2].trim();
        let text = rawText.replace(/^task:\s*/i, '');

        tasks.push({
          id: `task-${index}`,
          lineIndex: index,
          rawText,
          text,
          status
        });
      }
    });
    return tasks;
  };

  const moveBoardTask = async (pane, lineIndex, newStatus) => {
    const content = pane === 'left' ? noteContentRef.current : splitContentRef.current;
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    let char = ' ';
    if (newStatus === 'progress') char = '/';
    else if (newStatus === 'done') char = 'x';

    const line = lines[lineIndex];
    lines[lineIndex] = line.replace(/(^\s*-\s+\[)([ x/])(\]\s*.*)$/i, `$1${char}$3`);
    const nextVal = lines.join('\n');

    handleContentChange(pane, nextVal);
    await savePaneNow(pane);
  };

  const addBoardTask = (pane, column) => {
    const content = pane === 'left' ? noteContentRef.current : splitContentRef.current;
    let char = ' ';
    if (column === 'progress') char = '/';
    else if (column === 'done') char = 'x';

    const lineToAdd = `\n- [${char}] task: New Task`;
    const nextVal = content.endsWith('\n') ? `${content}- [${char}] task: New Task` : `${content}\n- [${char}] task: New Task`;
    handleContentChange(pane, nextVal);
    savePaneNow(pane);
  };

  const editBoardTaskText = (pane, lineIndex, newText) => {
    const content = pane === 'left' ? noteContentRef.current : splitContentRef.current;
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    // Keep task: prefix if present in original line
    const isJiraTask = /\[[ x/]\]\s*task:/i.test(line);
    const prefix = isJiraTask ? 'task: ' : '';

    lines[lineIndex] = line.replace(/(^\s*-\s+\[[ x/]\]\s*)(.*)$/i, `$1${prefix}${newText}`);
    const nextVal = lines.join('\n');
    handleContentChange(pane, nextVal);
    savePaneNow(pane);
  };

  const deleteBoardTask = (pane, lineIndex) => {
    const content = pane === 'left' ? noteContentRef.current : splitContentRef.current;
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    lines.splice(lineIndex, 1);
    const nextVal = lines.join('\n');
    handleContentChange(pane, nextVal);
    savePaneNow(pane);
  };

  const renderKanbanBoard = (pane, content) => {
    const tasks = parseBoardTasks(content);
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const progressTasks = tasks.filter(t => t.status === 'progress');
    const doneTasks = tasks.filter(t => t.status === 'done');

    const handleColumnDrop = (e, column) => {
      e.preventDefault();
      try {
        const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (dragData.pane === pane) {
          moveBoardTask(pane, dragData.lineIndex, column);
        }
      } catch (err) {}
    };

    return (
      <div className="kanban-board">
        {/* TO DO COLUMN */}
        <div className="kanban-column" onDragOver={e => e.preventDefault()} onDrop={e => handleColumnDrop(e, 'todo')}>
          <div className="kanban-column-header">
            <span className="column-title">To Do</span>
            <span className="column-count">{todoTasks.length}</span>
          </div>
          <div className="kanban-cards-container">
            {todoTasks.map(t => (
              <div
                key={t.id}
                className="kanban-card"
                draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ lineIndex: t.lineIndex, pane }))}
              >
                <div
                  className="kanban-card-text"
                  contentEditable
                  onBlur={e => editBoardTaskText(pane, t.lineIndex, e.target.innerText.trim())}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  suppressContentEditableWarning
                >
                  {t.text}
                </div>
                <button className="kanban-card-delete" onClick={() => deleteBoardTask(pane, t.lineIndex)}>×</button>
              </div>
            ))}
          </div>
          <button className="add-task-btn" onClick={() => addBoardTask(pane, 'todo')}>+ Add Card</button>
        </div>

        {/* IN PROGRESS COLUMN */}
        <div className="kanban-column" onDragOver={e => e.preventDefault()} onDrop={e => handleColumnDrop(e, 'progress')}>
          <div className="kanban-column-header">
            <span className="column-title">In Progress</span>
            <span className="column-count">{progressTasks.length}</span>
          </div>
          <div className="kanban-cards-container">
            {progressTasks.map(t => (
              <div
                key={t.id}
                className="kanban-card progress"
                draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ lineIndex: t.lineIndex, pane }))}
              >
                <div
                  className="kanban-card-text"
                  contentEditable
                  onBlur={e => editBoardTaskText(pane, t.lineIndex, e.target.innerText.trim())}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  suppressContentEditableWarning
                >
                  {t.text}
                </div>
                <button className="kanban-card-delete" onClick={() => deleteBoardTask(pane, t.lineIndex)}>×</button>
              </div>
            ))}
          </div>
          <button className="add-task-btn" onClick={() => addBoardTask(pane, 'progress')}>+ Add Card</button>
        </div>

        {/* DONE COLUMN */}
        <div className="kanban-column" onDragOver={e => e.preventDefault()} onDrop={e => handleColumnDrop(e, 'done')}>
          <div className="kanban-column-header">
            <span className="column-title">Done</span>
            <span className="column-count">{doneTasks.length}</span>
          </div>
          <div className="kanban-cards-container">
            {doneTasks.map(t => (
              <div
                key={t.id}
                className="kanban-card done"
                draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ lineIndex: t.lineIndex, pane }))}
              >
                <div
                  className="kanban-card-text"
                  contentEditable
                  onBlur={e => editBoardTaskText(pane, t.lineIndex, e.target.innerText.trim())}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  suppressContentEditableWarning
                >
                  {t.text}
                </div>
                <button className="kanban-card-delete" onClick={() => deleteBoardTask(pane, t.lineIndex)}>×</button>
              </div>
            ))}
          </div>
          <button className="add-task-btn" onClick={() => addBoardTask(pane, 'done')}>+ Add Card</button>
        </div>
      </div>
    );
  };

  // ── Markdown Preview & Wiki-Link Popups ──────────────────────────────────────
  const parseMarkdownToHtml = (content) => {
    if (!content) return '<p style="opacity:0.5; font-style:italic;">Empty note. Switch to Edit mode to start writing...</p>';

    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Checklist tasks (Jira-style tasks)
    html = html.replace(/^\s*-\s+\[ \]\s*(task:\s*)?(.*$)/gim, '<li class="task-li todo-task"><input type="checkbox" disabled /> <span>$2</span></li>');
    html = html.replace(/^\s*-\s+\[\/\]\s*(task:\s*)?(.*$)/gim, '<li class="task-li progress-task"><input type="checkbox" disabled checked class="progress-box" /> <span class="progress-span">$2</span></li>');
    html = html.replace(/^\s*-\s+\[x\]\s*(task:\s*)?(.*$)/gim, '<li class="task-li done-task"><input type="checkbox" disabled checked /> <span class="done-span">$2</span></li>');

    // Standard list items
    html = html.replace(/^\s*-\s+(?!\[[ x/]\])(.*$)/gim, '<li>$1</li>');

    // External Markdown Links: [Text](URL)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" data-link-type="external" data-link-target="$2" class="markdown-link external-link">$1</a>');

    // Internal Note Wiki-Links: [[Note Title]]
    html = html.replace(/\[\[([^\]]+)\]\]/gim, (match, noteName) => {
      const targetFile = noteName.trim().endsWith('.md') || noteName.trim().endsWith('.agna') ? noteName.trim() : `${noteName.trim()}.md`;
      return `<a href="#" data-link-type="internal" data-link-target="${targetFile}" class="markdown-link internal-link">[[${noteName.trim()}]]</a>`;
    });

    // Paragraph split (by linebreaks)
    html = html.split('\n').join('<br />');

    return html;
  };

  const getYouTubeEmbedUrl = (url) => {
    let videoId = null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v');
        if (!videoId && parsed.pathname.startsWith('/embed/')) {
          return url;
        }
      } else if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.substring(1);
      }
    } catch (e) {}
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
  };

  const openWebPreviewTab = (url) => {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (embedUrl) {
      const fakeNote = {
        filename: `web-${url}`,
        title: 'YouTube Preview',
        isWeb: true,
        url: embedUrl
      };
      addTab(fakeNote);
      const pane = isSplitView ? focusedPane : 'left';
      applyPaneNote(pane, fakeNote, '');
    } else {
      window.open(url, '_blank');
    }
  };

  const handlePreviewMouseMove = async (e) => {
    const target = e.target.closest('a[data-link-type]');
    if (!target) return;

    const type = target.getAttribute('data-link-type');
    const linkTarget = target.getAttribute('data-link-target');
    const rect = target.getBoundingClientRect();

    if (hoverPreview?.target === linkTarget) return;

    if (type === 'internal') {
      try {
        const raw = await window.electronAPI.readNote(linkTarget);
        const cleanSnippet = raw ? raw.replace(/[#*`[\]]/g, '').slice(0, 150) + (raw.length > 150 ? '...' : '') : 'Empty note.';
        setHoverPreview({
          type: 'internal',
          target: linkTarget,
          rect,
          title: linkTarget.replace(/\.(md|agna)$/i, ''),
          content: cleanSnippet
        });
      } catch {
        setHoverPreview({
          type: 'internal',
          target: linkTarget,
          rect,
          title: linkTarget.replace(/\.(md|agna)$/i, ''),
          content: 'Note not yet created. Click to create it!'
        });
      }
    } else {
      const embedUrl = getYouTubeEmbedUrl(linkTarget);
      if (embedUrl) {
        const videoId = embedUrl.split('/embed/')[1];
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        setHoverPreview({
          type: 'external',
          target: linkTarget,
          rect,
          title: 'YouTube Video',
          content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '220px' }}>
              <img src={thumbnailUrl} alt="YouTube Thumbnail" style={{ width: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '11px', opacity: 0.8, color: 'var(--text-secondary)' }}>Click to preview in new editor tab</span>
            </div>
          )
        });
      } else {
        setHoverPreview({
          type: 'external',
          target: linkTarget,
          rect,
          title: 'External Link',
          content: linkTarget
        });
      }
    }
  };

  const handlePreviewMouseLeave = () => {
    setHoverPreview(null);
  };

  const handlePreviewClick = async (e) => {
    const target = e.target.closest('a[data-link-type]');
    if (!target) return;
    e.preventDefault();

    const type = target.getAttribute('data-link-type');
    const linkTarget = target.getAttribute('data-link-target');

    if (type === 'internal') {
      const found = notes.find(n => n.filename.toLowerCase() === linkTarget.toLowerCase());
      if (found) {
        await handleNoteSelect(found);
      } else {
        if (window.confirm(`Create new note "${linkTarget.replace(/\.md$/, '')}"?`)) {
          await window.electronAPI.writeNote(linkTarget, `# ${linkTarget.replace(/\.md$/, '')}\n`);
          await fetchNotes(linkTarget);
        }
      }
    } else {
      openWebPreviewTab(linkTarget);
    }
  };

  // ── Create with name (Ctrl+T popup) ─────────────────────────────────────────
  const handleCreateNoteWithName = async () => {
    const clean = (newNoteName || 'Untitled').trim().replace(/[\\/:*?"<>|]/g, ' ') || 'Untitled';
    let filename = `${clean}.md`; let c = 1;
    const exists = (n) => notes.some(x => x.filename.toLowerCase() === n.toLowerCase());
    while (exists(filename)) { filename = `${clean} (${c}).md`; c++; }
    setShowNewNoteModal(false);
    const content = TEMPLATE_SKELETONS[selectedTemplate] || '';
    await window.electronAPI.writeNote(filename, content);
    await fetchNotes(filename);
  };

  // ── Create / Delete / Rename ─────────────────────────────────────────────────
  const handleCreateNote = () => {
    setNewNoteName('Untitled');
    setSelectedTemplate('blank');
    setShowNewNoteModal(true);
    setTimeout(() => { newNoteInputRef.current?.select(); }, 60);
  };

  const handleDeleteNote = async () => {
    if (!activeNote) return;
    if (!window.confirm(`Delete "${activeNote.title}"?`)) return;
    if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
    await window.electronAPI.deleteNote(activeNote.filename);
    setPinnedNotes(prev => prev.filter(f => f !== activeNote.filename));
    setOpenTabs(prev => prev.filter(t => t.filename !== activeNote.filename));
    const remaining = notes.filter(n => n.filename !== activeNote.filename);
    setNotes(remaining);
    setActiveNote(null); setNoteContent(''); setNoteTitle('');
    if (remaining.length > 0) await loadNoteIntoPane(remaining[0], 'left');
  };

  const handleRenameCommit = async () => {
    const note = activeNoteRef.current;
    if (!note) return;
    let clean = noteTitle.trim().replace(/[\\/:*?"<>|]/g, ' ') || 'Untitled';
    const ext = note.isEncrypted ? '.agna' : '.md';
    let newFilename = `${clean}${ext}`;
    if (newFilename === note.filename) return;
    let c = 1;
    const exists = (n) => notes.some(x => x.filename.toLowerCase() === n.toLowerCase() && x.filename !== note.filename);
    while (exists(newFilename)) { newFilename = `${clean} (${c})${ext}`; c++; }
    try {
      const res = await window.electronAPI.renameNote(note.filename, newFilename);
      if (res.success) {
        if (note.isEncrypted && unlockedNotesRef.current[note.filename]) {
          const pass = unlockedNotesRef.current[note.filename];
          unlockedNotesRef.current = { ...unlockedNotesRef.current };
          delete unlockedNotesRef.current[note.filename];
          unlockedNotesRef.current[newFilename] = pass;
          setUnlockedNotes({ ...unlockedNotesRef.current });
        }
        if (pinnedNotes.includes(note.filename)) {
          setPinnedNotes(prev => prev.map(f => f === note.filename ? newFilename : f));
        }
        setOpenTabs(prev => prev.map(t => t.filename === note.filename ? { ...t, filename: newFilename, title: clean } : t));
        await fetchNotes(newFilename);
      }
    } catch (err) { console.error('Rename failed:', err); }
  };

  // ── Lock system ──────────────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    const note = activeNoteRef.current;
    if (!note) return;

    if (modalMode === 'unlock') {
      try {
        const res = await window.electronAPI.decryptNote(note.filename, passwordInput);
        if (res.success) {
          unlockedNotesRef.current = { ...unlockedNotesRef.current, [note.filename]: passwordInput };
          setUnlockedNotes({ ...unlockedNotesRef.current });
          setNoteContent(res.content);
          noteContentRef.current = res.content;
          setShowPassModal(false);
          setPasswordInput('');
        } else {
          triggerShake('Incorrect password');
        }
      } catch { triggerShake('Decryption error'); }

    } else if (modalMode === 'lock') {
      if (!passwordInput) { triggerShake('Password cannot be empty'); return; }
      if (passwordInput !== passwordConfirm) { triggerShake('Passwords do not match'); return; }

      if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
      const contentToEncrypt = noteContentRef.current;

      try {
        const res = await window.electronAPI.encryptNote(note.filename, passwordInput, contentToEncrypt);
        if (res.success) {
          unlockedNotesRef.current = { ...unlockedNotesRef.current, [res.newFilename]: passwordInput };
          setUnlockedNotes({ ...unlockedNotesRef.current });

          setIsSplitView(false);
          setSplitNote(null); setSplitContent(''); setSplitSaveStatus('Ready');

          setOpenTabs(prev => prev.map(t =>
            t.filename === note.filename ? { ...t, filename: res.newFilename, isEncrypted: true } : t
          ));
          setShowPassModal(false);
          setPasswordInput(''); setPasswordConfirm('');
          await fetchNotes(res.newFilename);
        } else { triggerShake('Encryption failed'); }
      } catch { triggerShake('Encryption failed'); }

    } else if (modalMode === 'unlock-permanent') {
      try {
        const res = await window.electronAPI.decryptToPlain(note.filename, passwordInput);
        if (res.success) {
          unlockedNotesRef.current = { ...unlockedNotesRef.current };
          delete unlockedNotesRef.current[note.filename];
          setUnlockedNotes({ ...unlockedNotesRef.current });

          if (pinnedNotes.includes(note.filename)) {
            setPinnedNotes(prev => prev.map(f => f === note.filename ? res.newFilename : f));
          }
          setOpenTabs(prev => prev.map(t =>
            t.filename === note.filename ? { ...t, filename: res.newFilename, isEncrypted: false } : t
          ));
          setShowPassModal(false);
          setPasswordInput('');
          await fetchNotes(res.newFilename);
        } else { triggerShake('Incorrect password'); }
      } catch { triggerShake('Decryption failed'); }
    }
  };

  const handleLockToggleClick = () => {
    const note = activeNoteRef.current;
    if (!note) return;
    if (note.isEncrypted) {
      const pass = unlockedNotesRef.current[note.filename];
      if (pass) { handleAutoUnlock(pass); }
      else { openPasswordModal('unlock-permanent'); }
    } else {
      openPasswordModal('lock');
    }
  };

  const handleAutoUnlock = async (pass) => {
    const note = activeNoteRef.current;
    if (!note) return;
    try {
      const res = await window.electronAPI.decryptToPlain(note.filename, pass);
      if (res.success) {
        unlockedNotesRef.current = { ...unlockedNotesRef.current };
        delete unlockedNotesRef.current[note.filename];
        setUnlockedNotes({ ...unlockedNotesRef.current });

        if (pinnedNotes.includes(note.filename)) {
          setPinnedNotes(prev => prev.map(f => f === note.filename ? res.newFilename : f));
        }
        setOpenTabs(prev => prev.map(t =>
          t.filename === note.filename ? { ...t, filename: res.newFilename, isEncrypted: false } : t
        ));
        await fetchNotes(res.newFilename);
      }
    } catch (err) { console.error('Auto-unlock failed:', err); }
  };

  const triggerShake = (msg) => {
    setPasswordError(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  // ── Misc ─────────────────────────────────────────────────────────────────────
  const handlePinToggle = () => {
    if (!activeNote) return;
    const pinned = pinnedNotes.includes(activeNote.filename);
    setPinnedNotes(prev => pinned ? prev.filter(f => f !== activeNote.filename) : [...prev, activeNote.filename]);
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleCopyNote = () => {
    if (!noteContent) return;
    navigator.clipboard.writeText(noteContent);
    setSaveStatus('Copied!');
    setTimeout(() => setSaveStatus('Ready'), 2000);
  };

  const handleShareWhatsApp = async (pane) => {
    const note = pane === 'left' ? activeNote : splitNote;
    const content = pane === 'left' ? noteContent : splitContent;
    if (!note) return;

    setShowShareModal(true);
    setShareStatus('generating');
    setShareError('');

    try {
      const title = note.title;
      const html = parseMarkdownToHtml(content);

      const res = await window.electronAPI.shareNotePdf(title, html, theme);
      if (res.success) {
        setShareStatus('success');
        setGeneratedPdfPath(res.pdfPath);
        window.open('whatsapp://', '_blank');
      } else {
        setShareStatus('error');
        setShareError(res.error || 'Failed to generate PDF');
      }
    } catch (err) {
      setShareStatus('error');
      setShareError(err.message || 'Failed to trigger share');
    }
  };

  const closeSplitView = () => {
    setIsSplitView(false);
    setSplitNote(null); setSplitContent(''); setSplitSaveStatus('Ready');
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filteredNotes = notes.filter(n => {
    if (!searchQuery) return true;
    return n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.preview.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const pinnedList = filteredNotes.filter(n => pinnedNotes.includes(n.filename));
  const regularList = filteredNotes.filter(n => !pinnedNotes.includes(n.filename));
  const wordCount = noteContent ? noteContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = noteContent?.length || 0;

  // ── Note list item renderer ───────────────────────────────────────────────────
  const renderNoteItem = (note) => {
    const isLeftActive = activeNote?.filename === note.filename;
    const isRightActive = splitNote?.filename === note.filename;
    return (
      <div
        key={note.filename}
        className={`note-item ${isLeftActive ? 'selected' : isRightActive ? 'selected-split' : ''}`}
        onClick={() => handleNoteSelect(note)}
        draggable={!note.isEncrypted}
        onDragStart={e => handleDragStart(e, note)}
        onDragEnd={handleDragEnd}
        title={note.isEncrypted ? 'Encrypted — opens full-width' : 'Drag to right pane for split view'}
      >
        <div className="note-item-header">
          <div className="note-item-title-wrapper">
            {note.isEncrypted && (
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            )}
            <span className="note-item-title">{note.title}</span>
          </div>
          <span className="note-item-date">{new Date(note.mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
        <div className="note-item-preview">{note.preview || 'Empty note'}</div>
      </div>
    );
  };

  // ── Editor pane renderer ─────────────────────────────────────────────────────
  const renderEditorPane = (pane) => {
    const note = pane === 'left' ? activeNote : splitNote;
    const content = pane === 'left' ? noteContent : splitContent;
    const status = pane === 'left' ? saveStatus : splitSaveStatus;
    const isUnlocked = note ? !!unlockedNotesRef.current[note.filename] : false;

    if (!note) return (
      <div className={`no-active-note drop-target`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        {pane === 'right'
          ? <span>Drag a note here<br /><span style={{ fontSize: '11px', opacity: 0.6 }}>or use Ctrl+Q to close split</span></span>
          : <span>Select or create a note</span>
        }
      </div>
    );

    if (note.isWeb) {
      return (
        <>
          {/* Workspace header */}
          <div className="workspace-header">
            {pane === 'left' && !isSidebarPinned && !isSidebarHovered && (
              <div className="traffic-lights" style={{ marginRight: '10px' }}>
                <button className="traffic-light close" onClick={() => window.electronAPI.closeWindow()} title="Close"></button>
                <button className="traffic-light minimize" onClick={() => window.electronAPI.minimizeWindow()} title="Minimize"></button>
                <button className="traffic-light maximize" onClick={() => window.electronAPI.maximizeWindow()} title={isMaximized ? 'Restore' : 'Maximize'}></button>
              </div>
            )}
            <span className="note-title-input" style={{ border: 'none', background: 'transparent' }}>{note.title}</span>
            <button className="icon-btn" onClick={() => window.open(note.url.replace('/embed/', '/watch?v='), '_blank')} title="Open in Browser" style={{ marginLeft: 'auto' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            {pane === 'right' && (
              <button className="icon-btn" onClick={closeSplitView} title="Close split view" style={{ marginLeft: '10px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          <div className="editor-container" style={{ height: 'calc(100% - 40px)', padding: 0 }}>
            <iframe
              src={note.url}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: '#000' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </>
      );
    }

    const currentMode = pane === 'left' ? viewMode : splitViewMode;
    const setMode = pane === 'left' ? setViewMode : setSplitViewMode;

    return (
      <>
        {/* Workspace header */}
        <div className="workspace-header">
          {pane === 'left' && !isSidebarPinned && !isSidebarHovered && (
            <div className="traffic-lights" style={{ marginRight: '10px' }}>
              <button className="traffic-light close" onClick={() => window.electronAPI.closeWindow()} title="Close"></button>
              <button className="traffic-light minimize" onClick={() => window.electronAPI.minimizeWindow()} title="Minimize"></button>
              <button className="traffic-light maximize" onClick={() => window.electronAPI.maximizeWindow()} title={isMaximized ? 'Restore' : 'Maximize'}></button>
            </div>
          )}
          {pane === 'left' && !isSidebarPinned && (
            <button className="sidebar-toggle-btn" onClick={() => setIsSidebarPinned(true)} title="Show Sidebar" style={{ marginRight: '14px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
          )}

          <input
            type="text"
            className="note-title-input"
            value={pane === 'left' ? noteTitle : (splitNote?.title || '')}
            onChange={pane === 'left' ? (e => setNoteTitle(e.target.value)) : undefined}
            onBlur={pane === 'left' ? handleRenameCommit : undefined}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
            placeholder="Note Title"
            readOnly={pane === 'right'}
          />

          {/* Mode Toggles */}
          {!note.isEncrypted && (
            <div className="view-mode-selector">
              <button className={`mode-btn ${currentMode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</button>
              <button className={`mode-btn ${currentMode === 'preview' ? 'active' : ''}`} onClick={() => setMode('preview')}>Preview</button>
              {content && content.includes('<!-- type: board -->') && (
                <button className={`mode-btn ${currentMode === 'board' ? 'active' : ''}`} onClick={() => setMode('board')}>Board</button>
              )}
            </div>
          )}

          {pane === 'left' && (
            <div className="workspace-actions" style={{ marginLeft: '10px' }}>
              <button className="icon-btn" onClick={handlePinToggle} title={pinnedNotes.includes(note.filename) ? 'Unpin' : 'Pin'}
                style={{ color: pinnedNotes.includes(note.filename) ? 'var(--accent)' : 'inherit' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill={pinnedNotes.includes(note.filename) ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
              <button className="icon-btn" onClick={handleLockToggleClick}
                title={note.isEncrypted ? 'Unlock permanently' : 'Encrypt note'}
                style={{ color: note.isEncrypted ? 'var(--accent)' : 'inherit' }}>
                {note.isEncrypted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                  </svg>
                )}
              </button>
              <button className="icon-btn" onClick={handleCopyNote} title="Copy note">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              </button>
              <button className="icon-btn" onClick={() => handleShareWhatsApp('left')} title="Share to WhatsApp (PDF)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
              {!note.isEncrypted && (
                <button className="icon-btn" onClick={() => isSplitView ? closeSplitView() : setIsSplitView(true)}
                  title={isSplitView ? 'Close Split (Ctrl+Q)' : 'Split View (Ctrl+Q)'}
                  style={{ color: isSplitView ? 'var(--accent)' : 'inherit' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="12" y1="3" x2="12" y2="21"></line>
                  </svg>
                </button>
              )}
              <button className="icon-btn" onClick={handleDeleteNote} title="Delete note">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          )}

          {pane === 'right' && (
            <div className="workspace-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="icon-btn" onClick={() => handleShareWhatsApp('right')} title="Share to WhatsApp (PDF)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
              <button className="icon-btn" onClick={closeSplitView} title="Close split view (Ctrl+Q)">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Formatting Toolbar - only in edit mode */}
        {currentMode === 'edit' && !note.isEncrypted && (
          <div className="formatting-toolbar">
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'bold')} title="Bold">
              <strong>B</strong>
            </button>
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'italic')} title="Italic">
              <em>I</em>
            </button>
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'header')} title="Heading">
              H
            </button>
            <span className="toolbar-separator"></span>
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'bullet')} title="Bullet List">
              • List
            </button>
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'number')} title="Numbered List">
              1. List
            </button>
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'task')} title="Jira Checklist Task">
              ☑ Task
            </button>
            <button className="toolbar-btn" onClick={() => insertMarkdown(pane, 'code')} title="Code Block">
              &lt;/&gt;
            </button>
          </div>
        )}

        {/* Main Editor Content Area */}
        <div className="editor-container">
          {currentMode === 'edit' ? (
            <textarea
              ref={pane === 'left' ? leftTextareaRef : rightTextareaRef}
              className="note-textarea"
              value={content}
              onChange={e => handleContentChange(pane, e.target.value)}
              onFocus={() => setFocusedPane(pane)}
              placeholder="Start writing..."
              disabled={note.isEncrypted && !isUnlocked}
              spellCheck={true}
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          ) : currentMode === 'preview' ? (
            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(content) }}
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
              onClick={handlePreviewClick}
            />
          ) : (
            renderKanbanBoard(pane, content)
          )}
        </div>

        {/* Footer */}
        <div className="footer-status">
          <div className="status-left">
            {pane === 'left' ? (
              <><span>{wordCount} words</span><span>{charCount} chars</span></>
            ) : (
              <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Right Pane</span>
            )}
          </div>
          <div className="status-right">
            <span className={status === 'Saved' || status === 'Copied!' ? 'status-saved' : ''}>
              {status === 'Saved' && '✓ '}{status}
            </span>
          </div>
        </div>
      </>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`app-container theme-${theme} ${isMaximized ? 'is-maximized' : ''} ${isSidebarPinned ? 'sidebar-pinned' : 'sidebar-collapsed'} ${isSidebarHovered && !isSidebarPinned ? 'sidebar-visible' : ''}`}
    >
      {!isSidebarPinned && <div className="sidebar-hover-trigger" onMouseEnter={handleSidebarEnter}></div>}

      <div className="spotlight-container">
        <div ref={blob1Ref} className="blob blob-1"></div>
        <div ref={blob2Ref} className="blob blob-2"></div>
        <div ref={blob3Ref} className="blob blob-3"></div>
      </div>

      {/* ── Sidebar ── */}
      <div className="sidebar" onMouseEnter={handleSidebarEnter} onMouseLeave={handleSidebarLeave}>
        <div className="sidebar-header">
          <div className="traffic-lights">
            <button className="traffic-light close" onClick={() => window.electronAPI.closeWindow()} title="Close"></button>
            <button className="traffic-light minimize" onClick={() => window.electronAPI.minimizeWindow()} title="Minimize"></button>
            <button className="traffic-light maximize" onClick={() => window.electronAPI.maximizeWindow()} title={isMaximized ? 'Restore' : 'Maximize'}></button>
          </div>
          <h1 className="logo">Agna</h1>
          <div className="header-controls">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <button className="icon-btn" onClick={handleCreateNote} title="New note (Ctrl+T for named)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button className="icon-btn" onClick={() => setIsSidebarPinned(prev => !prev)} title={isSidebarPinned ? 'Hide Sidebar' : 'Pin Sidebar'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="search-container">
          <div className="search-wrapper">
            <span className="search-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input type="text" className="search-input" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {draggedNote && (
          <div className="drag-hint">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline>
              <polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline>
              <line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
            Drop on right half for split view
          </div>
        )}

        <div className="note-list-scroll">
          {pinnedList.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div className="list-section-header">Pinned</div>
              {pinnedList.map(note => renderNoteItem(note))}
            </div>
          )}
          <div>
            {pinnedList.length > 0 && regularList.length > 0 && <div className="list-section-header">Notes</div>}
            {regularList.length > 0
              ? regularList.map(note => renderNoteItem(note))
              : pinnedList.length === 0 && <div className="no-notes">No notes found</div>
            }
          </div>
        </div>
      </div>

      {/* ── Workspace ── */}
      <div className={`workspace ${isSplitView ? 'split-active' : ''}`}>
        {openTabs.length > 0 && (
          <div className="tab-bar">
            {openTabs.map(tab => (
              <div
                key={tab.filename}
                className={`tab ${activeNote?.filename === tab.filename ? 'active' : splitNote?.filename === tab.filename ? 'active-split' : ''}`}
                onClick={() => {
                  if (tab.isWeb) {
                    const fakeNote = {
                      filename: tab.filename,
                      title: tab.title,
                      isWeb: true,
                      url: tab.url
                    };
                    const pane = isSplitView ? focusedPane : 'left';
                    applyPaneNote(pane, fakeNote, '');
                  } else {
                    const n = notes.find(x => x.filename === tab.filename);
                    if (n) handleNoteSelect(n);
                  }
                }}
              >
                {tab.isEncrypted && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, flexShrink: 0, color: 'var(--accent)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                )}
                <span className="tab-title">{tab.title}</span>
                <button className="tab-close" onClick={(e) => closeTab(tab.filename, e)}>×</button>
              </div>
            ))}
          </div>
        )}

        {showShareModal && (
          <div
            className="lock-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && shareStatus !== 'generating') {
                setShowShareModal(false);
              }
            }}
          >
            <div className="lock-card" style={{ width: '400px' }}>
              <div className="lock-icon-large" style={{ color: '#25D366' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>

              <h2 className="lock-card-title">Share to WhatsApp</h2>

              {shareStatus === 'generating' && (
                <div style={{ padding: '20px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 15px auto', width: '30px', height: '30px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#25D366', animation: 'spin 1s linear infinite' }}></div>
                  <p className="lock-card-desc">Generating styled PDF note...</p>
                </div>
              )}

              {shareStatus === 'success' && (
                <>
                  <div style={{ fontSize: '13px', textAlign: 'left', lineHeight: '1.5', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', margin: '15px 0', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366', fontWeight: 600, marginBottom: '8px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>PDF note generated successfully!</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent)' }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                      <span>The PDF file has been saved to your Documents folder and <strong>copied to your clipboard</strong>.</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>To send:</div>
                      <ol style={{ paddingLeft: '16px', margin: 0 }}>
                        <li>Open the WhatsApp App or Web client.</li>
                        <li>Select your contact chat.</li>
                        <li>Press <strong>Ctrl + V</strong> to paste and send the styled PDF!</li>
                      </ol>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                    <button className="lock-submit-btn" style={{ background: '#25D366', borderColor: '#25D366', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => window.open('whatsapp://', '_blank')}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                      Open WhatsApp App
                    </button>
                    <button className="new-note-cancel" style={{ width: '100%', margin: 0 }} onClick={() => window.open('https://web.whatsapp.com/', '_blank')}>
                      Use WhatsApp Web
                    </button>
                    <button className="new-note-cancel" style={{ width: '100%', margin: 0 }} onClick={() => window.electronAPI.showItemInFolder(generatedPdfPath)}>
                      Show in File Explorer
                    </button>
                    <button className="new-note-cancel" style={{ width: '100%', margin: 0, opacity: 0.6 }} onClick={() => setShowShareModal(false)}>
                      Close
                    </button>
                  </div>
                </>
              )}

              {shareStatus === 'error' && (
                <>
                  <p className="lock-error-text" style={{ margin: '15px 0' }}>{shareError || 'Failed to export PDF.'}</p>
                  <button className="lock-submit-btn" onClick={() => setShowShareModal(false)}>
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {showPassModal && (
          <div
            className="lock-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                if (modalMode === 'unlock') {
                  dismissPassModal(true);
                } else {
                  dismissPassModal(false);
                }
              }
            }}
          >
            <div className={`lock-card ${isShaking ? 'shake' : ''}`}>
              <div className="lock-icon-large">
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>

              {modalMode === 'lock' ? (
                <>
                  <h2 className="lock-card-title">Encrypt Note</h2>
                  <p className="lock-card-desc">Set a password to encrypt this note as a .agna file.</p>
                  <form className="lock-form" onSubmit={handlePasswordSubmit}>
                    <input type="password" className="lock-input" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} autoFocus />
                    <input type="password" className="lock-input" placeholder="Confirm Password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
                    <button type="submit" className="lock-submit-btn">Lock Note</button>
                  </form>
                  <button className="icon-btn" style={{ marginTop: '12px', width: '100%', fontSize: '13px' }} onClick={() => dismissPassModal(false)}>Cancel</button>
                </>
              ) : modalMode === 'unlock-permanent' ? (
                <>
                  <h2 className="lock-card-title">Unlock Permanently</h2>
                  <p className="lock-card-desc">Enter the password to decrypt this note back to plaintext.</p>
                  <form className="lock-form" onSubmit={handlePasswordSubmit}>
                    <input type="password" className="lock-input" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} autoFocus />
                    <button type="submit" className="lock-submit-btn">Unlock Note</button>
                  </form>
                  <button className="icon-btn" style={{ marginTop: '12px', width: '100%', fontSize: '13px' }} onClick={() => dismissPassModal(false)}>Cancel</button>
                </>
              ) : (
                <>
                  <h2 className="lock-card-title">Secure Note</h2>
                  <p className="lock-card-desc">This note is encrypted. Enter the password to view it.<br /><span style={{ fontSize: '11px', opacity: 0.6 }}>Click outside or press Esc to navigate away.</span></p>
                  <form className="lock-form" onSubmit={handlePasswordSubmit}>
                    <input type="password" className="lock-input" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} autoFocus />
                    <button type="submit" className="lock-submit-btn">Unlock Note</button>
                  </form>
                </>
              )}
              {passwordError && <div className="lock-error-text">{passwordError}</div>}
            </div>
          </div>
        )}

        {/* Editor area — single or split */}
        <div className="editor-area">
          <div
            className={`editor-pane ${focusedPane === 'left' ? 'focused' : ''} ${dragOverTarget.pane === 'left' && dragOverTarget.zone === 'center' ? 'drag-over' : ''}`}
            onClick={() => setFocusedPane('left')}
            onDragOver={e => handleDropZoneDragOver(e, 'left')}
            onDragLeave={handleDropZoneDragLeave}
            onDrop={e => handleDropOnPane(e, 'left')}
            style={{ width: isSplitView ? `${splitRatio}%` : '100%', flex: 'none' }}
          >
            {renderEditorPane('left')}
            
            {/* Boing split overlays */}
            {dragOverTarget.pane === 'left' && dragOverTarget.zone === 'left-split' && (
              <div className="split-drag-overlay split-left-overlay">
                <div className="overlay-glow"></div>
                <div className="overlay-text">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  <span>Split Left</span>
                </div>
              </div>
            )}
            {dragOverTarget.pane === 'left' && dragOverTarget.zone === 'right-split' && (
              <div className="split-drag-overlay split-right-overlay">
                <div className="overlay-glow"></div>
                <div className="overlay-text">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                  </svg>
                  <span>Split Right</span>
                </div>
              </div>
            )}
          </div>
          {isSplitView && (
            <>
              <div
                className="split-divider"
                onMouseDown={handleDividerMouseDown}
              ></div>
              <div
                className={`editor-pane ${focusedPane === 'right' ? 'focused' : ''} ${dragOverTarget.pane === 'right' && dragOverTarget.zone === 'center' ? 'drag-over' : ''}`}
                onClick={() => setFocusedPane('right')}
                onDragOver={e => handleDropZoneDragOver(e, 'right')}
                onDragLeave={handleDropZoneDragLeave}
                onDrop={e => handleDropOnPane(e, 'right')}
                style={{ width: `${100 - splitRatio}%`, flex: 'none' }}
              >
                {renderEditorPane('right')}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Ctrl+T: New Note Name Modal ── */}
      {showNewNoteModal && (
        <div className="new-note-overlay" onClick={e => e.target === e.currentTarget && setShowNewNoteModal(false)}>
          <div className="new-note-card">
            <h2 className="new-note-title">New Note</h2>
            <p className="new-note-desc">Enter a name for your new note</p>
            <form onSubmit={e => { e.preventDefault(); handleCreateNoteWithName(); }}>
              <input
                ref={newNoteInputRef}
                type="text"
                className="new-note-input"
                value={newNoteName}
                onChange={e => setNewNoteName(e.target.value)}
                placeholder="Note name"
                autoFocus
              />

              <div className="template-selector-container">
                <span className="template-label">Select Template</span>
                <div className="template-grid">
                  <button
                    type="button"
                    className={`template-btn ${selectedTemplate === 'blank' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate('blank')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    Blank Note
                  </button>
                  <button
                    type="button"
                    className={`template-btn ${selectedTemplate === 'blank_board' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate('blank_board')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                    Blank Board
                  </button>
                  <button
                    type="button"
                    className={`template-btn ${selectedTemplate === 'jira' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate('jira')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="8" y1="11" x2="16" y2="11"></line><line x1="8" y1="16" x2="16" y2="16"></line></svg>
                    Jira Board
                  </button>
                  <button
                    type="button"
                    className={`template-btn ${selectedTemplate === 'meeting' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate('meeting')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Meeting Notes
                  </button>
                  <button
                    type="button"
                    className={`template-btn ${selectedTemplate === 'todo' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate('todo')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    To-Do Board
                  </button>
                </div>
              </div>

              <div className="new-note-actions">
                <button type="button" className="new-note-cancel" onClick={() => setShowNewNoteModal(false)}>Cancel</button>
                <button type="submit" className="new-note-create">Create Note</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Hover Preview Popup Card ── */}
      {hoverPreview && (
        <div
          className="link-hover-preview"
          style={{
            position: 'fixed',
            left: `${hoverPreview.rect.left}px`,
            top: `${hoverPreview.rect.bottom + 8}px`,
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div className="preview-header">
            <span className="preview-title">{hoverPreview.title}</span>
            <span className={`preview-badge ${hoverPreview.type === 'internal' ? 'internal' : 'external'}`}>
              {hoverPreview.type === 'internal' ? 'Note Link' : 'Web Link'}
            </span>
          </div>
          <div className="preview-body">
            {hoverPreview.content}
          </div>
        </div>
      )}
    </div>
  );
}
