// Zenx AI Chat Assistant - Frontend Logic
// Author: Iscordian
// Description: This script handles all client-side functionality including UI interactions,
// state management with localStorage, and API communication with the backend.

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. DOM Element References ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle'); // Desktop collapse
    const mobileMenuBtn = document.getElementById('mobile-menu-btn'); // Mobile open
    const sidebarCloseMobile = document.getElementById('sidebar-close-mobile'); // Mobile close
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const newChatBtn = document.getElementById('new-chat-btn');
    const aiModelSelect = document.getElementById('aiModelSelect');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const contentArea = document.getElementById('content-area');
    const chatView = document.getElementById('chat-view');
    const infoView = document.getElementById('info-view');
    const pageTitle = document.getElementById('page-title');
    const infoLink = document.getElementById('info-link');
    const termsLink = document.getElementById('terms-link');
    const privacyLink = document.getElementById('privacy-link'); // New Privacy Policy link

    // --- 2. Application State ---
    let conversationHistory = [];
    let responseCache = {};
    
    // =================================================================================
    // !! IMPORTANT !!
    // For local desktop testing, use 'http://localhost:3000/api/chat'.
    // For testing on your mobile device, replace 'localhost' with your computer's 
    // local IP address (e.g., 'http://192.168.1.5:3000/api/chat').
    // =================================================================================
    const backendUrl = 'https://zenx-backend.onrender.com/api/chat'; 

    // --- 3. Initialization ---
    function initializeApp() {
        loadStateFromLocalStorage();
        setupEventListeners();
        adjustTextareaHeight();
    }

    // --- 4. State Management (localStorage) ---
    function loadStateFromLocalStorage() {
        // Load sidebar state (only for desktop)
        const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isSidebarCollapsed && window.innerWidth >= 768) {
            sidebar.classList.add('collapsed');
        }

        // Load AI model
        const savedModel = localStorage.getItem('aiModel');
        if (savedModel) {
            aiModelSelect.value = savedModel;
        }

        // Load chat history
        const savedHistory = localStorage.getItem('conversationHistory');
        if (savedHistory) {
            conversationHistory = JSON.parse(savedHistory);
            conversationHistory.forEach(msg => renderMessage(msg.role, msg.parts[0].text, true));
            scrollToBottom(true); // Scroll to bottom on initial load
        }
    }

    function saveChatHistory() {
        localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
    }

    function saveModelSelection() {
        localStorage.setItem('aiModel', aiModelSelect.value);
    }

    function saveSidebarState() {
        // Only save the collapsed state, mobile overlay is transient
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }

    // --- 5. Event Listeners Setup ---
    function setupEventListeners() {
        sidebarToggle.addEventListener('click', toggleDesktopSidebar);
        mobileMenuBtn.addEventListener('click', openMobileSidebar);
        sidebarCloseMobile.addEventListener('click', closeMobileSidebar);
        sidebarBackdrop.addEventListener('click', closeMobileSidebar);
        newChatBtn.addEventListener('click', startNewChat);
        sendBtn.addEventListener('click', handleSendMessage);
        userInput.addEventListener('keydown', handleInputKeyDown);
        userInput.addEventListener('input', adjustTextareaHeight);
        aiModelSelect.addEventListener('change', saveModelSelection);
        infoLink.addEventListener('click', (e) => { e.preventDefault(); showInfoPage('info'); });
        termsLink.addEventListener('click', (e) => { e.preventDefault(); showInfoPage('terms'); });
        privacyLink.addEventListener('click', (e) => { e.preventDefault(); showInfoPage('privacy'); }); // New event listener
    }

    // --- 6. Core Functionality ---

    // For desktop: collapses the sidebar to icon-only view
    function toggleDesktopSidebar() {
        sidebar.classList.toggle('collapsed');
        saveSidebarState();
    }

    // For mobile: shows the sidebar as an overlay
    function openMobileSidebar() {
        sidebar.classList.add('is-open');
        sidebar.classList.remove('-translate-x-full');
        sidebarBackdrop.classList.remove('hidden');
    }

    // For mobile: hides the sidebar overlay
    function closeMobileSidebar() {
        sidebar.classList.remove('is-open');
        sidebar.classList.add('-translate-x-full');
        sidebarBackdrop.classList.add('hidden');
    }

    function startNewChat() {
        if (confirm('Are you sure you want to start a new chat? Your current conversation will be cleared.')) {
            conversationHistory = [];
            responseCache = {}; // Clear cache
            chatMessages.innerHTML = '';
            localStorage.removeItem('conversationHistory');
            showInfoPage('chat'); // Ensure chat view is visible
            if (window.innerWidth < 768) closeMobileSidebar(); // Close menu on mobile
        }
    }

    function handleSendMessage() {
        const prompt = userInput.value.trim();
        if (!prompt || sendBtn.disabled) return;

        addToHistory('user', prompt);
        renderMessage('user', prompt);
        userInput.value = '';
        adjustTextareaHeight();
        
        const cacheKey = `${aiModelSelect.value}-${prompt}`;
        if (responseCache[cacheKey]) {
            const cachedResponse = responseCache[cacheKey];
            addToHistory('model', cachedResponse);
            renderMessage('model', cachedResponse);
        } else {
            fetchAIResponse(prompt);
        }
    }
    
    async function fetchAIResponse(prompt) {
        showTypingIndicator();
        sendBtn.disabled = true;

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    model: aiModelSelect.value,
                    history: conversationHistory.slice(0, -1) 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown network error occurred.');
            }

            const data = await response.json();
            const aiText = data.text;

            addToHistory('model', aiText);
            hideTypingIndicator(); // Hide indicator before rendering message
            renderMessage('model', aiText);
            
            const cacheKey = `${aiModelSelect.value}-${prompt}`;
            responseCache[cacheKey] = aiText;

        } catch (error) {
            console.error('API Error:', error);
            hideTypingIndicator();
            renderMessage('error', `Oops! Something went wrong. ${error.message}`);
        } finally {
            sendBtn.disabled = false;
        }
    }

    function handleInputKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    function addToHistory(role, text) {
        conversationHistory.push({ role, parts: [{ text }] });
        saveChatHistory();
    }

    // --- 7. UI Rendering Functions ---

    function renderMessage(role, text, isInitialLoad = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex items-start gap-3 ${role === 'user' ? 'justify-end' : ''}`;
        
        const icon = document.createElement('img');
        icon.className = 'w-8 h-8 rounded-full mt-1 flex-shrink-0';
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        if (role === 'user') {
            messageBubble.classList.add('user-message');
            icon.src = 'https://placehold.co/40x40/7c3aed/ffffff?text=U';
            icon.alt = 'User Icon';
        } else if (role === 'model') {
            messageBubble.classList.add('ai-message');
            icon.src = 'https://placehold.co/40x40/8855ed/ffffff?text=Z';
            icon.alt = 'AI Icon';
        } else { // Error case
             messageBubble.className = 'message-bubble ai-message bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
             icon.src = 'https://placehold.co/40x40/ef4444/ffffff?text=!';
             icon.alt = 'Error Icon';
        }
        
        const formattedText = text.replace(/\n/g, '<br>');
        messageBubble.innerHTML = `<div class="message-content">${formattedText}</div>`;

        if (role === 'user') {
            messageWrapper.append(messageBubble, icon);
        } else {
            messageWrapper.append(icon, messageBubble);
        }

        chatMessages.appendChild(messageWrapper);
        
        if (!isInitialLoad) {
            scrollToBottom();
        }
    }

    function showTypingIndicator() {
        hideTypingIndicator();
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'flex items-start gap-3';
        indicator.innerHTML = `
            <img src="https://placehold.co/40x40/8855ed/ffffff?text=Z" alt="AI Icon" class="w-8 h-8 rounded-full mt-1">
            <div class="message-bubble ai-message">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(indicator);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
    }

    function scrollToBottom(isInstant = false) {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: isInstant ? 'instant' : 'smooth'
        });
    }

    function showInfoPage(page) {
        if (window.innerWidth < 768) closeMobileSidebar();
        chatView.classList.add('hidden');
        infoView.classList.remove('hidden');
        let content = '';
        if (page === 'info') {
            pageTitle.textContent = 'Information';
            content = `
                <h2 class="text-3xl font-bold mb-4 text-gray-800 dark:text-white">About Zenx AI</h2>
                <p class="mb-4">Zenx AI is an intelligent chat assistant designed to help students with their academic needs. Whether you need assistance with homework, solving math problems, or general knowledge questions, Zenx AI is here to provide quick and comprehensive responses.</p>
                <p class="mb-4">Our goal is to make learning more accessible and efficient for students of all levels. Zenx AI leverages advanced AI models like Gemini and ChatGPT to understand your queries and provide accurate and relevant information.</p>
                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">Key Features:</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li><strong>Homework Help:</strong> Get assistance with various subjects and assignments.</li>
                    <li><strong>Math Solver:</strong> Input equations and receive step-by-step solutions.</li>
                    <li><strong>General Q&A:</strong> Ask anything and get informative answers.</li>
                    <li><strong>Personalized Learning:</strong> Tailored responses to fit your learning style.</li>
                </ul>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-6">Zenx AI is constantly learning and improving. We are committed to providing a reliable and helpful tool for your educational journey.</p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">&copy; 2025 Zenx AI. All rights reserved.</p>
                <button id="backToChatBtn" class="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors">
                    Back to Chat
                </button>
            `;
        } else if (page === 'terms') {
            pageTitle.textContent = 'Terms of Service';
            content = `
                <h2 class="text-3xl font-bold mb-4 text-gray-800 dark:text-white">Terms of Service</h2>
                <p class="mb-4">Welcome to Zenx AI! These Terms of Service ("Terms") govern your use of the Zenx AI chat assistant application (the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.</p>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">1. Use of Service</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>You must be at least 13 years old to use this Service.</li>
                    <li>You agree to use the Service only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the Service.</li>
                    <li>You are responsible for all your activity in connection with the Service.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">2. Content and Accuracy</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>Zenx AI utilizes advanced AI models and aims to provide accurate information. However, AI can make mistakes. We do not guarantee the accuracy, completeness, or usefulness of any information provided through the Service.</li>
                    <li>You should independently verify any critical information obtained from the Service.</li>
                    <li>The Service is provided for informational and educational purposes only and does not constitute professional advice.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">3. Privacy</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>Your privacy is important to us. Please refer to our Privacy Policy for information on how we collect, use, and disclose your information.</li>
                    <li>We do not store your conversation history on our servers beyond what is necessary to facilitate the current chat session and improve the service. You can clear your local chat history at any time by starting a new chat.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">4. Intellectual Property</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>The Service and its original content, features, and functionality are and will remain the exclusive property of Iscordian and its licensors.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">5. Limitation of Liability</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>In no event shall Iscordian, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">6. Changes to Terms</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">7. Contact Us</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>If you have any questions about these Terms, please contact us at [iscordian.dev@gmail.com].</li>
                </ul>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-6">Last updated: July 8, 2025</p>
                <button id="backToChatBtn" class="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors">
                    Back to Chat
                </button>
            `;
        } else if (page === 'privacy') { // New Privacy Policy content
            pageTitle.textContent = 'Privacy Policy';
            content = `
                <h2 class="text-3xl font-bold mb-4 text-gray-800 dark:text-white">Privacy Policy</h2>
                <p class="mb-4">Your privacy is critically important to us. This Privacy Policy describes how Zenx AI ("we," "us," or "our") collects, uses, and discloses information when you use our Zenx AI chat assistant application (the "Service").</p>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">1. Information We Do Not Collect</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li><strong>Personal Identifiable Information (PII):</strong> We do not ask for, collect, or store any personal identifiable information such as your name, email address, IP address, location, or any other data that could identify you personally.</li>
                    <li><strong>User Accounts:</strong> Zenx AI does not require user accounts, logins, or registrations. Therefore, we do not store any user-specific data tied to an account.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">2. Information We Handle (Locally and Transiently)</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li><strong>Conversation History:</strong> Your chat conversations are temporarily stored in your browser's local storage (localStorage) for the duration of your session or until you clear your browser data or start a new chat. This history is only accessible by your browser and is *not* sent to or stored on our servers.</li>
                    <li><strong>AI Model Selection:</strong> Your preference for the AI model (Gemini or ChatGPT) is stored locally in your browser's localStorage for convenience, so your selection persists between sessions. This information is also *not* sent to our servers.</li>
                    <li><strong>Prompts Sent to AI Providers:</strong> When you send a message, your prompt and a limited portion of the preceding conversation history (necessary for the AI to maintain context) are sent to the selected AI model provider (e.g., Google Gemini API, OpenAI ChatGPT API) to generate a response. We do not store these prompts or responses on our servers. The data handling practices of these third-party AI providers are governed by their respective privacy policies.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">3. How Your Information is Used (or Not Used)</h3>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li>Since we do not collect PII, we cannot use it for advertising, tracking, or selling to third parties.</li>
                    <li>Local storage of chat history and model selection is solely for your convenience and to provide a continuous user experience within your browser.</li>
                    <li>Prompts sent to AI providers are used to generate responses and enable the core functionality of the chat assistant.</li>
                </ul>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">4. Third-Party Services</h3>
                <p class="mb-4">Zenx AI relies on third-party AI model providers (e.g., Google Gemini, OpenAI ChatGPT) to process your queries and generate responses. We encourage you to review the privacy policies of these providers to understand their data handling practices:</p>
                <ul class="list-disc list-inside mb-4 space-y-2">
                    <li><a href="https://policies.google.com/privacy" target="_blank" class="text-purple-400 hover:underline">Google Privacy Policy (for Gemini)</a></li>
                    <li><a href="https://openai.com/privacy/" target="_blank" class="text-purple-400 hover:underline">OpenAI Privacy Policy (for ChatGPT)</a></li>
                </ul>
                <p class="mb-4">We are not responsible for the privacy practices of these third-party services.</p>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">5. Security</h3>
                <p class="mb-4">While we do not handle sensitive personal data on our servers, we implement reasonable security measures within the application to protect the integrity of the local data in your browser. However, no method of transmission over the Internet or method of electronic storage is 100% secure.</p>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">6. Changes to This Privacy Policy</h3>
                <p class="mb-4">We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>

                <h3 class="text-2xl font-bold mt-6 mb-2 text-gray-800 dark:text-white">7. Contact Us</h3>
                <p class="mb-4">If you have any questions or concerns about this Privacy Policy, please contact us at [iscordian.dev@gmail.com].</p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-6">Last updated: July 8, 2025</p>
                <button id="backToChatBtn" class="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors">
                    Back to Chat
                </button>
            `;
        } else { // 'chat'
            pageTitle.textContent = 'Zenx AI Chat';
            chatView.classList.remove('hidden');
            infoView.classList.add('hidden');
            return;
        }
        infoView.innerHTML = content;
        
        // Add event listener for the "Back to Chat" button
        const backToChatBtn = document.getElementById('backToChatBtn');
        if (backToChatBtn) {
            backToChatBtn.addEventListener('click', () => showInfoPage('chat'));
        }
    }

    // --- Kick things off ---
    initializeApp();
});
