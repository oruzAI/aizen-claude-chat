/**
 * Aizen — Claude Workspace Logic
 * Pure Client-Side Implementation with Multi-Format File Processing & Real-Time Precision Timer
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

    // State Variables
    let apiKey = (localStorage.getItem(STORAGE_KEY_API_KEY) || '').trim();
    let selectedModel = localStorage.getItem(STORAGE_KEY_MODEL) || 'nghi/claude-opus-5-thinking';
    let selectedEffort = localStorage.getItem(STORAGE_KEY_EFFORT) || 'high';
    let currentTheme = localStorage.getItem(STORAGE_KEY_THEME) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    let conversations = JSON.parse(localStorage.getItem(STORAGE_KEY_CONVERSATIONS) || '[]');
    let currentConvId = localStorage.getItem(STORAGE_KEY_CURRENT_ID) || null;
    
    let pendingAttachments = []; // Array of { id, file, type, name, sizeFormatted, status: 'processing'|'ready'|'error', content, base64 }
    let isGenerating = false;
    let abortController = null;

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
        
        modelSelect: document.getElementById('modelSelect'),
        effortWrapper: document.getElementById('effortWrapper'),
        effortSelect: document.getElementById('effortSelect'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        activeChatTitle: document.getElementById('activeChatTitle'),
        
        clearChatBtn: document.getElementById('clearChatBtn'),
        mobileMenuMoreBtn: document.getElementById('mobileMenuMoreBtn'),
        mobileOverflowMenu: document.getElementById('mobileOverflowMenu'),
        mobileClearBtn: document.getElementById('mobileClearBtn'),
        
        chatViewport: document.getElementById('chatViewport'),
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
        sendBtn: document.getElementById('sendBtn'),
        
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
        applyTheme(currentTheme);
        setupEventListeners();
        updateApiKeyUI();
        initSelectors();
        
        if (!currentConvId && conversations.length > 0) {
            currentConvId = conversations[0].id;
        }
        
        renderConversationsList();
        loadCurrentConversation();
    }

    // Theme Logic
    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem(STORAGE_KEY_THEME, theme);
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            elements.themeToggleBtn.querySelector('.sun-icon').classList.add('hidden');
            elements.themeToggleBtn.querySelector('.moon-icon').classList.remove('hidden');
        } else {
            document.body.classList.remove('dark-theme');
            elements.themeToggleBtn.querySelector('.sun-icon').classList.remove('hidden');
            elements.themeToggleBtn.querySelector('.moon-icon').classList.add('hidden');
        }
    }

    function toggleTheme() {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // Theme Toggle
        elements.themeToggleBtn.addEventListener('click', toggleTheme);

        // Sidebar
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
        });

        // Selectors
        elements.modelSelect.addEventListener('change', (e) => {
            selectedModel = e.target.value;
            localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
            checkEffortVisibility();
        });

        elements.effortSelect.addEventListener('change', (e) => {
            selectedEffort = e.target.value;
            localStorage.setItem(STORAGE_KEY_EFFORT, selectedEffort);
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

        // Textarea & Send
        elements.userInput.addEventListener('input', autoResizeTextarea);
        elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        elements.sendBtn.addEventListener('click', () => {
            if (isGenerating) {
                stopGeneration();
            } else {
                sendMessage();
            }
        });

        // Attachments
        elements.attachFileBtn.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', handleFileSelection);

        // Error Banner
        elements.closeErrorBtn.addEventListener('click', hideError);

        // Event Delegation for Messages Feed
        elements.messagesFeed.addEventListener('click', handleFeedActions);
    }

    function autoResizeTextarea() {
        elements.userInput.style.height = 'auto';
        elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 160) + 'px';
    }

    function initSelectors() {
        elements.modelSelect.value = selectedModel;
        elements.effortSelect.value = selectedEffort;
        checkEffortVisibility();
    }

    function checkEffortVisibility() {
        if (selectedModel === 'nghi/claude-haiku-4.5') {
            elements.effortWrapper.style.display = 'none';
        } else {
            elements.effortWrapper.style.display = 'flex';
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
        setTimeout(closeApiKeyModal, 700);
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

    // File Processing (Images, PDF, DOCX, XLSX, Text)
    async function handleFileSelection(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        // Disables Send button while processing
        updateSendBtnState();

        for (const file of files) {
            const fileId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            const sizeFormatted = formatFileSize(file.size);
            const attItem = {
                id: fileId,
                file,
                name: file.name,
                sizeFormatted,
                type: getFileType(file.name, file.type),
                status: 'processing',
                content: '',
                base64: ''
            };

            pendingAttachments.push(attItem);
            renderAttachmentsPreview();

            try {
                if (file.size > 25 * 1024 * 1024) {
                    throw new Error('El archivo supera el límite recomendado de 25MB.');
                }

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
        const ext = att.name.split('.').pop().toLowerCase();

        if (att.type === 'image') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    att.dataUrl = e.target.result;
                    att.base64 = e.target.result.split(',')[1];
                    att.mimeType = file.type || 'image/png';
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        if (att.type === 'pdf') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    att.dataUrl = e.target.result;
                    att.base64 = e.target.result.split(',')[1];

                    // Extract text with PDF.js if available
                    if (window.pdfjsLib) {
                        try {
                            const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) });
                            const pdf = await loadingTask.promise;
                            let fullText = '';
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const content = await page.getTextContent();
                                const strings = content.items.map(item => item.str);
                                fullText += `--- Página ${i} ---\n` + strings.join(' ') + '\n\n';
                            }
                            att.content = fullText.trim();
                        } catch (pdfErr) {
                            console.warn('PDF.js text extraction fallback:', pdfErr);
                        }
                    }
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
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
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject(new Error('Librería Mammoth.js no disponible'));
                    }
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
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject(new Error('Librería SheetJS no disponible'));
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }

        // Plain Text / CSV / Code
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                att.content = e.target.result;
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
        elements.sendBtn.disabled = isProcessing || isGenerating;
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

    // Precision Thinking Timer Renderer
    function renderThinkingBoxHTML(durationSeconds, isThinking) {
        let label = '';

        if (isThinking) {
            label = `Pensando… ${formatDuration(durationSeconds, true)}`;
        } else {
            label = `Pensó durante ${formatDuration(durationSeconds, false)}`;
        }

        return `
            <div class="thinking-accordion">
                <div class="thinking-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <span class="thinking-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        <span class="timer-label">${escapeHtml(label)}</span>
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </div>
                <div class="thinking-body">Proceso de razonamiento del modelo completado.</div>
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
            return `${hrs} hora${hrs > 1 ? 's' : ''} ${mins} min ${remainingSec} s`;
        }
        if (mins > 0) {
            return `${mins} minuto${mins > 1 ? 's' : ''} ${remainingSec}${includeHundredths ? '.' + hundredths : ''} segundos`;
        }
        return `${remainingSec}${includeHundredths ? '.' + hundredths : ''} segundos`;
    }

    // Single Clean Action Bar Message Renderer
    function renderMessageHTML(msg) {
        const isUser = msg.role === 'user';
        const roleName = isUser ? 'Tú' : 'Aizen';
        const avatarLetter = isUser ? 'U' : 'A';

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
            thinkingHTML = renderThinkingBoxHTML(msg.durationSeconds, false);
        }

        let bodyHTML = isUser ? `<p>${escapeHtml(msg.text || '').replace(/\n/g, '<br>')}</p>` : parseMarkdown(msg.text || '');

        const actionsHTML = !isUser ? `
            <div class="message-actions">
                <button class="action-icon-btn copy-msg-btn" data-text="${encodeURIComponent(msg.text || '')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copiar</span>
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
                <div class="message-avatar">
                    <span class="avatar-badge">${avatarLetter}</span>
                    <span>${roleName}</span>
                </div>
                <div class="message-bubble">
                    ${attachmentsHTML}
                    ${thinkingHTML}
                    <div class="message-text">${bodyHTML}</div>
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
    function exportMessageAsFormat(rawText, format) {
        const filename = `aizen-export-${Date.now()}`;

        if (format === 'md') {
            downloadBlobFile(rawText, `${filename}.md`, 'text/markdown');
            return;
        }
        if (format === 'txt') {
            downloadBlobFile(rawText, `${filename}.txt`, 'text/plain');
            return;
        }
        if (format === 'html') {
            const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Aizen Export</title><style>body{font-family:sans-serif;padding:30px;line-height:1.6;}</style></head><body>${parseMarkdown(rawText)}</body></html>`;
            downloadBlobFile(htmlContent, `${filename}.html`, 'text/html');
            return;
        }

        if (format === 'pdf') {
            if (window.html2pdf) {
                const element = document.createElement('div');
                element.style.padding = '20px';
                element.style.fontFamily = 'sans-serif';
                element.innerHTML = parseMarkdown(rawText);
                window.html2pdf().from(element).save(`${filename}.pdf`);
            } else {
                downloadBlobFile(rawText, `${filename}.txt`, 'text/plain');
            }
            return;
        }

        if (format === 'xlsx' || format === 'csv') {
            if (window.XLSX) {
                // Try extracting tables
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
                    window.XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
                } else {
                    window.XLSX.writeFile(wb, `${filename}.xlsx`);
                }
            } else {
                downloadBlobFile(rawText, `${filename}.txt`, 'text/plain');
            }
            return;
        }

        if (format === 'docx') {
            // HTML-based Docx Blob fallback
            const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Doc</title></head><body>${parseMarkdown(rawText)}</body></html>`;
            downloadBlobFile(htmlDoc, `${filename}.docx`, 'application/msword');
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

    // Send Message & Streaming Logic with Precision Timer
    async function sendMessage() {
        const cleanApiKey = (apiKey || '').trim();
        if (!cleanApiKey) {
            openApiKeyModal();
            showModalNotice('Ingresa tu API Key para continuar.', 'error');
            return;
        }

        // Ensure no attachments are currently processing
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

        const userMsg = {
            role: 'user',
            text: textPrompt,
            attachments: [...validAttachments],
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
        scrollToBottom();

        await executeAssistantStreamingRequest(conv);
    }

    async function regenerateLastResponse() {
        const conv = getCurrentConversation();
        if (!conv || conv.messages.length === 0) return;

        // If last message is assistant, pop it
        if (conv.messages[conv.messages.length - 1].role === 'assistant') {
            conv.messages.pop();
            saveConversationsToStorage();
            loadCurrentConversation();
        }

        await executeAssistantStreamingRequest(conv);
    }

    async function executeAssistantStreamingRequest(conv) {
        const assistantMsgPlaceholder = {
            role: 'assistant',
            text: '',
            durationSeconds: 0,
            timestamp: new Date().toISOString()
        };

        conv.messages.push(assistantMsgPlaceholder);

        elements.messagesFeed.insertAdjacentHTML('beforeend', renderMessageHTML(assistantMsgPlaceholder));
        const assistantElems = elements.messagesFeed.querySelectorAll('.message-item.assistant');
        const currentAssistantElem = assistantElems[assistantElems.length - 1];
        const bubbleElem = currentAssistantElem.querySelector('.message-bubble');
        const textContainer = currentAssistantElem.querySelector('.message-text');

        // Precision Timer State
        const startTime = performance.now();
        let animationFrameId = null;

        function updateTimer() {
            const elapsedSeconds = (performance.now() - startTime) / 1000;
            assistantMsgPlaceholder.durationSeconds = elapsedSeconds;

            const existingThinking = bubbleElem.querySelector('.thinking-accordion');
            const thinkingHTML = renderThinkingBoxHTML(elapsedSeconds, true);

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

        textContainer.innerHTML = '<span class="streaming-cursor"></span>';
        scrollToBottom();

        // Build Clean Anthropic History Payload
        const messagesHistory = [];
        conv.messages.forEach(m => {
            if (m === assistantMsgPlaceholder) return;
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

        // Construct Request Payload
        const requestPayload = {
            model: selectedModel,
            max_tokens: 4096,
            messages: messagesHistory,
            stream: true
        };

        abortController = new AbortController();

        try {
            const response = await fetch(API_ENDPOINT, {
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
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let buffer = '';

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

                            if (textChunk) {
                                fullText += textChunk;
                                assistantMsgPlaceholder.text = fullText;
                                textContainer.innerHTML = parseMarkdown(fullText) + '<span class="streaming-cursor"></span>';
                                scrollToBottom();
                            }
                        } catch (e) {
                            // Ignore partial JSON chunks
                        }
                    }
                }
            }

            // Finished streaming
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            const finalDuration = (performance.now() - startTime) / 1000;
            assistantMsgPlaceholder.durationSeconds = finalDuration;
            assistantMsgPlaceholder.text = fullText;

            // Final render
            bubbleElem.innerHTML = `
                ${renderThinkingBoxHTML(finalDuration, false)}
                <div class="message-text">${parseMarkdown(fullText)}</div>
                <div class="message-actions">
                    <button class="action-icon-btn copy-msg-btn" data-text="${encodeURIComponent(fullText)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        <span>Copiar</span>
                    </button>
                    
                    <div class="download-wrapper">
                        <button class="action-icon-btn download-trigger-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            <span>Descargar como ▾</span>
                        </button>
                        <div class="download-menu hidden">
                            <button class="download-option" data-fmt="pdf" data-text="${encodeURIComponent(fullText)}">Documento PDF (.pdf)</button>
                            <button class="download-option" data-fmt="docx" data-text="${encodeURIComponent(fullText)}">Documento Word (.docx)</button>
                            <button class="download-option" data-fmt="xlsx" data-text="${encodeURIComponent(fullText)}">Hoja Excel (.xlsx)</button>
                            <button class="download-option" data-fmt="csv" data-text="${encodeURIComponent(fullText)}">Tabla CSV (.csv)</button>
                            <button class="download-option" data-fmt="md" data-text="${encodeURIComponent(fullText)}">Markdown (.md)</button>
                            <button class="download-option" data-fmt="txt" data-text="${encodeURIComponent(fullText)}">Texto (.txt)</button>
                            <button class="download-option" data-fmt="html" data-text="${encodeURIComponent(fullText)}">Página Web (.html)</button>
                        </div>
                    </div>

                    <button class="action-icon-btn regenerate-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        <span>Regenerar</span>
                    </button>
                </div>
            `;

            saveConversationsToStorage();
            renderConversationsList();

        } catch (err) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (err.name === 'AbortError') {
                assistantMsgPlaceholder.text += '\n\n_[Generación detenida.]_';
                textContainer.innerHTML = parseMarkdown(assistantMsgPlaceholder.text);
            } else {
                console.error('API Request Error:', err);
                showError('Error en la solicitud API', err.message);
                conv.messages.pop();
            }
            saveConversationsToStorage();
        } finally {
            setGeneratingState(false);
            abortController = null;
            updateSendBtnState();
        }
    }

    function stopGeneration() {
        if (abortController) {
            abortController.abort();
        }
    }

    function setGeneratingState(generating) {
        isGenerating = generating;
        updateSendBtnState();
        if (generating) {
            elements.sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
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
