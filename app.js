/**
 * Aizen — Claude Chat Workspace Application Logic
 * Pure Client-Side Implementation (No React, No Backend, No npm)
 * Connects directly to https://api.nghimmo.com/v1/messages
 */

(function () {
    'use strict';

    // API & LocalStorage Keys
    const API_ENDPOINT = 'https://api.nghimmo.com/v1/messages';
    const STORAGE_KEY_API_KEY = 'aizen_api_key';
    const STORAGE_KEY_CONVERSATIONS = 'aizen_conversations';
    const STORAGE_KEY_CURRENT_ID = 'aizen_current_conv_id';
    const STORAGE_KEY_MODEL = 'aizen_selected_model';

    // State Variables
    let apiKey = localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    let selectedModel = localStorage.getItem(STORAGE_KEY_MODEL) || 'claude-3-7-sonnet-20250219';
    let conversations = JSON.parse(localStorage.getItem(STORAGE_KEY_CONVERSATIONS) || '[]');
    let currentConvId = localStorage.getItem(STORAGE_KEY_CURRENT_ID) || null;
    let pendingAttachments = []; // Array of { file, type, name, dataUrl, mimeType, base64, textContent }
    let isGenerating = false;
    let abortController = null;

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
        customModelInput: document.getElementById('customModelInput'),
        activeChatTitle: document.getElementById('activeChatTitle'),
        exportChatBtn: document.getElementById('exportChatBtn'),
        clearChatBtn: document.getElementById('clearChatBtn'),
        
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
        setupEventListeners();
        updateApiKeyUI();
        initModelSelector();
        
        if (!currentConvId && conversations.length > 0) {
            currentConvId = conversations[0].id;
        }
        
        renderConversationsList();
        loadCurrentConversation();
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // Sidebar Mobile Toggle
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

        // New Chat & Clear Chat
        elements.newChatBtn.addEventListener('click', () => {
            createNewConversation();
            closeSidebar();
        });
        
        elements.clearChatBtn.addEventListener('click', () => {
            if (confirm('¿Deseas borrar los mensajes de esta conversación?')) {
                clearCurrentChat();
            }
        });

        elements.exportChatBtn.addEventListener('click', exportCurrentChat);

        // API Key Modal
        elements.openApiKeyBtn.addEventListener('click', openApiKeyModal);
        elements.closeApiKeyModal.addEventListener('click', closeApiKeyModal);
        elements.apiKeyModal.addEventListener('click', (e) => {
            if (e.target === elements.apiKeyModal) closeApiKeyModal();
        });
        elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
        elements.clearApiKeyBtn.addEventListener('click', clearApiKey);
        elements.testApiKeyBtn.addEventListener('click', testApiKeyConnection);

        // Model Selector
        elements.modelSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                elements.customModelInput.classList.remove('hidden');
                elements.customModelInput.focus();
            } else {
                elements.customModelInput.classList.add('hidden');
                selectedModel = e.target.value;
                localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
            }
        });

        elements.customModelInput.addEventListener('change', (e) => {
            const val = e.target.value.trim();
            if (val) {
                selectedModel = val;
                localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
            }
        });

        // Starter Prompt Cards
        document.querySelectorAll('.starter-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    elements.userInput.value = prompt;
                    sendMessage();
                }
            });
        });

        // Textarea Auto-Resize & Submit on Enter
        elements.userInput.addEventListener('input', autoResizeTextarea);
        elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Send Button
        elements.sendBtn.addEventListener('click', () => {
            if (isGenerating) {
                stopGeneration();
            } else {
                sendMessage();
            }
        });

        // File Attachments
        elements.attachFileBtn.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', handleFileSelection);

        // Error Banner Close
        elements.closeErrorBtn.addEventListener('click', hideError);

        // Event Delegation for Code Blocks & Message Copy/Download
        elements.messagesFeed.addEventListener('click', handleFeedActions);
    }

    // Auto-resize textarea
    function autoResizeTextarea() {
        elements.userInput.style.height = 'auto';
        elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 200) + 'px';
    }

    // Model selector init
    function initModelSelector() {
        const matchingOption = Array.from(elements.modelSelect.options).find(opt => opt.value === selectedModel);
        if (matchingOption) {
            elements.modelSelect.value = selectedModel;
            elements.customModelInput.classList.add('hidden');
        } else {
            elements.modelSelect.value = 'custom';
            elements.customModelInput.classList.remove('hidden');
            elements.customModelInput.value = selectedModel;
        }
    }

    // API Key UI Update
    function updateApiKeyUI() {
        if (apiKey && apiKey.trim().length > 0) {
            elements.apiKeyStatusText.textContent = 'API Key: Guardada ✓';
            elements.apiKeyStatusText.style.color = 'var(--text-main)';
        } else {
            elements.apiKeyStatusText.textContent = 'API Key: Configurar ⚠️';
            elements.apiKeyStatusText.style.color = '#E53935';
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
        const key = elements.apiKeyInput.value.trim();
        apiKey = key;
        localStorage.setItem(STORAGE_KEY_API_KEY, key);
        updateApiKeyUI();
        showModalNotice('API Key guardada correctamente.', 'success');
        setTimeout(closeApiKeyModal, 1000);
    }

    function clearApiKey() {
        apiKey = '';
        localStorage.removeItem(STORAGE_KEY_API_KEY);
        elements.apiKeyInput.value = '';
        updateApiKeyUI();
        showModalNotice('API Key eliminada.', 'error');
    }

    async function testApiKeyConnection() {
        const keyToTest = elements.apiKeyInput.value.trim() || apiKey;
        if (!keyToTest) {
            showModalNotice('Por favor ingresa una API Key para probar.', 'error');
            return;
        }

        showModalNotice('Probando conexión con nghimmo.com...', 'success');

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
                showModalNotice('¡Conexión exitosa! La API Key es válida.', 'success');
            } else {
                const errText = await response.text();
                showModalNotice(`Error HTTP ${response.status}: ${errText.slice(0, 100)}`, 'error');
            }
        } catch (err) {
            showModalNotice(`Error de conexión / CORS: ${err.message}`, 'error');
        }
    }

    function showModalNotice(msg, type) {
        elements.apiKeyNotice.textContent = msg;
        elements.apiKeyNotice.className = `modal-notice ${type}`;
    }

    // File Attachment Logic
    function handleFileSelection(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            const reader = new FileReader();
            const fileName = file.name;
            const mimeType = file.type || 'application/octet-stream';

            if (mimeType.startsWith('image/')) {
                reader.onload = (evt) => {
                    const dataUrl = evt.target.result;
                    const base64Data = dataUrl.split(',')[1];
                    pendingAttachments.push({
                        file,
                        type: 'image',
                        name: fileName,
                        mimeType,
                        dataUrl,
                        base64: base64Data
                    });
                    renderAttachmentsPreview();
                };
                reader.readAsDataURL(file);
            } else if (mimeType === 'application/pdf') {
                reader.onload = (evt) => {
                    const dataUrl = evt.target.result;
                    const base64Data = dataUrl.split(',')[1];
                    pendingAttachments.push({
                        file,
                        type: 'pdf',
                        name: fileName,
                        mimeType: 'application/pdf',
                        dataUrl,
                        base64: base64Data
                    });
                    renderAttachmentsPreview();
                };
                reader.readAsDataURL(file);
            } else {
                // Text or Code file
                reader.onload = (evt) => {
                    const textContent = evt.target.result;
                    pendingAttachments.push({
                        file,
                        type: 'text',
                        name: fileName,
                        mimeType,
                        textContent
                    });
                    renderAttachmentsPreview();
                };
                reader.readAsText(file);
            }
        });

        elements.fileInput.value = '';
    }

    function renderAttachmentsPreview() {
        if (!pendingAttachments.length) {
            elements.attachmentsPreview.classList.add('hidden');
            elements.attachmentsPreview.innerHTML = '';
            return;
        }

        elements.attachmentsPreview.classList.remove('hidden');
        elements.attachmentsPreview.innerHTML = pendingAttachments.map((att, idx) => `
            <div class="preview-chip">
                <span>${getAttachmentIcon(att.type)} ${escapeHtml(att.name)}</span>
                <button type="button" class="chip-remove" data-idx="${idx}">&times;</button>
            </div>
        `).join('');

        elements.attachmentsPreview.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                pendingAttachments.splice(idx, 1);
                renderAttachmentsPreview();
            });
        });
    }

    function getAttachmentIcon(type) {
        if (type === 'image') return '🖼️';
        if (type === 'pdf') return '📄';
        return '📝';
    }

    // Conversation Storage Management
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

    // Message HTML Renderer
    function renderMessageHTML(msg) {
        const isUser = msg.role === 'user';
        const roleName = isUser ? 'Tú' : 'Aizen (Claude)';
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

        let bodyHTML = '';
        if (isUser) {
            bodyHTML = `<p>${escapeHtml(msg.text || '').replace(/\n/g, '<br>')}</p>`;
        } else {
            bodyHTML = parseMarkdown(msg.text || '');
        }

        const actionsHTML = !isUser ? `
            <div class="message-actions">
                <button class="action-icon-btn copy-msg-btn" data-text="${encodeURIComponent(msg.text || '')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copiar</span>
                </button>
                <button class="action-icon-btn download-msg-btn" data-text="${encodeURIComponent(msg.text || '')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    <span>Descargar .md</span>
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
                    <div class="message-text">${bodyHTML}</div>
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    // Markdown Parser
    function parseMarkdown(text) {
        if (!text) return '';

        // Extract Code Blocks first
        const codeBlocks = [];
        let html = text.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push({ lang: lang || 'code', code: code.trim() });
            return placeholder;
        });

        // HTML Escape
        html = escapeHtml(html);

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold & Italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Inline Code
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Blockquotes
        html = html.replace(/^\&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>');

        // Lists
        html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

        // Paragraphs & Linebreaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;

        // Re-insert Code Blocks
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

    // Handle Copy & Download Click Events
    function handleFeedActions(e) {
        const copyBtn = e.target.closest('.copy-msg-btn');
        if (copyBtn) {
            const rawText = decodeURIComponent(copyBtn.getAttribute('data-text'));
            navigator.clipboard.writeText(rawText);
            showToast(copyBtn, '¡Copiado!');
            return;
        }

        const downloadBtn = e.target.closest('.download-msg-btn');
        if (downloadBtn) {
            const rawText = decodeURIComponent(downloadBtn.getAttribute('data-text'));
            downloadFile(rawText, `respuesta-aizen-${Date.now()}.md`, 'text/markdown');
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
            downloadFile(rawCode, `codigo-${Date.now()}.${ext}`, 'text/plain');
            return;
        }
    }

    function showToast(btn, text) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>${text}</span>`;
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
    }

    function downloadFile(content, fileName, mimeType) {
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
        return map[lang.toLowerCase()] || 'txt';
    }

    // Send Message Logic
    async function sendMessage() {
        if (!apiKey) {
            openApiKeyModal();
            showModalNotice('Debes configurar una API Key de Nghimmo para comenzar.', 'error');
            return;
        }

        const textPrompt = elements.userInput.value.trim();
        if (!textPrompt && pendingAttachments.length === 0) return;

        if (!currentConvId) {
            createNewConversation();
        }

        const conv = getCurrentConversation();
        if (!conv) return;

        // Auto-set title on first user message
        if (conv.messages.length === 0) {
            conv.title = textPrompt.slice(0, 30) || 'Adjunto enviado';
            elements.activeChatTitle.textContent = conv.title;
        }

        // Build User Message Payload
        const userMsg = {
            role: 'user',
            text: textPrompt,
            attachments: [...pendingAttachments],
            timestamp: new Date().toISOString()
        };

        conv.messages.push(userMsg);
        saveConversationsToStorage();

        // Clear input area & hide welcome
        elements.userInput.value = '';
        autoResizeTextarea();
        pendingAttachments = [];
        renderAttachmentsPreview();
        elements.welcomeContainer.style.display = 'none';

        // Render User Message in UI
        elements.messagesFeed.insertAdjacentHTML('beforeend', renderMessageHTML(userMsg));
        scrollToBottom();

        // Prepare Assistant Stream Message Placeholder
        const assistantMsgPlaceholder = {
            role: 'assistant',
            text: '',
            timestamp: new Date().toISOString()
        };

        const placeholderIndex = conv.messages.length;
        conv.messages.push(assistantMsgPlaceholder);

        elements.messagesFeed.insertAdjacentHTML('beforeend', renderMessageHTML(assistantMsgPlaceholder));
        const messageElements = elements.messagesFeed.querySelectorAll('.message-item.assistant');
        const currentAssistantElem = messageElements[messageElements.length - 1];
        const textContainer = currentAssistantElem.querySelector('.message-text');

        textContainer.innerHTML = '<span class="streaming-cursor"></span>';
        scrollToBottom();

        // Prepare Anthropic Messages Request
        const anthropicMessages = conv.messages.slice(0, placeholderIndex).map(m => {
            const role = m.role;
            let content = [];

            if (m.attachments && m.attachments.length) {
                m.attachments.forEach(att => {
                    if (att.type === 'image') {
                        content.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: att.mimeType,
                                data: att.base64
                            }
                        });
                    } else if (att.type === 'pdf') {
                        content.push({
                            type: 'document',
                            source: {
                                type: 'base64',
                                media_type: 'application/pdf',
                                data: att.base64
                            }
                        });
                    } else if (att.type === 'text') {
                        content.push({
                            type: 'text',
                            text: `[Archivo: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\`\n`
                        });
                    }
                });
            }

            if (m.text) {
                content.push({ type: 'text', text: m.text });
            }

            return { role, content };
        });

        // Set UI Generating State
        setGeneratingState(true);
        abortController = new AbortController();

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: selectedModel,
                    max_tokens: 4096,
                    messages: anthropicMessages,
                    stream: true
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`HTTP ${response.status}: ${errBody}`);
            }

            // Stream Reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep uncompleted line

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
                            // Non-JSON or partial chunk line
                        }
                    }
                }
            }

            // Finished streaming
            assistantMsgPlaceholder.text = fullText;
            textContainer.innerHTML = parseMarkdown(fullText);
            
            // Add action buttons
            const actionsHTML = `
                <div class="message-actions">
                    <button class="action-icon-btn copy-msg-btn" data-text="${encodeURIComponent(fullText)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        <span>Copiar</span>
                    </button>
                    <button class="action-icon-btn download-msg-btn" data-text="${encodeURIComponent(fullText)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        <span>Descargar .md</span>
                    </button>
                </div>
            `;
            currentAssistantElem.querySelector('.message-bubble').insertAdjacentHTML('beforeend', actionsHTML);

            saveConversationsToStorage();
            renderConversationsList();

        } catch (err) {
            if (err.name === 'AbortError') {
                assistantMsgPlaceholder.text += '\n\n_[Generación detenida por el usuario.]_';
                textContainer.innerHTML = parseMarkdown(assistantMsgPlaceholder.text);
            } else {
                console.error('Connection error:', err);
                showError('Error de conexión o CORS', formatErrorMessage(err));
                conv.messages.pop(); // Remove placeholder if failed
            }
            saveConversationsToStorage();
        } finally {
            setGeneratingState(false);
            abortController = null;
        }
    }

    function formatErrorMessage(err) {
        const msg = err.message || '';
        if (msg.includes('Failed to fetch')) {
            return 'No se pudo conectar con https://api.nghimmo.com/v1/messages. Esto puede deberse a bloqueos de CORS, problemas de red o certificado SSL. Por favor verifica tu conexión y la validez de tu API Key.';
        }
        if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
            return 'API Key inválida o no autorizada (HTTP 401/403). Por favor revisa la clave configurada en la esquina inferior izquierda.';
        }
        if (msg.includes('HTTP 429')) {
            return 'Límite de peticiones alcanzado (HTTP 429 Rate Limit). Por favor espera unos segundos.';
        }
        return msg;
    }

    function stopGeneration() {
        if (abortController) {
            abortController.abort();
        }
    }

    function setGeneratingState(generating) {
        isGenerating = generating;
        if (generating) {
            elements.sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
            elements.sendBtn.title = 'Detener generación';
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

    function exportCurrentChat() {
        const conv = getCurrentConversation();
        if (!conv || !conv.messages || conv.messages.length === 0) {
            alert('No hay mensajes para exportar en esta conversación.');
            return;
        }

        let exportText = `# Aizen Conversation Export — ${conv.title}\n`;
        exportText += `Fecha: ${new Date(conv.created_at).toLocaleString()}\n`;
        exportText += `Modelo: ${conv.model}\n\n---\n\n`;

        conv.messages.forEach(m => {
            const sender = m.role === 'user' ? '### 👤 Usuario' : '### 🤖 Aizen (Claude)';
            exportText += `${sender}\n\n${m.text || ''}\n\n`;
        });

        downloadFile(exportText, `aizen-chat-${Date.now()}.md`, 'text/markdown');
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
        });
    }

    // Run Init on Load
    document.addEventListener('DOMContentLoaded', init);
})();
