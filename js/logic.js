// === 0. ПРОВЕРКА ===
if (typeof Store === 'undefined' || typeof View === 'undefined') {
    console.error("CRITICAL ERROR: Store or View not loaded!");
    alert("Ошибка загрузки модулей.");
}

const tg = window.Telegram.WebApp;

const Controller = {
    uiState: {
        activeTab: 'view-profile',
        calcMode: 'simple',
        crmFilter: 'all',
        crmSearch: '',
        uploadedFiles: []
    },

    init() {
        tg.ready();
        tg.expand();
        this.initTheme();

        const user = tg.initDataUnsafe?.user;
        Store.init(user);

        console.log(`[App] User: ${user?.id}, Admin: ${Store.state.isAdmin}`);

        // === ИЗМЕНЕНИЕ 1: ПРОВЕРКА РЕГИСТРАЦИИ ===
        const hasProfile = localStorage.getItem('eco_partner_profile');
        if (!hasProfile) {
            // Если нет профиля -> Приветствие, скрыть меню
            this.toggleNavigation(false);
            this.switchTab('view-welcome');
        } else {
            // Если есть профиль -> Показать приложение
            this.toggleNavigation(true);
            this.renderAll();
            // По умолчанию на профиль эколога
            this.switchTab('view-profile');
        }
        
        // Слушатели
        this.setupEventListeners();

        // Скрытие элементов админа
        const adminElements = document.querySelectorAll('.admin-only');
        if (!Store.state.isAdmin) {
            adminElements.forEach(el => el.classList.add('hidden'));
        } else {
            adminElements.forEach(el => el.classList.remove('hidden'));
        }
    },

    initTheme() {
        const apply = () => {
            if (tg.colorScheme) document.body.setAttribute('data-theme', tg.colorScheme);
            if (tg.themeParams?.bg_color) {
                tg.setHeaderColor(tg.themeParams.bg_color);
                tg.setBackgroundColor(tg.themeParams.bg_color);
            }
        };
        apply();
        tg.onEvent('themeChanged', apply);
    },

    // Вспомогательная функция для скрытия меню
    toggleNavigation(isVisible) {
        const nav = document.getElementById('bottom-nav');
        if(nav) nav.style.display = isVisible ? 'flex' : 'none';
    },

    renderAll() {
        this.renderProfile();
        this.renderProjects();
        this.renderCalculator();
        this.renderPartnerArea(); // Обновлено
        if (Store.state.isAdmin) {
            this.renderCRM();
        }
    },

    renderProfile() {
        const container = document.getElementById('view-profile');
        if (container) {
            container.innerHTML = View.renderProfile(Store.state.engineer, Store.state.isAdmin);
            View.initBubblesAnimation('bubbles-cloud');
        }
    },

    renderProjects() {
        const container = document.getElementById('projects-list');
        if (container) {
            const projects = Store.getVisibleProjects();
            container.innerHTML = View.renderProjectsList(projects);
        }
    },

    renderCalculator() {
        const typeSelect = document.getElementById('calc-service-type');
        if (typeSelect && typeSelect.options.length === 0) {
            typeSelect.innerHTML = View.renderServicesOptions(Store.state.services);
            this.updateCalcInputs();
        }
        const listContainer = document.getElementById('services-container');
        if (listContainer) listContainer.innerHTML = View.renderServicesList(Store.state.services);

        const estContainer = document.getElementById('estimate-container');
        if (estContainer) {
            estContainer.innerHTML = View.renderEstimateList(Store.state.estimate, Store.state.services);
            const totalEl = document.getElementById('estimate-total-sum');
            if (totalEl) {
                const total = Store.state.estimate.reduce((acc, obj) => acc + obj.services.reduce((sAcc, s) => sAcc + s.price, 0), 0);
                totalEl.textContent = total.toLocaleString() + ' ₽';
            }
        }
    },

    // Новый рендер личного кабинета
    renderPartnerArea() {
        const data = localStorage.getItem('eco_partner_profile');
        const container = document.getElementById('partner-dashboard');
        
        if (data && container) {
            const profile = JSON.parse(data);
            const myProjects = Store.getVisibleProjects();
            container.innerHTML = View.renderPartnerDashboardEnhanced(profile, myProjects);
            container.classList.remove('hidden');
            document.getElementById('partner-edit-mode')?.classList.add('hidden');
        }
    },

    renderCRM() {
        if (!Store.state.isAdmin) return; 
        const container = document.getElementById('partners-list');
        if (!container) return;

        const partners = Store.getPartners(this.uiState.crmFilter, this.uiState.crmSearch);
        let totalDebt = 0, totalPotential = 0;
        Store.state.partners.forEach(p => {
            totalDebt += p.finance.debt;
            totalPotential += (p.finance.total - p.finance.paid);
        });

        container.innerHTML = View.renderCRM(partners, this.uiState.crmFilter, totalDebt, totalPotential);
    },

    // === СЛУШАТЕЛИ ===
    setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                this.switchTab(targetId);
            });
        });

        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target || target.getAttribute('data-action') === 'edit-est-name-start') return;
            const action = target.getAttribute('data-action');
            this.handleAction(action, target, e);
        });

        document.body.addEventListener('dblclick', (e) => {
            if (e.target.getAttribute('data-action') === 'edit-est-name-start') {
                const wrapper = e.target.closest('.obj-name-wrapper');
                wrapper.querySelector('.obj-name-text').classList.add('hidden');
                const input = wrapper.querySelector('.obj-name-input-edit');
                input.classList.remove('hidden');
                input.focus();
                input.select(); 
            }
        });

        document.body.addEventListener('focusout', (e) => {
            if (e.target.getAttribute('data-action') === 'save-est-name') {
                const idx = Number(e.target.getAttribute('data-obj-idx'));
                Store.updateEstimateObject(idx, 'name', e.target.value.trim() || 'Без названия');
                this.renderCalculator();
            }
        });

        document.body.addEventListener('keydown', (e) => {
            if (e.target.getAttribute('data-action') === 'save-est-name' && e.key === 'Enter') e.target.blur(); 
        });

        document.body.addEventListener('input', (e) => {
            if (e.target.classList.contains('calc-input')) {
                if (e.target.type === 'range') document.getElementById(`val-${e.target.getAttribute('data-id')}`).textContent = e.target.value;
                this.calculateSimpleTotal();
            }
            if (e.target.getAttribute('data-action') === 'crm-search') {
                this.uiState.crmSearch = e.target.value.trim();
                this.renderCRM();
            }
            if (e.target.getAttribute('data-action') === 'update-est-sources') {
                const idx = Number(e.target.getAttribute('data-obj-idx'));
                Store.updateEstimateObject(idx, 'sourcesCount', parseInt(e.target.value) || 0);
            }
        });
        
        document.body.addEventListener('change', (e) => {
            if (e.target.getAttribute('data-action') === 'crm-note-change') {
                Store.updatePartner(Number(e.target.getAttribute('data-id')), { note: e.target.value });
            }
            if (e.target.id === 'calc-service-type') this.updateCalcInputs();
            if (e.target.id === 'calc-file-input') this.handleFileUpload(e.target.files);
            if (e.target.getAttribute('data-action') === 'update-est-service') {
                const objIdx = Number(e.target.getAttribute('data-obj-idx'));
                const srvIdx = Number(e.target.getAttribute('data-srv-idx'));
                const newId = e.target.value;
                const srvInfo = Store.state.services.find(s => s.id === newId);
                if (srvInfo) {
                    Store.state.estimate[objIdx].services[srvIdx] = { serviceId: newId, price: srvInfo.basePrice };
                    this.renderCalculator();
                }
            }
        });
    },

    handleAction(action, target, event) {
        // --- ИЗМЕНЕНИЕ 2: НОВЫЕ ЭКШЕНЫ РЕГИСТРАЦИИ И РЕДАКТИРОВАНИЯ ---
        if (action === 'complete-registration') this.registerNewUser();
        if (action === 'partner-edit') this.openPartnerEdit();
        if (action === 'partner-update') this.updatePartnerProfile();
        if (action === 'cancel-partner-edit') this.closePartnerEdit();
        if (action === 'partner-logout') this.logout();

        if (action === 'contact-telegram') {
            const url = CONFIG.TELEGRAM_LINK;
            if (tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
        }
        if (action === 'nav-to-calc') document.querySelector('.nav-item[data-target="view-services"]').click();
        if (action === 'nav-to-projects') this.switchTab('view-projects');
        if (action === 'open-status-editor') this.openStatusModal();
        if (action === 'open-project-modal') {
            const project = Store.state.projects.find(p => p.id === Number(target.getAttribute('data-id')));
            if (project) this.openProjectModal(project);
        }
        if (action === 'close-modal') document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        if (action === 'switch-calc-mode') this.switchCalcMode(target.getAttribute('data-mode'), target);
        if (action === 'order-calc') this.submitSimpleOrder();
        if (action === 'remove-file') {
            this.uiState.uploadedFiles.splice(Number(target.getAttribute('data-idx')), 1);
            this.renderFileList();
        }
        if (action === 'add-est-obj') {
            Store.addToEstimate({ id: Date.now(), name: `Объект №${Store.state.estimate.length + 1}`, sourcesCount: 10, services: [] });
            this.renderCalculator();
        }
        if (action === 'remove-est-obj') {
            if(confirm('Удалить объект?')) {
                Store.removeFromEstimate(Number(target.getAttribute('data-obj-idx')));
                this.renderCalculator();
            }
        }
        if (action === 'add-est-service') {
            const idx = Number(target.getAttribute('data-obj-idx'));
            if (Store.state.services.length > 0) {
                const s = Store.state.services[0];
                Store.state.estimate[idx].services.push({ serviceId: s.id, price: s.basePrice });
                this.renderCalculator();
            }
        }
        if (action === 'remove-est-service') {
            Store.state.estimate[Number(target.getAttribute('data-obj-idx'))].services.splice(Number(target.getAttribute('data-srv-idx')), 1);
            this.renderCalculator();
        }
        if (action === 'send-estimate') this.submitEstimateOrder();
        if (action === 'crm-filter') {
            this.uiState.crmFilter = target.getAttribute('data-val');
            this.renderCRM();
        }
        if (action === 'crm-toggle-details') {
            const id = target.getAttribute('data-id');
            document.getElementById(`crm-details-${id}`)?.classList.toggle('open');
        }
        if (action === 'crm-copy-inn') {
            navigator.clipboard.writeText(target.getAttribute('data-inn'));
            alert('ИНН скопирован');
        }
        if (action === 'crm-delete') {
            if(confirm('Удалить партнера?')) {
                Store.deletePartner(Number(target.getAttribute('data-id')));
                this.renderCRM();
            }
        }
        if (action === 'crm-rate') {
            event.stopPropagation();
            Store.updatePartner(Number(target.getAttribute('data-id')), { rating: Number(target.getAttribute('data-val')) });
            this.renderCRM();
        }
        if (action === 'crm-open-tg') {
            const username = target.getAttribute('data-username');
            if(username) {
                const url = `https://t.me/${username}`;
                if(tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
            } else { alert('Нет username'); }
        }
        if (action === 'save-status') this.saveAdminStatus();
    },

    // === ИЗМЕНЕНИЕ 3: ЛОГИКА РЕГИСТРАЦИИ И РЕДАКТИРОВАНИЯ ===

    registerNewUser() {
        // 1. Считываем значения
        const name = document.getElementById('w-name').value;
        const contact = document.getElementById('w-contact').value;
        const inn = document.getElementById('w-inn').value; // Новое
        
        // 2. Проверяем валидацию (добавили !inn.trim())
        if (!name.trim() || !contact.trim() || !inn.trim()) {
            alert("Пожалуйста, заполните все поля, включая ИНН");
            return;
        }

        // 3. Сохраняем данные (добавили inn в объект)
        const profileData = { name, contact, inn, email: "" };
        
        let partnerId = Date.now();
        localStorage.setItem('eco_partner_id', partnerId);
        localStorage.setItem('eco_partner_profile', JSON.stringify(profileData));

        // 4. Добавляем в Store для админа (передаем реальный inn)
        Store.addPartner({
            id: partnerId, 
            name, 
            contact, 
            inn: inn, // Передаем введенный ИНН
            username: Store.state.user?.username || "",
            status: "lead", contract: "Нет договора",
            projects: [], finance: { total: 0, paid: 0, debt: 0 },
            rating: 0, note: "Саморегистрация"
        });

        // 5. Переход в приложение
        this.toggleNavigation(true);
        this.renderAll();
        this.switchTab('view-profile');
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    },

    openPartnerEdit() {
        const data = JSON.parse(localStorage.getItem('eco_partner_profile') || '{}');
        document.getElementById('p-name').value = data.name || '';
        document.getElementById('p-contact').value = data.contact || '';
        document.getElementById('p-inn').value = data.inn || '';
        document.getElementById('p-email').value = data.email || '';

        document.getElementById('partner-dashboard').classList.add('hidden');
        document.getElementById('partner-edit-mode').classList.remove('hidden');
    },

    closePartnerEdit() {
        document.getElementById('partner-edit-mode').classList.add('hidden');
        document.getElementById('partner-dashboard').classList.remove('hidden');
    },

    updatePartnerProfile() {
        const name = document.getElementById('p-name').value;
        const contact = document.getElementById('p-contact').value;
        const inn = document.getElementById('p-inn').value;
        const email = document.getElementById('p-email').value;

        if (!name.trim()) { alert("Название обязательно"); return; }

        const profileData = { name, contact, inn, email };
        localStorage.setItem('eco_partner_profile', JSON.stringify(profileData));
        
        // Обновляем в Store
        const partnerId = Number(localStorage.getItem('eco_partner_id'));
        if (partnerId) Store.updatePartner(partnerId, { name, contact, inn });

        this.renderPartnerArea();
        this.closePartnerEdit();
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    },

    logout() {
        if(confirm('Выйти? Ваши данные будут удалены с устройства.')) {
            localStorage.removeItem('eco_partner_profile');
            location.reload();
        }
    },

    // === LOGIC HELPERS (Без изменений) ===

    switchTab(targetId) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');
        document.getElementById(targetId)?.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    },

    updateCalcInputs() {
        const typeSelect = document.getElementById('calc-service-type');
        const container = document.getElementById('dynamic-calc-inputs');
        if (!typeSelect || !container) return;
        const service = Store.state.services.find(s => s.id === typeSelect.value);
        container.innerHTML = View.renderCalculatorInputs(service);
        this.calculateSimpleTotal();
    },

    calculateSimpleTotal() {
        const typeSelect = document.getElementById('calc-service-type');
        if (!typeSelect) return;
        const service = Store.state.services.find(s => s.id === typeSelect.value);
        if (!service) return;
        let total = service.basePrice;
        let days = 10;
        document.querySelectorAll('.calc-input').forEach(input => {
            const paramId = input.getAttribute('data-id');
            const param = service.params.find(p => p.id === paramId);
            if (!param) return;
            if (param.type === 'range' || param.type === 'number') {
                const val = parseInt(input.value) || 0;
                if (param.costPerUnit) total += (val * param.costPerUnit);
                days += Math.floor(val / 5);
            } else if (param.type === 'select') {
                const val = parseInt(input.value);
                const opt = param.options.find(o => o.val === val);
                if (opt?.cost) total += opt.cost;
            } else if (param.type === 'checkbox') {
                if (input.checked && param.cost) total += param.cost;
            }
        });
        document.getElementById('calc-total-price').textContent = total.toLocaleString('ru-RU') + ' ₽';
        document.getElementById('calc-total-time').textContent = `${days}-${days + 5} раб. дней`;
    },

    handleFileUpload(files) {
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                if (!this.uiState.uploadedFiles.includes(file.name)) {
                    this.uiState.uploadedFiles.push(file.name);
                }
            });
            this.renderFileList();
        }
    },

    renderFileList() {
        const container = document.getElementById('file-list-display');
        if (!container) return;
        container.innerHTML = this.uiState.uploadedFiles.map((name, idx) => `
            <div class="file-item"><span style="overflow: hidden; text-overflow: ellipsis;">📎 ${name}</span><i class="fa-solid fa-xmark file-remove" data-action="remove-file" data-idx="${idx}"></i></div>`).join('');
    },

    switchCalcMode(mode, btn) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const simple = document.getElementById('calc-simple-mode');
        const advanced = document.getElementById('calc-advanced-mode');
        if (mode === 'simple') {
            simple.classList.remove('hidden');
            advanced.classList.add('hidden');
        } else {
            simple.classList.add('hidden');
            advanced.classList.remove('hidden');
            if (Store.state.estimate.length === 0) {
                Store.addToEstimate({ id: Date.now(), name: 'Объект №1', sourcesCount: 10, services: [] });
                this.renderCalculator();
            }
        }
    },

    submitSimpleOrder() {
        const typeSelect = document.getElementById('calc-service-type');
        const service = Store.state.services.find(s => s.id === typeSelect.value);
        const priceStr = document.getElementById('calc-total-price').textContent;
        let details = '';
        document.querySelectorAll('.calc-input').forEach(input => {
            const label = input.closest('.form-group').querySelector('label')?.textContent || '';
            let val = input.value;
            if (input.type === 'checkbox') val = input.checked ? 'Да' : 'Нет';
            if (input.tagName === 'SELECT') val = input.options[input.selectedIndex].text;
            details += `\n🔹 ${label}: ${val}`;
        });
        const fileMsg = this.uiState.uploadedFiles.length > 0 ? `\n📎 Файлов: ${this.uiState.uploadedFiles.length}` : '';
        const msg = `👋 *Заявка*\n\n🛠 ${service.name}${details}\n\n💰 ${priceStr}${fileMsg}`;
        this.sendToTelegram(msg);
        this.createProject(service.name);
    },

    submitEstimateOrder() {
        if (Store.state.estimate.length === 0) return;
        let msg = "📑 *КП (Смета):*\n\n";
        let total = 0;
        Store.state.estimate.forEach(obj => {
            msg += `🏭 *${obj.name}* (Источников: ${obj.sourcesCount})\n`;
            obj.services.forEach(srv => {
                const sInfo = Store.state.services.find(s => s.id === srv.serviceId);
                msg += ` — ${sInfo.name}: ${srv.price.toLocaleString()} ₽\n`;
                total += srv.price;
            });
            msg += "\n";
        });
        msg += `💰 *ИТОГО: ${total.toLocaleString()} ₽*`;
        this.sendToTelegram(msg);
        this.createProject("Комплексная смета (КП)");
    },

    sendToTelegram(text) {
        const botLink = CONFIG.TELEGRAM_LINK.replace('https://t.me/', '');
        const url = `https://t.me/${botLink}?text=${encodeURIComponent(text)}`;
        if(tg.openTelegramLink) tg.openTelegramLink(url);
        else window.open(url, '_blank');
    },

    createProject(type) {
        const stored = localStorage.getItem('eco_partner_profile');
        const clientName = stored ? JSON.parse(stored).name : "Новый клиент";
        const partnerId = localStorage.getItem('eco_partner_id') || 0;

        const newProject = {
            id: Date.now(),
            ownerId: Number(partnerId),
            clientName: clientName,
            type: type,
            status: "analysis",
            statusLabel: "На согласовании",
            progress: 5,
            deadline: "Оценка...",
            resources: { method: "—", details: "Ожидает" },
            history: [{ date: new Date().toLocaleDateString(), type: "start", text: "Заявка отправлена" }],
            files: []
        };

        Store.addProject(newProject);
        this.renderProjects();
        
        const partner = Store.state.partners.find(p => p.id == partnerId);
        if (partner) {
            partner.projects.push({ type: type, stage: "Согласование", deadline: "?" });
            if (partner.status === 'lead') partner.status = 'active';
            this.renderCRM();
        }
    },

    openStatusModal() {
        const modal = document.getElementById('status-edit-modal');
        document.getElementById('edit-percent').value = Store.state.engineer.workload.percent;
        document.getElementById('edit-percent-val').textContent = Store.state.engineer.workload.percent;
        document.getElementById('edit-status-text').value = Store.state.engineer.workload.statusText;
        modal.classList.remove('hidden');
    },

    saveAdminStatus() {
        const percent = parseInt(document.getElementById('edit-percent').value);
        const text = document.getElementById('edit-status-text').value;
        const hue = Math.floor((100 - percent) * 1.2);
        const color = `hsl(${hue}, 85%, 45%)`;
        const newStatus = { percent, statusText: text || "Работаю", color };
        Store.saveWorkloadStatus(newStatus);
        this.renderProfile();
        document.getElementById('status-edit-modal').classList.add('hidden');
    },

    openProjectModal(project) {
        const modal = document.getElementById('project-detail-modal');
        const body = document.getElementById('modal-body');
        body.innerHTML = View.renderProjectModalContent(project);
        modal.classList.remove('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try { Controller.init(); } catch (e) { console.error("Init failed:", e); }
});