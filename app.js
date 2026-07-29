/**
 * Aizen — Claude Chat Workspace Application Logic
 * Direct client-side integration with https://api.nghimmo.com/v1/messages
 */

(function () {
    'use strict';

    // API & LocalStorage Keys
    const API_ENDPOINT = 'https://api.nghimmo.com/v1/messages';
    const STORAGE_KEY_API_KEY = 'aizen_api_key';
    const STORAGE_KEY_CONVERSATIONS = 'aizen_conversations';
    const STORAGE_KEY_CURRENT_ID = 'aizen_current_conv_id';
    const STORAGE_KEY_MODELS = 'aizen_models_list';
    const STORAGE_KEY_ACTIVE_MODEL_ID = 'aizen_active_model_id';

    // Default System Models
    const DEFAULT_MODELS = [
        { id: 'nghi/claude-opus-5-thinking', name: 'Claude Opus 5 Thinking', isDefault: true },
        { id: 'nghi/claude-opus-5', name: 'Claude Opus 5', isDefault: true }
    ];

    // State Variables
    let apiKey = (localStorage.getItem(STORAGE_KEY_API_KEY) || '').trim();
    let models = loadStoredModels();
    let activeModelId = localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL_ID) || 'nghi/claude-opus-5-thinking';
    let conversations = JSON.parse(localStorage.getItem(STORAGE_KEY_CONVERSATIONS) || '[]');
    let currentConvId = localStorage.getItem(STORAGE_KEY_CURRENT_ID) || null;
    
    let pendingAttachments = [];
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
        
        openModelsBtn: document.getElementById('openModelsBtn'),
        activeModelLabel: document.getElementById('activeModelLabel'),
        activeChatTitle: document.getElementById('activeChatTitle'),
        
        exportChatBtn: document.getElementById('exportChatBtn'),
        clearChatBtn: document.getElementById('clearChatBtn'),
        mobileMenuMoreBtn: document.getElementById('mobileMenuMoreBtn'),
        mobileOverflowMenu: document.getElementById('mobileOverflowMenu'),
        mobileExportBtn: document.getElementById('mobileExportBtn'),
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
        
        // API Key Modal
        apiKeyModal: document.getElementById('apiKeyModal'),
        closeApiKeyModal: document.getElementById('closeApiKeyModal'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
        clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
        testApiKeyBtn: document.getElementById('testApiKeyBtn'),
        apiKeyNotice: document.getElementById('apiKeyNotice'),

        // Models Modal
        modelsModal: document.getElementById('modelsModal'),
        closeModelsModal: document.getElementById('closeModelsModal'),
        modelList: document.getElementById('modelList'),
        newModelName: document.getElementById('newModelName'),
        newModelId: document.getElementById('newModelId'),
        addCustomModelBtn: document.getElementById('addCustomModelBtn')
    };

    // Load models from localStorage or fallback
    function loadStoredModels() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_MODELS);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Error loading stored models:', e);
        }
        return [...DEFAULT_MODELS];
    }

    function saveModelsState() {
        localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(models));
        localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL_ID, activeModelId);
    }

    function getActiveModel() {
        return models.find(m => m.id === activeModelId) || models[0] || DEFAULT_MODELS[0];
    }

    // App Initialization
    function init() {
        setupEventListeners();
        updateApiKeyUI();
        updateActiveModelUI();
        
        if (!currentConvId && conversations.length > 0) {
            currentConvId = conversations[0].id;
        }
        
        renderConversationsList();
        loadCurrentConversation();
    }

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

        elements.exportChatBtn.addEventListener('click', exportCurrentChat);
        elements.mobileExportBtn.addEventListener('click', () => {
            elements.mobileOverflowMenu.classList.add('hidden');
            exportCurrentChat();
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

        // API Key Modal
        elements.openApiKeyBtn.addEventListener('click', openApiKeyModal);
        elements.closeApiKeyModal.addEventListener('click', closeApiKeyModal);
        elements.apiKeyModal.addEventListener('click', (e) => {
            if (e.target === elements.apiKeyModal) closeApiKeyModal();
        });
        elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
        elements.clearApiKeyBtn.addEventListener('click', clearApiKey);
        elements.testApiKeyBtn.addEventListener('click', testApiKeyConnection);

        // Model Manager Modal
        elements.openModelsBtn.addEventListener('click', openModelsModal);
        elements.closeModelsModal.addEventListener('click', closeModelsModal);
        elements.modelsModal.addEventListener('click', (e) => {
            if (e.target === elements.modelsModal) closeModelsModal();
        });
        elements.addCustomModelBtn.addEventListener('click', handleAddCustomModel);

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

        // Error banner
        elements.closeErrorBtn.addEventListener('click', hideError);

        // Message Feed Actions
        elements.messagesFeed.addEventListener('click', handleFeedActions);
    }

    function autoResizeTextarea() {
        elements.userInput.style.height = 'auto';
        elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 160) + 'px';
    }

    // API Key Management (Preserves raw key)
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
        elements.apiKeyInput.value = apiKey; // Show current key value
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
        showModalNotice('API Key guardada en el navegador.', 'success');
        setTimeout(closeApiKeyModal, 800);
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
            showModalNotice('Por favor ingresa una API Key.', 'error');
            return;
        }

        showModalNotice('Probando conexión con nghimmo API...', 'success');

        try {
            const activeModel = getActiveModel();
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': keyToTest,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: activeModel.id,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Ping' }],
                    stream: false
                })
            });

            if (response.ok) {
                showModalNotice('Conexión exitosa. API Key válida.', 'success');
            } else {
                const errText = await response.text();
                showModalNotice(`Error HTTP ${response.status}: ${errText.slice(0, 100)}`, 'error');
            }
        } catch (err) {
            showModalNotice(`Error de conexión / Red: ${err.message}`, 'error');
        }
    }

    function showModalNotice(msg, type) {
        elements.apiKeyNotice.textContent = msg;
        elements.apiKeyNotice.className = `modal-notice ${type}`;
    }

    // Model Manager Modal
    function updateActiveModelUI() {
        const activeModel = getActiveModel();
        elements.activeModelLabel.textContent = activeModel.name;
    }

    function openModelsModal() {
        renderModelsList();
        elements.modelsModal.classList.remove('hidden');
    }

    function closeModelsModal() {
        elements.modelsModal.classList.add('hidden');
    }

    function renderModelsList() {
        elements.modelList.innerHTML = models.map(m => {
            const isActive = m.id === activeModelId;
            const canDelete = !m.isDefault;

            return `
                <div class="model-item ${isActive ? 'active' : ''}" data-id="${m.id}">
                    <div class="model-info">
                        <span class="model-name">${escapeHtml(m.name)} ${isActive ? '✓' : ''}</span>
                        <span class="model-id-badge">ID: ${escapeHtml(m.id)}</span>
                    </div>
                    <div class="model-item-actions">
                        ${!isActive ? `<button class="model-btn-sm select-model-btn" data-id="${m.id}">Usar</button>` : '<span class="active-badge">Activo</span>'}
                        ${canDelete ? `<button class="model-btn-sm delete-model-btn" data-id="${m.id}">&times;</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        elements.modelList.querySelectorAll('.select-model-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                activeModelId = btn.getAttribute('data-id');
                saveModelsState();
                updateActiveModelUI();
                renderModelsList();
            });
        });

        elements.modelList.querySelectorAll('.delete-model-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idToDelete = btn.getAttribute('data-id');
                models = models.filter(m => m.id !== idToDelete);
                if (activeModelId === idToDelete) {
                    activeModelId = DEFAULT_MODELS[0].id;
                }
                saveModelsState();
                updateActiveModelUI();
                renderModelsList();
            });
        });
    }

    function handleAddCustomModel() {
        const name = elements.newModelName.value.trim();
        const id = elements.newModelId.value.trim();

        if (!name || !id) {
            alert('Por favor ingresa tanto el nombre como el ID exacto del modelo.');
            return;
        }

        if (models.some(m => m.id === id)) {
            alert('Ya existe un modelo registrado con ese ID.');
            return;
        }

        models.push({ id, name, isDefault: false });
        activeModelId = id; // Set as active
        saveModelsState();
        updateActiveModelUI();
        renderModelsList();

        elements.newModelName.value = '';
        elements.newModelId.value = '';
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
                    pendingAttachments.push({ file, type: 'image', name: fileName, mimeType, dataUrl, base64: base64Data });
                    renderAttachmentsPreview();
                };
                reader.readAsDataURL(file);
            } else if (mimeType === 'application/pdf') {
                reader.onload = (evt) => {
                    const dataUrl = evt.target.result;
                    const base64Data = dataUrl.split(',')[1];
                    pendingAttachments.push({ file, type: 'pdf', name: fileName, mimeType: 'application/pdf', dataUrl, base64: base64Data });
                    renderAttachmentsPreview();
                };
                reader.readAsDataURL(file);
            } else {
                reader.onload = (evt) => {
                    const textContent = evt.target.result;
                    pendingAttachments.push({ file, type: 'text', name: fileName, mimeType, textContent });
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

    // Conversations Storage
    function createNewConversation() {
        const id = 'conv_' + Date.now();
        const activeModel = getActiveModel();
        const newConv = {
            id,
            title: 'Nueva conversación',
            created_at: new Date().toISOString(),
            model: activeModel.id,
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

    // Message Renderer
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

        let bodyHTML = isUser ? `<p>${escapeHtml(msg.text || '').replace(/\n/g, '<br>')}</p>` : parseMarkdown(msg.text || '');

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

    // Markdown Parser with single clean buttons
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
            downloadFile(rawText, `aizen-respuesta-${Date.now()}.md`, 'text/markdown');
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
        return map[(lang || '').toLowerCase()] || 'txt';
    }

    // Send Message & Streaming Logic
    async function sendMessage() {
        const cleanApiKey = (apiKey || '').trim();
        if (!cleanApiKey) {
            openApiKeyModal();
            showModalNotice('Ingresa tu API Key de Nghimmo para continuar.', 'error');
            return;
        }

        const textPrompt = elements.userInput.value.trim();
        if (!textPrompt && pendingAttachments.length === 0) return;

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
            attachments: [...pendingAttachments],
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

        const assistantMsgPlaceholder = {
            role: 'assistant',
            text: '',
            timestamp: new Date().toISOString()
        };

        conv.messages.push(assistantMsgPlaceholder);

        elements.messagesFeed.insertAdjacentHTML('beforeend', renderMessageHTML(assistantMsgPlaceholder));
        const assistantElems = elements.messagesFeed.querySelectorAll('.message-item.assistant');
        const currentAssistantElem = assistantElems[assistantElems.length - 1];
        const textContainer = currentAssistantElem.querySelector('.message-text');

        textContainer.innerHTML = '<span class="streaming-cursor"></span>';
        scrollToBottom();

        // Build Clean Anthropic History Payload (Excludes empty/failed messages)
        const activeModel = getActiveModel();
        const messagesHistory = [];

        conv.messages.forEach(m => {
            if (m === assistantMsgPlaceholder) return; // Skip current placeholder

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
                    } else if (att.type === 'pdf') {
                        contentArr.push({
                            type: 'document',
                            source: { type: 'base64', media_type: 'application/pdf', data: att.base64 }
                        });
                    } else if (att.type === 'text') {
                        contentArr.push({
                            type: 'text',
                            text: `[Archivo: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\`\n`
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

        setGeneratingState(true);
        abortController = new AbortController();

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': cleanApiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: activeModel.id,
                    max_tokens: 4096,
                    messages: messagesHistory,
                    stream: true
                }),
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
                            // Non-JSON or partial chunk line
                        }
                    }
                }
            }

            assistantMsgPlaceholder.text = fullText;
            textContainer.innerHTML = parseMarkdown(fullText);

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
                console.error('API Error:', err);
                showError(`Error en solicitud API`, err.message);
                conv.messages.pop(); // Remove placeholder
            }
            saveConversationsToStorage();
        } finally {
            setGeneratingState(false);
            abortController = null;
        }
    }

    function stopGeneration() {
        if (abortController) {
            abortController.abort();
        }
    }

    function setGeneratingState(generating) {
        isGenerating = generating;
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

    function exportCurrentChat() {
        const conv = getCurrentConversation();
        if (!conv || !conv.messages || conv.messages.length === 0) {
            alert('No hay mensajes para exportar.');
            return;
        }

        let exportText = `# Aizen Chat Export — ${conv.title}\n`;
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

    document.addEventListener('DOMContentLoaded', init);
})();
EOF
