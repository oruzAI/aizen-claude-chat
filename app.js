/**
 * Aizen — Claude Workspace Logic
 * Direct client-side integration with https://api.nghimmo.com/v1/messages
 */

(function () {
    'use strict';

    // API & Storage Constants
    const API_ENDPOINT = 'https://api.nghimmo.com/v1/messages';
    const STORAGE_KEY_API_KEY = 'aizen_api_key';
    const STORAGE_KEY_CONVERSATIONS = 'aizen_conversations';
    const STORAGE_KEY_CURRENT_ID = 'aizen_current_conv_id';
    const STORAGE_KEY_MODEL = 'aizen_model';
    const STORAGE_KEY_EFFORT = 'aizen_effort';
    const STORAGE_KEY_THEME = 'aizen_theme';

    // One-time effort migration to 'high'
    if (!localStorage.getItem('aizen_effort_migrated_v2')) {
        localStorage.setItem('aizen_effort', 'high');
        localStorage.setItem('aizen_effort_migrated_v2', 'true');
    }

    // Models Map
    const MODELS_MAP = {
        'nghi/claude-opus-5-thinking': 'Opus 5 Thinking',
        'nghi/claude-opus-5': 'Opus 5',
        'nghi/claude-opus-4.8-thinking': 'Opus 4.8 Thinking',
        'nghi/claude-opus-4.8': 'Opus 4.8',
        'nghi/claude-sonnet-5': 'Sonnet 5',
        'nghi/claude-haiku-4.5': 'Haiku 4.5'
    };

    const EFFORT_MAP = {
        'low': 'Bajo',
        'medium': 'Medio',
        'high': 'Alto',
        'very_high': 'Muy alto',
        'maximum': 'Máximo'
    };

    // State Variables
    let apiKey = (localStorage.getItem(STORAGE_KEY_API_KEY) || '').trim();
    let selectedModel = localStorage.getItem(STORAGE_KEY_MODEL) || 'nghi/claude-opus-5-thinking';
    let selectedEffort = localStorage.getItem(STORAGE_KEY_EFFORT) || 'high';
    let currentTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'system';
    
    let conversations = JSON.parse(localStorage.getItem(STORAGE_KEY_CONVERSATIONS) || '[]');
    let currentConvId = localStorage.getItem(STORAGE_KEY_CURRENT_ID) || null;
    
    let pendingAttachments = []; // Array of { id, file, type, name, sizeFormatted, status: 'processing'|'ready'|'error', content, base64 }
    let isGenerating = false;
    let abortController = null;
    let activeReader = null;
    let effortDisabledForSession = false;
    let dragCounter = 0;

    // Configure PDF.js worker
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // DOM Elements
    const elements = {
        sidebar: document.getElementById('sidebar'),
        sidebarBackdrop: document.getElementById('sidebarBackdrop'),
        openSidebarBtn: document.getElementById('openSidebarBtn'),
        closeSidebarBtn: document.getElementById('closeSidebarBtn'),
        newChatBtn: document.getElementById('newChatBtn'),
        convList: document.getElementById('convList'),
        openApiKeyBtn: document.getElementById('openApiKeyBtn'),
        apiKeyStatusText: document.getElementById('apiKeyStatusText'),
        
        themeSegment: document.getElementById('themeSegment'),
        activeChatTitle: document.getElementById('activeChatTitle'),
        
        clearChatBtn: document.getElementById('clearChatBtn'),
        mobileMenuMoreBtn: document.getElementById('mobileMenuMoreBtn'),
        mobileOverflowMenu: document.getElementById('mobileOverflowMenu'),
        mobileClearBtn: document.getElementById('mobileClearBtn'),
        
        chatViewport: document.getElementById('chatViewport'),
        scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
        dragDropOverlay: document.getElementById('dragDropOverlay'),
        welcomeContainer: document.getElementById('welcomeContainer'),
        messagesFeed: document.getElementById('messagesFeed'),
        errorBanner: document.getElementById('errorBanner'),
        errorTitle: document.getElementById('errorTitle'),
        errorMessage: document.getElementById('errorMessage'),
        closeErrorBtn: document.getElementById('closeErrorBtn'),
        
        attachmentsPreview: document.getElementById('attachmentsPreview'),
        userInput: document.getElementById('userInput'),
        fileInput: document.getElementById('fileInput'),
        attachFileBtn: document.getElementById('attachFileBtn'),
        
        // Compositor Pills
        modelPillBtn: document.getElementById('modelPillBtn'),
        modelPillLabel: document.getElementById('modelPillLabel'),
        modelMenu: document.getElementById('modelMenu'),
        effortPillWrapper: document.getElementById('effortPillWrapper'),
        effortPillBtn: document.getElementById('effortPillBtn'),
        effortPillLabel: document.getElementById('effortPillLabel'),
        effortMenu: document.getElementById('effortMenu'),
        
        sendBtn: document.getElementById('sendBtn'),
        
        // API Key Modal
        apiKeyModal: document.getElementById('apiKeyModal'),
        closeApiKeyModal: document.getElementById('closeApiKeyModal'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
        clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
        testApiKeyBtn: document.getElementById('testApiKeyBtn'),
        apiKeyNotice: document.getElementById('apiKeyNotice')
    };

    // Initialize App
    function init() {
        initTheme();
        setupEventListeners();
        setupDragAndDrop();
        updateApiKeyUI();
        initPills();
        
        if (!currentConvId && conversations.length > 0) {
            currentConvId = conversations[0].id;
        }
        
        renderConversationsList();
        loadCurrentConversation();
    }

    // Theme Manager
    function initTheme() {
        applyTheme(currentTheme);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (currentTheme === 'system') applyTheme('system');
        });
    }

    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem(STORAGE_KEY_THEME, theme);

        let effectiveDark = false;
        if (theme === 'dark') effectiveDark = true;
        else if (theme === 'light') effectiveDark = false;
        else effectiveDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (effectiveDark) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        if (elements.themeSegment) {
            elements.themeSegment.querySelectorAll('.segment-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
            });
        }
    }

    // Drag and Drop Setup
    function setupDragAndDrop() {
        const target = elements.chatViewport;

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            elements.dragDropOverlay.classList.remove('hidden');
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                elements.dragDropOverlay.classList.add('hidden');
            }
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            elements.dragDropOverlay.classList.add('hidden');

            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileSelection({ target: { files: e.dataTransfer.files } });
            }
        });
    }

    // Event Listeners
    function setupEventListeners() {
        // Sidebar drawer
        elements.openSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.add('open');
            elements.sidebarBackdrop.classList.add('active');
        });
        
        const closeSidebar = () => {
            elements.sidebar.classList.remove('open');
            elements.sidebarBackdrop.classList.remove('active');
        };
        elements.closeSidebarBtn.addEventListener('click', closeSidebar);
        elements.sidebarBackdrop.addEventListener('click', closeSidebar);

        // New & Clear Chat
        elements.newChatBtn.addEventListener('click', () => {
            createNewConversation();
            closeSidebar();
        });
        
        elements.clearChatBtn.addEventListener('click', confirmClearChat);
        elements.mobileClearBtn.addEventListener('click', () => {
            elements.mobileOverflowMenu.classList.add('hidden');
            confirmClearChat();
        });

        // Mobile Overflow Menu
        elements.mobileMenuMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.mobileOverflowMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!elements.mobileOverflowMenu.contains(e.target) && e.target !== elements.mobileMenuMoreBtn) {
                elements.mobileOverflowMenu.classList.add('hidden');
            }
            if (!elements.modelPillBtn.contains(e.target) && !elements.modelMenu.contains(e.target)) {
                elements.modelMenu.classList.add('hidden');
            }
            if (!elements.effortPillBtn.contains(e.target) && !elements.effortMenu.contains(e.target)) {
                elements.effortMenu.classList.add('hidden');
            }
        });

        // Sidebar Theme Segment
        elements.themeSegment.querySelectorAll('.segment-btn').forEach(btn => {
            btn.addEventListener('click', () => applyTheme(btn.getAttribute('data-theme')));
        });

        // Compositor Model & Effort Pills
        elements.modelPillBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.effortMenu.classList.add('hidden');
            elements.modelMenu.classList.toggle('hidden');
        });

        elements.modelMenu.querySelectorAll('.compositor-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedModel = item.getAttribute('data-model');
                localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
                elements.modelMenu.classList.add('hidden');
                updatePills();
            });
        });

        elements.effortPillBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.modelMenu.classList.add('hidden');
            elements.effortMenu.classList.toggle('hidden');
        });

        elements.effortMenu.querySelectorAll('.compositor-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedEffort = item.getAttribute('data-effort');
                localStorage.setItem(STORAGE_KEY_EFFORT, selectedEffort);
                elements.effortMenu.classList.add('hidden');
                updatePills();
            });
        });

        // API Key Modal
        elements.openApiKeyBtn.addEventListener('click', openApiKeyModal);
        elements.closeApiKeyModal.addEventListener('click', closeApiKeyModal);
        elements.apiKeyModal.addEventListener('click', (e) => {
            if (e.target === elements.apiKeyModal) closeApiKeyModal();
        });
        elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
        elements.clearApiKeyBtn.addEventListener('click', clearApiKey);
        elements.testApiKeyBtn.addEventListener('click', testApiKeyConnection);

        // Starter Cards
        document.querySelectorAll('.starter-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    elements.userInput.value = prompt;
                    sendMessage();
                }
            });
        });

        // Textarea & Send / Stop
        elements.userInput.addEventListener('input', autoResizeTextarea);
        elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        elements.sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isGenerating) {
                stopGeneration();
            } else {
                sendMessage();
            }
        });

        // Scroll to bottom floating button
        elements.chatViewport.addEventListener('scroll', handleViewportScroll);
        elements.scrollToBottomBtn.addEventListener('click', () => {
            elements.chatViewport.scrollTo({ top: elements.chatViewport.scrollHeight, behavior: 'smooth' });
            elements.scrollToBottomBtn.classList.add('hidden');
        });

        // Attachments
        elements.attachFileBtn.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', handleFileSelection);

        // Error Banner
        elements.closeErrorBtn.addEventListener('click', hideError);

        // Feed Actions
        elements.messagesFeed.addEventListener('click', handleFeedActions);
    }

    function autoResizeTextarea() {
        elements.userInput.style.height = 'auto';
        elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 160) + 'px';
    }

    function initPills() {
        updatePills();
    }

    function updatePills() {
        elements.modelPillLabel.textContent = MODELS_MAP[selectedModel] || 'Opus 5 Thinking';
        
        elements.modelMenu.querySelectorAll('.compositor-menu-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-model') === selectedModel);
        });

        if (selectedModel === 'nghi/claude-haiku-4.5' || effortDisabledForSession) {
            elements.effortPillWrapper.style.display = 'none';
        } else {
            elements.effortPillWrapper.style.display = 'block';
            elements.effortPillLabel.textContent = EFFORT_MAP[selectedEffort] || 'Alto';
            elements.effortMenu.querySelectorAll('.compositor-menu-item').forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-effort') === selectedEffort);
            });
        }
    }

    function handleViewportScroll() {
        const vp = elements.chatViewport;
        const distanceFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
        if (distanceFromBottom > 120 && isGenerating) {
            elements.scrollToBottomBtn.classList.remove('hidden');
        } else {
            elements.scrollToBottomBtn.classList.add('hidden');
        }
    }

    // API Key Modal Logic
    function updateApiKeyUI() {
        if (apiKey && apiKey.trim().length > 0) {
            elements.apiKeyStatusText.textContent = 'API Key de Claude ✓';
        } else {
            elements.apiKeyStatusText.textContent = 'API Key de Claude ⚠️';
        }
    }

    function openApiKeyModal() {
        elements.apiKeyInput.value = apiKey;
        elements.apiKeyNotice.className = 'modal-notice hidden';
        elements.apiKeyModal.classList.remove('hidden');
    }

    function closeApiKeyModal() {
        elements.apiKeyModal.classList.add('hidden');
    }

    function saveApiKey() {
        const rawKey = elements.apiKeyInput.value.trim();
        apiKey = rawKey;
        localStorage.setItem(STORAGE_KEY_API_KEY, rawKey);
        updateApiKeyUI();
        showModalNotice('Clave guardada.', 'success');
        setTimeout(closeApiKeyModal, 600);
    }

    function clearApiKey() {
        apiKey = '';
        localStorage.removeItem(STORAGE_KEY_API_KEY);
        elements.apiKeyInput.value = '';
        updateApiKeyUI();
        showModalNotice('Clave eliminada.', 'error');
    }

    async function testApiKeyConnection() {
        const keyToTest = elements.apiKeyInput.value.trim() || apiKey;
        if (!keyToTest) {
            showModalNotice('Por favor ingresa una clave de API.', 'error');
            return;
        }

        showModalNotice('Probar conexión...', 'success');

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': keyToTest,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: selectedModel,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Ping' }],
                    stream: false
                })
            });

            if (response.ok) {
                showModalNotice('Conexión exitosa. Clave válida.', 'success');
            } else {
                const errText = await response.text();
                showModalNotice(`Error HTTP ${response.status}: ${errText.slice(0, 80)}`, 'error');
            }
        } catch (err) {
            showModalNotice(`Error de conexión: ${err.message}`, 'error');
        }
    }

    function showModalNotice(msg, type) {
        elements.apiKeyNotice.textContent = msg;
        elements.apiKeyNotice.className = `modal-notice ${type}`;
    }

    // PDF Direct Base64 & Multi-Format Processing
    async function handleFileSelection(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        updateSendBtnState();

        for (const file of files) {
            const fileId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            const sizeFormatted = formatFileSize(file.size);
            const fileType = getFileType(file.name, file.type);
            
            const attItem = {
                id: fileId,
                file,
                name: file.name,
                sizeFormatted,
                type: fileType,
                method: 'Directo',
                status: 'processing',
                content: '',
                base64: ''
            };

            pendingAttachments.push(attItem);
            renderAttachmentsPreview();

            try {
                await processFileContent(attItem);
                attItem.status = 'ready';
            } catch (err) {
                console.error('Error procesando archivo:', err);
                attItem.status = 'error';
                attItem.errorMsg = err.message;
            } finally {
                renderAttachmentsPreview();
                updateSendBtnState();
            }
        }

        elements.fileInput.value = '';
    }

    function getFileType(fileName, mimeType) {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || mimeType.startsWith('image/')) return 'image';
        if (ext === 'pdf') return 'pdf';
        if (ext === 'docx') return 'docx';
        if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
        return 'text';
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async function processFileContent(att) {
        const file = att.file;

        if (att.type === 'image') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    att.dataUrl = e.target.result;
                    att.base64 = e.target.result.split(',')[1];
                    att.mimeType = file.type || 'image/png';
                    att.method = 'Directo';
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        if (att.type === 'pdf') {
            // Mode A: Direct Base64 Mode
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    att.dataUrl = e.target.result;
                    att.base64 = e.target.result.split(',')[1];
                    att.mimeType = 'application/pdf';
                    att.method = 'Directo';

                    // If large, fallback text extraction
                    if (window.pdfjsLib && file.size > 20 * 1024 * 1024) {
                        try {
                            att.method = 'Dividido';
                            const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) });
                            const pdf = await loadingTask.promise;
                            let fullText = '';
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const content = await page.getTextContent();
                                fullText += `--- Página ${i} ---\n` + content.items.map(it => it.str).join(' ') + '\n\n';
                            }
                            att.content = fullText.trim();
                        } catch (err) {
                            console.warn('Fallback PDF extraction error:', err);
                        }
                    }
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        if (att.type === 'docx') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    if (window.mammoth) {
                        try {
                            const result = await window.mammoth.extractRawText({ arrayBuffer: e.target.result });
                            att.content = result.value;
                            att.method = 'Directo';
                            resolve();
                        } catch (err) { reject(err); }
                    } else { reject(new Error('Mammoth.js no disponible')); }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }

        if (att.type === 'xlsx') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (window.XLSX) {
                        try {
                            const workbook = window.XLSX.read(e.target.result, { type: 'array' });
                            let excelText = '';
                            workbook.SheetNames.forEach(sheetName => {
                                const csv = window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                                excelText += `=== Hoja: ${sheetName} ===\n${csv}\n\n`;
                            });
                            att.content = excelText.trim();
                            att.method = 'Directo';
                            resolve();
                        } catch (err) { reject(err); }
                    } else { reject(new Error('SheetJS no disponible')); }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }

        // Plain Text
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                att.content = e.target.result;
                att.method = 'Directo';
                resolve();
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function renderAttachmentsPreview() {
        if (!pendingAttachments.length) {
            elements.attachmentsPreview.classList.add('hidden');
            elements.attachmentsPreview.innerHTML = '';
            return;
        }

        elements.attachmentsPreview.classList.remove('hidden');
        elements.attachmentsPreview.innerHTML = pendingAttachments.map((att, idx) => {
            let statusHTML = '<span class="chip-status">Procesando...</span>';
            if (att.status === 'ready') statusHTML = '<span class="chip-status ready">Listo ✓</span>';
            if (att.status === 'error') statusHTML = `<span class="chip-status error" title="${escapeHtml(att.errorMsg)}">Error ✕</span>`;

            return `
                <div class="preview-chip">
                    <span>${getAttachmentIcon(att.type)} ${escapeHtml(att.name)} (${att.sizeFormatted})</span>
                    <span class="chip-method-badge">${att.method}</span>
                    ${statusHTML}
                    <button type="button" class="chip-remove" data-idx="${idx}">&times;</button>
                </div>
            `;
        }).join('');

        elements.attachmentsPreview.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                pendingAttachments.splice(idx, 1);
                renderAttachmentsPreview();
                updateSendBtnState();
            });
        });
    }

    function updateSendBtnState() {
        const isProcessing = pendingAttachments.some(att => att.status === 'processing');
        elements.sendBtn.disabled = isProcessing;
    }

    function getAttachmentIcon(type) {
        if (type === 'image') return '🖼️';
        if (type === 'pdf') return '📄';
        if (type === 'docx') return '📘';
        if (type === 'xlsx') return '📊';
        return '📝';
    }

    // Conversation Management
    function createNewConversation() {
        const id = 'conv_' + Date.now();
        const newConv = {
            id,
            title: 'Nueva conversación',
            created_at: new Date().toISOString(),
            model: selectedModel,
            messages: []
        };
        conversations.unshift(newConv);
        currentConvId = id;
        saveConversationsToStorage();
        renderConversationsList();
        loadCurrentConversation();
    }

    function getCurrentConversation() {
        return conversations.find(c => c.id === currentConvId);
    }

    function saveConversationsToStorage() {
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations));
        localStorage.setItem(STORAGE_KEY_CURRENT_ID, currentConvId || '');
    }

    function renderConversationsList() {
        elements.convList.innerHTML = conversations.map(c => `
            <div class="conv-item ${c.id === currentConvId ? 'active' : ''}" data-id="${c.id}">
                <span class="conv-title">${escapeHtml(c.title || 'Conversación')}</span>
                <button class="conv-delete-btn" data-delete-id="${c.id}" title="Eliminar">&times;</button>
            </div>
        `).join('');

        elements.convList.querySelectorAll('.conv-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('conv-delete-btn')) {
                    e.stopPropagation();
                    const deleteId = e.target.getAttribute('data-delete-id');
                    deleteConversation(deleteId);
                    return;
                }
                const id = item.getAttribute('data-id');
                currentConvId = id;
                saveConversationsToStorage();
                renderConversationsList();
                loadCurrentConversation();
            });
        });
    }

    function deleteConversation(id) {
        conversations = conversations.filter(c => c.id !== id);
        if (currentConvId === id) {
            currentConvId = conversations.length ? conversations[0].id : null;
        }
        saveConversationsToStorage();
        renderConversationsList();
        loadCurrentConversation();
    }

    function confirmClearChat() {
        if (confirm('¿Deseas borrar los mensajes de esta conversación?')) {
            clearCurrentChat();
        }
    }

    function clearCurrentChat() {
        const conv = getCurrentConversation();
        if (conv) {
            conv.messages = [];
            conv.title = 'Nueva conversación';
            saveConversationsToStorage();
            renderConversationsList();
            loadCurrentConversation();
        }
    }

    function loadCurrentConversation() {
        hideError();
        const conv = getCurrentConversation();

        if (!conv || !conv.messages || conv.messages.length === 0) {
            elements.welcomeContainer.style.display = 'flex';
            elements.messagesFeed.innerHTML = '';
            elements.activeChatTitle.textContent = conv ? conv.title : 'Nueva conversación';
            return;
        }

        elements.welcomeContainer.style.display = 'none';
        elements.activeChatTitle.textContent = conv.title || 'Conversación';

        elements.messagesFeed.innerHTML = conv.messages.map(msg => renderMessageHTML(msg)).join('');
        scrollToBottom();
    }

    // Thinking Line Renderer
    function renderThinkingLineHTML(durationSeconds, isThinking) {
        let label = isThinking ? `Pensando… ${formatDuration(durationSeconds, true)}` : `Pensó durante ${formatDuration(durationSeconds, false)}`;

        return `
            <div class="thinking-line">
                ${isThinking ? '<span class="thinking-pulse-dot"></span>' : '●'}
                <span>${escapeHtml(label)}</span>
            </div>
        `;
    }

    function formatDuration(seconds, includeHundredths) {
        const sec = Math.floor(seconds);
        const hundredths = ((seconds % 1) * 100).toFixed(0).padStart(2, '0');
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const remainingSec = sec % 60;

        if (hrs > 0) {
            return `${hrs} h ${mins} min ${remainingSec} s`;
        }
        if (mins > 0) {
            return `${mins} min ${remainingSec}${includeHundredths ? '.' + hundredths : ''} s`;
        }
        return `${remainingSec}${includeHundredths ? '.' + hundredths : ''} s`;
    }

    // Message Renderer (Original Claude Look)
    function renderMessageHTML(msg) {
        const isUser = msg.role === 'user';

        let attachmentsHTML = '';
        if (msg.attachments && msg.attachments.length) {
            attachmentsHTML = `<div class="message-attachments">` + msg.attachments.map(att => {
                if (att.type === 'image') {
                    return `<img src="${att.dataUrl}" class="attached-img" alt="${escapeHtml(att.name)}">`;
                }
                return `<div class="attached-file-badge">${getAttachmentIcon(att.type)} ${escapeHtml(att.name)}</div>`;
            }).join('') + `</div>`;
        }

        let thinkingHTML = '';
        if (!isUser && msg.durationSeconds !== undefined) {
            thinkingHTML = renderThinkingLineHTML(msg.durationSeconds, false);
        }

        let generatedFileCardHTML = '';
        if (!isUser && msg.generatedFile) {
            const gf = msg.generatedFile;
            generatedFileCardHTML = `
                <div class="generated-file-card">
                    <div class="file-card-info">
                        <div class="file-card-icon">📄</div>
                        <div class="file-card-details">
                            <strong>${escapeHtml(gf.name)}</strong>
                            <span>${escapeHtml(gf.typeLabel)} · ${escapeHtml(gf.size)}</span>
                        </div>
                    </div>
                    <button class="file-download-btn" data-gen-download="${encodeURIComponent(gf.content)}" data-gen-name="${escapeHtml(gf.name)}" data-gen-fmt="${gf.format}">Descargar</button>
                </div>
            `;
        }

        let bodyHTML = isUser ? `<p>${escapeHtml(msg.text || '').replace(/\n/g, '<br>')}</p>` : parseMarkdown(msg.text || '');

        const actionsHTML = (!isUser && !isGenerating) ? `
            <div class="message-actions">
                <button class="action-icon-btn copy-msg-btn" data-text="${encodeURIComponent(msg.text || '')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copiar todo</span>
                </button>
                
                <div class="download-wrapper">
                    <button class="action-icon-btn download-trigger-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        <span>Descargar como ▾</span>
                    </button>
                    <div class="download-menu hidden">
                        <button class="download-option" data-fmt="pdf" data-text="${encodeURIComponent(msg.text || '')}">Documento PDF (.pdf)</button>
                        <button class="download-option" data-fmt="docx" data-text="${encodeURIComponent(msg.text || '')}">Documento Word (.docx)</button>
                        <button class="download-option" data-fmt="xlsx" data-text="${encodeURIComponent(msg.text || '')}">Hoja Excel (.xlsx)</button>
                        <button class="download-option" data-fmt="csv" data-text="${encodeURIComponent(msg.text || '')}">Tabla CSV (.csv)</button>
                        <button class="download-option" data-fmt="md" data-text="${encodeURIComponent(msg.text || '')}">Markdown (.md)</button>
                        <button class="download-option" data-fmt="txt" data-text="${encodeURIComponent(msg.text || '')}">Texto (.txt)</button>
                        <button class="download-option" data-fmt="html" data-text="${encodeURIComponent(msg.text || '')}">Página Web (.html)</button>
                    </div>
                </div>

                <button class="action-icon-btn regenerate-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    <span>Regenerar</span>
                </button>
            </div>
        ` : '';

        return `
            <div class="message-item ${msg.role}">
                <div class="message-bubble">
                    ${attachmentsHTML}
                    ${thinkingHTML}
                    <div class="message-text">${bodyHTML}</div>
                    ${generatedFileCardHTML}
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    // Markdown Parser
    function parseMarkdown(text) {
        if (!text) return '';

        const codeBlocks = [];
        let html = text.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push({ lang: lang || 'code', code: code.trim() });
            return placeholder;
        });

        html = escapeHtml(html);
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        html = html.replace(/^\&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>');
        html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;

        codeBlocks.forEach((cb, idx) => {
            const codeEscaped = escapeHtml(cb.code);
            const blockHTML = `
                <div class="code-block-wrapper">
                    <div class="code-header">
                        <span>${escapeHtml(cb.lang)}</span>
                        <div class="code-actions">
                            <button class="code-action-btn copy-code-btn" data-code="${encodeURIComponent(cb.code)}">Copiar</button>
                            <button class="code-action-btn download-code-btn" data-code="${encodeURIComponent(cb.code)}" data-lang="${escapeHtml(cb.lang)}">Descargar</button>
                        </div>
                    </div>
                    <pre><code>${codeEscaped}</code></pre>
                </div>
            `;
            html = html.replace(`__CODE_BLOCK_${idx}__`, blockHTML);
        });

        return html;
    }

    function escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Actions delegation
    function handleFeedActions(e) {
        const copyBtn = e.target.closest('.copy-msg-btn');
        if (copyBtn) {
            const rawText = decodeURIComponent(copyBtn.getAttribute('data-text'));
            navigator.clipboard.writeText(rawText);
            showToast(copyBtn, '¡Copiado!');
            return;
        }

        const downloadTrigger = e.target.closest('.download-trigger-btn');
        if (downloadTrigger) {
            const menu = downloadTrigger.nextElementSibling;
            document.querySelectorAll('.download-menu').forEach(m => {
                if (m !== menu) m.classList.add('hidden');
            });
            menu.classList.toggle('hidden');
            return;
        }

        const downloadOpt = e.target.closest('.download-option');
        if (downloadOpt) {
            const fmt = downloadOpt.getAttribute('data-fmt');
            const rawText = decodeURIComponent(downloadOpt.getAttribute('data-text'));
            const menu = downloadOpt.closest('.download-menu');
            if (menu) menu.classList.add('hidden');
            exportMessageAsFormat(rawText, fmt);
            return;
        }

        const genDownloadBtn = e.target.closest('.file-download-btn');
        if (genDownloadBtn) {
            const content = decodeURIComponent(genDownloadBtn.getAttribute('data-gen-download'));
            const name = genDownloadBtn.getAttribute('data-gen-name');
            const fmt = genDownloadBtn.getAttribute('data-gen-fmt');
            exportMessageAsFormat(content, fmt, name);
            return;
        }

        const copyCodeBtn = e.target.closest('.copy-code-btn');
        if (copyCodeBtn) {
            const rawCode = decodeURIComponent(copyCodeBtn.getAttribute('data-code'));
            navigator.clipboard.writeText(rawCode);
            showToast(copyCodeBtn, '¡Copiado!');
            return;
        }

        const downloadCodeBtn = e.target.closest('.download-code-btn');
        if (downloadCodeBtn) {
            const rawCode = decodeURIComponent(downloadCodeBtn.getAttribute('data-code'));
            const lang = downloadCodeBtn.getAttribute('data-lang') || 'txt';
            const ext = getExtensionForLang(lang);
            downloadBlobFile(rawCode, `codigo-${Date.now()}.${ext}`, 'text/plain');
            return;
        }

        const regenBtn = e.target.closest('.regenerate-btn');
        if (regenBtn) {
            regenerateLastResponse();
            return;
        }
    }

    // Export Message into PDF, DOCX, XLSX, CSV, MD, TXT, HTML
    function exportMessageAsFormat(rawText, format, customFilename) {
        const filename = customFilename || `aizen-export-${Date.now()}.${format}`;

        if (format === 'md') {
            downloadBlobFile(rawText, filename.endsWith('.md') ? filename : `${filename}.md`, 'text/markdown');
            return;
        }
        if (format === 'txt') {
            downloadBlobFile(rawText, filename.endsWith('.txt') ? filename : `${filename}.txt`, 'text/plain');
            return;
        }
        if (format === 'html') {
            const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Aizen Export</title><style>body{font-family:sans-serif;padding:30px;line-height:1.6;}</style></head><body>${parseMarkdown(rawText)}</body></html>`;
            downloadBlobFile(htmlContent, filename.endsWith('.html') ? filename : `${filename}.html`, 'text/html');
            return;
        }

        if (format === 'pdf') {
            if (window.html2pdf) {
                const element = document.createElement('div');
                element.style.padding = '24px';
                element.style.fontFamily = 'sans-serif';
                element.style.backgroundColor = '#FFFFFF';
                element.style.color = '#000000';
                element.innerHTML = parseMarkdown(rawText);
                window.html2pdf().from(element).save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
            } else {
                downloadBlobFile(rawText, `${filename}.txt`, 'text/plain');
            }
            return;
        }

        if (format === 'xlsx' || format === 'csv') {
            if (window.XLSX) {
                const rows = [];
                const lines = rawText.split('\n');
                lines.forEach(l => {
                    if (l.includes('|')) {
                        const cells = l.split('|').map(c => c.trim()).filter(c => c);
                        if (cells.length && !l.includes('---')) {
                            rows.push(cells);
                        }
                    }
                });

                if (rows.length === 0) {
                    rows.push(['Contenido'], [rawText]);
                }

                const ws = window.XLSX.utils.aoa_to_sheet(rows);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, "Aizen Data");

                if (format === 'csv') {
                    window.XLSX.writeFile(wb, filename.endsWith('.csv') ? filename : `${filename}.csv`, { bookType: 'csv' });
                } else {
                    window.XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
                }
            } else {
                downloadBlobFile(rawText, `${filename}.txt`, 'text/plain');
            }
            return;
        }

        if (format === 'docx') {
            const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Doc</title></head><body>${parseMarkdown(rawText)}</body></html>`;
            downloadBlobFile(htmlDoc, filename.endsWith('.docx') ? filename : `${filename}.docx`, 'application/msword');
            return;
        }
    }

    function showToast(btn, text) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>${text}</span>`;
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
    }

    function downloadBlobFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function getExtensionForLang(lang) {
        const map = {
            js: 'js', javascript: 'js', ts: 'ts', typescript: 'ts',
            python: 'py', py: 'py', html: 'html', css: 'css',
            json: 'json', md: 'md', c: 'c', cpp: 'cpp', java: 'java'
        };
        return map[(lang || '').toLowerCase()] || 'txt';
    }

    // Single-turn Model / Effort Question Detector
    function isModelIdentityQuery(text) {
        if (!text) return false;
        const lower = text.toLowerCase();
        return (
            lower.includes('qué modelo') || lower.includes('que modelo') ||
            lower.includes('eres opus') || lower.includes('qué versión') ||
            lower.includes('que version') || lower.includes('what model') ||
            lower.includes('what version')
        );
    }

    function isEffortQuery(text) {
        if (!text) return false;
        const lower = text.toLowerCase();
        return (
            lower.includes('qué nivel de esfuerzo') || lower.includes('que nivel de esfuerzo') ||
            lower.includes('estás en alto') || lower.includes('estas en alto') ||
            lower.includes('qué esfuerzo') || lower.includes('what effort')
        );
    }

    // Automatic File Delivery Detection
    function detectFileGenerationRequest(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        if (lower.includes('crea un pdf') || lower.includes('haz un pdf') || lower.includes('un libro') || lower.includes('generar pdf')) return 'pdf';
        if (lower.includes('haz un excel') || lower.includes('crea un excel') || lower.includes('hoja de cálculo') || lower.includes('generar xlsx')) return 'xlsx';
        if (lower.includes('genera un docx') || lower.includes('crea un word') || lower.includes('documento docx')) return 'docx';
        if (lower.includes('crea un csv') || lower.includes('generar csv')) return 'csv';
        if (lower.includes('entrégamelo como html') || lower.includes('crea un html')) return 'html';
        if (lower.includes('dámelo en txt') || lower.includes('archivo txt')) return 'txt';
        return null;
    }

    // Send Message Logic
    async function sendMessage() {
        const cleanApiKey = (apiKey || '').trim();
        if (!cleanApiKey) {
            openApiKeyModal();
            showModalNotice('Ingresa tu API Key para continuar.', 'error');
            return;
        }

        if (pendingAttachments.some(att => att.status === 'processing')) {
            alert('Espera a que los archivos terminen de procesarse.');
            return;
        }

        const textPrompt = elements.userInput.value.trim();
        const validAttachments = pendingAttachments.filter(att => att.status === 'ready');

        if (!textPrompt && validAttachments.length === 0) return;

        if (!currentConvId) {
            createNewConversation();
        }

        const conv = getCurrentConversation();
        if (!conv) return;

        if (conv.messages.length === 0) {
            conv.title = textPrompt.slice(0, 30) || 'Adjunto enviado';
            elements.activeChatTitle.textContent = conv.title;
        }

        const requestedFileFormat = detectFileGenerationRequest(textPrompt);

        const userMsg = {
            role: 'user',
            text: textPrompt,
            attachments: [...validAttachments],
            requestedFileFormat,
            timestamp: new Date().toISOString()
        };

        conv.messages.push(userMsg);
        saveConversationsToStorage();

        elements.userInput.value = '';
        autoResizeTextarea();
        pendingAttachments = [];
        renderAttachmentsPreview();
        elements.welcomeContainer.style.display = 'none';

        elements.messagesFeed.insertAdjacentHTML('beforeend', renderMessageHTML(userMsg));
        
        // Scroll ONCE to bottom when sending new message
        scrollToBottom();

        await executeAssistantStreamingRequest(conv, requestedFileFormat, textPrompt);
    }

    async function regenerateLastResponse() {
        const conv = getCurrentConversation();
        if (!conv || conv.messages.length === 0) return;

        if (conv.messages[conv.messages.length - 1].role === 'assistant') {
            conv.messages.pop();
            saveConversationsToStorage();
            loadCurrentConversation();
        }

        const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
        const requestedFormat = lastUserMsg ? lastUserMsg.requestedFileFormat : null;
        const promptText = lastUserMsg ? lastUserMsg.text : '';

        await executeAssistantStreamingRequest(conv, requestedFormat, promptText);
    }

    async function executeAssistantStreamingRequest(conv, requestedFileFormat, promptText, isContinuation = false) {
        let assistantMsgPlaceholder;

        if (isContinuation) {
            assistantMsgPlaceholder = conv.messages[conv.messages.length - 1];
        } else {
            assistantMsgPlaceholder = {
                role: 'assistant',
                text: '',
                durationSeconds: 0,
                timestamp: new Date().toISOString()
            };
            conv.messages.push(assistantMsgPlaceholder);
            elements.messagesFeed.insertAdjacentHTML('beforeend', renderMessageHTML(assistantMsgPlaceholder));
        }

        const assistantElems = elements.messagesFeed.querySelectorAll('.message-item.assistant');
        const currentAssistantElem = assistantElems[assistantElems.length - 1];
        const bubbleElem = currentAssistantElem.querySelector('.message-bubble');
        const textContainer = currentAssistantElem.querySelector('.message-text');

        const startTime = performance.now();
        let animationFrameId = null;

        function updateTimer() {
            const elapsedSeconds = (performance.now() - startTime) / 1000;
            assistantMsgPlaceholder.durationSeconds = elapsedSeconds;

            const existingThinking = bubbleElem.querySelector('.thinking-line');
            const thinkingHTML = renderThinkingLineHTML(elapsedSeconds, true);

            if (existingThinking) {
                existingThinking.outerHTML = thinkingHTML;
            } else {
                bubbleElem.insertAdjacentHTML('afterbegin', thinkingHTML);
            }

            if (isGenerating) {
                animationFrameId = requestAnimationFrame(updateTimer);
            }
        }

        setGeneratingState(true);
        animationFrameId = requestAnimationFrame(updateTimer);

        if (!isContinuation) {
            textContainer.innerHTML = '<span class="streaming-cursor"></span>';
        }

        // Build Clean Anthropic History Payload
        const messagesHistory = [];
        conv.messages.forEach(m => {
            if (m === assistantMsgPlaceholder && !isContinuation) return;
            if (m.role !== 'user' && m.role !== 'assistant') return;

            const hasText = m.text && m.text.trim().length > 0;
            const hasAtt = m.attachments && m.attachments.length > 0;

            if (!hasText && !hasAtt) return;

            let contentArr = [];

            if (hasAtt) {
                m.attachments.forEach(att => {
                    if (att.type === 'image') {
                        contentArr.push({
                            type: 'image',
                            source: { type: 'base64', media_type: att.mimeType, data: att.base64 }
                        });
                    } else if (att.type === 'pdf' && att.base64) {
                        contentArr.push({
                            type: 'document',
                            source: { type: 'base64', media_type: 'application/pdf', data: att.base64 }
                        });
                    } else if (att.content) {
                        contentArr.push({
                            type: 'text',
                            text: `[Archivo: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\`\n`
                        });
                    }
                });
            }

            if (hasText) {
                contentArr.push({ type: 'text', text: m.text });
            }

            messagesHistory.push({
                role: m.role,
                content: contentArr.length === 1 && contentArr[0].type === 'text' ? contentArr[0].text : contentArr
            });
        });

        if (isContinuation) {
            messagesHistory.push({
                role: 'user',
                content: 'Continúa la respuesta anterior exactamente desde la última palabra sin repetir lo ya generado.'
            });
        }

        // Single-turn Identity Injection if asked
        let systemPrompt = undefined;
        const modelName = MODELS_MAP[selectedModel] || 'Opus 5 Thinking';
        const effortName = EFFORT_MAP[selectedEffort] || 'Alto';

        if (isModelIdentityQuery(promptText) && isEffortQuery(promptText)) {
            systemPrompt = `El modelo seleccionado actualmente es ${modelName} y el nivel de esfuerzo es ${effortName}. Responde únicamente con esa información.`;
        } else if (isModelIdentityQuery(promptText)) {
            systemPrompt = `El modelo seleccionado actualmente es ${modelName}. Responde únicamente que eres ${modelName}.`;
        } else if (isEffortQuery(promptText)) {
            systemPrompt = `El nivel de esfuerzo seleccionado es ${effortName}. Responde únicamente que utilizas el nivel ${effortName}.`;
        }

        // Request Payload
        const requestPayload = {
            model: selectedModel,
            max_tokens: 4096,
            messages: messagesHistory,
            stream: true
        };

        if (systemPrompt) {
            requestPayload.system = systemPrompt;
        }

        abortController = new AbortController();

        try {
            let response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey.trim(),
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestPayload),
                signal: abortController.signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const reader = response.body.getReader();
            activeReader = reader;
            const decoder = new TextDecoder('utf-8');
            let accumulatedText = assistantMsgPlaceholder.text || '';
            let buffer = '';
            let lastStopReason = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':')) continue;

                    if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.slice(6);
                        if (dataStr === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(dataStr);
                            let textChunk = '';

                            if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                                textChunk = parsed.delta.text;
                            } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                textChunk = parsed.choices[0].delta.content;
                            }

                            if (parsed.delta && parsed.delta.stop_reason) {
                                lastStopReason = parsed.delta.stop_reason;
                            } else if (parsed.stop_reason) {
                                lastStopReason = parsed.stop_reason;
                            }

                            if (textChunk) {
                                accumulatedText += textChunk;
                                assistantMsgPlaceholder.text = accumulatedText;
                                textContainer.innerHTML = parseMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
                            }
                        } catch (e) {}
                    }
                }
            }

            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            const finalDuration = (performance.now() - startTime) / 1000;
            assistantMsgPlaceholder.durationSeconds = (assistantMsgPlaceholder.durationSeconds || 0) + finalDuration;
            assistantMsgPlaceholder.text = accumulatedText;

            // Handle Auto Continuation if max_tokens reached
            if (lastStopReason === 'max_tokens' || lastStopReason === 'length') {
                saveConversationsToStorage();
                return await executeAssistantStreamingRequest(conv, requestedFileFormat, promptText, true);
            }

            // Automatic File Delivery Card Creation
            if (requestedFileFormat) {
                const extMap = { pdf: 'pdf', docx: 'docx', xlsx: 'xlsx', csv: 'csv', html: 'html', txt: 'txt' };
                const fmtExt = extMap[requestedFileFormat] || 'file';
                const fileCardName = `documento-aizen.${fmtExt}`;

                assistantMsgPlaceholder.generatedFile = {
                    name: fileCardName,
                    typeLabel: `Documento ${fmtExt.toUpperCase()}`,
                    size: formatFileSize(accumulatedText.length),
                    format: requestedFileFormat,
                    content: accumulatedText
                };
            }

            saveConversationsToStorage();
            renderConversationsList();
            loadCurrentConversation();

        } catch (err) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (err.name === 'AbortError') {
                assistantMsgPlaceholder.text += '\n\n_[Generación detenida.]_';
                textContainer.innerHTML = parseMarkdown(assistantMsgPlaceholder.text);
            } else {
                console.error('API Request Error:', err);
                showError('Error en la solicitud API', err.message);
                if (!assistantMsgPlaceholder.text) conv.messages.pop();
            }
            saveConversationsToStorage();
        } finally {
            setGeneratingState(false);
            abortController = null;
            activeReader = null;
            updateSendBtnState();
        }
    }

    function stopGeneration() {
        if (abortController) {
            try { abortController.abort(); } catch(e) {}
        }
        if (activeReader) {
            try { activeReader.cancel(); } catch(e) {}
        }
        setGeneratingState(false);
        abortController = null;
        activeReader = null;
        updateSendBtnState();
    }

    function setGeneratingState(generating) {
        isGenerating = generating;
        updateSendBtnState();
        if (generating) {
            elements.sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
            elements.sendBtn.title = 'Detener';
        } else {
            elements.sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
            elements.sendBtn.title = 'Enviar mensaje';
        }
    }

    function showError(title, message) {
        elements.errorTitle.textContent = title;
        elements.errorMessage.textContent = message;
        elements.errorBanner.classList.remove('hidden');
    }

    function hideError() {
        elements.errorBanner.classList.add('hidden');
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
EOF
