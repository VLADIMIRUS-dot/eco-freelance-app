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

        // Рендер всего
        this.renderAll();
        
        // Слушатели
        this.setupEventListeners();

        // Проверка авторизации партнера
        this.checkPartnerAuth();

        // === ВАЖНО: СКРЫТИЕ ЭЛЕМЕНТОВ АДМИНА ===
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

    renderAll() {
        this.renderProfile();
        this.renderProjects();
        this.renderCalculator();
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

    // === ОБНОВЛЕННЫЕ СЛУШАТЕЛИ ===
    setupEventListeners() {
        // --- 1. Навигация (Табы) ---
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                this.switchTab(targetId);
            });
        });

        // --- 2. Обработка кликов (Buttons, Actions) ---
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            
            // Игнорируем клик по тексту редактирования (для него dblclick)
            if (!target || target.getAttribute('data-action') === 'edit-est-name-start') return;
            
            const action = target.getAttribute('data-action');
            this.handleAction(action, target, e);
        });

        // --- 3. Двойной клик (Редактирование названия объекта) ---
        document.body.addEventListener('dblclick', (e) => {
            if (e.target.getAttribute('data-action') === 'edit-est-name-start') {
                const wrapper = e.target.closest('.obj-name-wrapper');
                const textSpan = wrapper.querySelector('.obj-name-text');
                const input = wrapper.querySelector('.obj-name-input-edit');

                textSpan.classList.add('hidden');
                input.classList.remove('hidden');
                input.focus();
                input.select(); 
            }
        });

        // --- 4. Сохранение при потере фокуса ---
        document.body.addEventListener('focusout', (e) => {
            if (e.target.getAttribute('data-action') === 'save-est-name') {
                const idx = Number(e.target.getAttribute('data-obj-idx'));
                const newVal = e.target.value.trim() || 'Без названия';
                
                Store.updateEstimateObject(idx, 'name', newVal);
                this.renderCalculator();
            }
        });

        // --- 5. Сохранение по Enter ---
        document.body.addEventListener('keydown', (e) => {
            if (e.target.getAttribute('data-action') === 'save-est-name' && e.key === 'Enter') {
                e.target.blur(); 
            }
        });

        // --- 6. События ввода (Input) ---
        document.body.addEventListener('input', (e) => {
            if (e.target.classList.contains('calc-input')) {
                if (e.target.type === 'range') {
                    const valSpan = document.getElementById(`val-${e.target.getAttribute('data-id')}`);
                    if (valSpan) valSpan.textContent = e.target.value;
                }
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
            // Старый обработчик update-est-name удален, так как теперь есть focusout
        });
        
        // --- 7. События изменения (Change) ---
        document.body.addEventListener('change', (e) => {
            if (e.target.getAttribute('data-action') === 'crm-note-change') {
                const id = Number(e.target.getAttribute('data-id'));
                Store.updatePartner(id, { note: e.target.value });
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
        // --- ПРОФИЛЬ ---
        if (action === 'contact-telegram') {
            const url = CONFIG.TELEGRAM_LINK;
            if (tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
        }
        if (action === 'nav-to-calc') document.querySelector('.nav-item[data-target="view-services"]').click();
        
        // НОВОЕ: Переход к проектам из личного кабинета
        if (action === 'nav-to-projects') this.switchTab('view-projects');

        if (action === 'open-status-editor') this.openStatusModal();

        // --- ПРОЕКТЫ ---
        if (action === 'open-project-modal') {
            const id = Number(target.getAttribute('data-id'));
            const project = Store.state.projects.find(p => p.id === id);
            if (project) this.openProjectModal(project);
        }
        if (action === 'close-modal') document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));

        // --- КАЛЬКУЛЯТОР ---
        if (action === 'switch-calc-mode') this.switchCalcMode(target.getAttribute('data-mode'), target);
        if (action === 'order-calc') this.submitSimpleOrder();
        if (action === 'remove-file') {
            const idx = Number(target.getAttribute('data-idx'));
            this.uiState.uploadedFiles.splice(idx, 1);
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

        // --- CRM (АДМИН) ---
        if (action === 'crm-filter') {
            this.uiState.crmFilter = target.getAttribute('data-val');
            this.renderCRM();
        }
        if (action === 'crm-toggle-details') {
            const id = target.getAttribute('data-id');
            const details = document.getElementById(`crm-details-${id}`);
            const arrow = document.getElementById(`crm-arrow-${id}`);
            if (details) {
                details.classList.toggle('open');
                arrow.style.transform = details.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
            }
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
            const id = Number(target.getAttribute('data-id'));
            const val = Number(target.getAttribute('data-val'));
            Store.updatePartner(id, { rating: val });
            this.renderCRM();
        }
        if (action === 'crm-open-tg') {
            const username = target.getAttribute('data-username');
            if(username) {
                const url = `https://t.me/${username}`;
                if(tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
            } else {
                alert('Нет username');
            }
        }

        // --- ПАРТНЕР ---
        if (action === 'partner-save') this.savePartnerProfile();
        if (action === 'partner-edit') this.togglePartnerEdit(true);
        if (action === 'partner-logout') {
            if(confirm('Выйти?')) {
                localStorage.removeItem('eco_partner_profile');
                document.getElementById('partner-form').reset();
                this.checkPartnerAuth();
            }
        }
        
        // --- АДМИН МОДАЛКА ---
        if (action === 'save-status') this.saveAdminStatus();
    },

    // === LOGIC HELPERS ===

    switchTab(targetId) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');
        document.getElementById(targetId)?.classList.add('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    },

    // --- Calculator Logic ---
    updateCalcInputs() {
        const typeSelect = document.getElementById('calc-service-type');
        const container = document.getElementById('dynamic-calc-inputs');
        if (!typeSelect || !container) return;

        const serviceId = typeSelect.value;
        const service = Store.state.services.find(s => s.id === serviceId);
        
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
            <div class="file-item">
                <span style="overflow: hidden; text-overflow: ellipsis;">📎 ${name}</span>
                <i class="fa-solid fa-xmark file-remove" data-action="remove-file" data-idx="${idx}"></i>
            </div>
        `).join('');
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

    // --- Partner Profile ---
    checkPartnerAuth() {
        const data = localStorage.getItem('eco_partner_profile');
        const authBlock = document.getElementById('partner-auth');
        const dashBlock = document.getElementById('partner-dashboard');
        
        if (!data) {
            authBlock?.classList.remove('hidden');
            dashBlock?.classList.add('hidden');
        } else {
            authBlock?.classList.add('hidden');
            dashBlock?.classList.remove('hidden');
            this.renderPartnerDashboard(JSON.parse(data));
        }
    },

    // === ОБНОВЛЕННЫЙ РЕНДЕР ДАШБОРДА ===
    renderPartnerDashboard(data) {
        const container = document.getElementById('partner-dashboard');
        if (!container) return;

        // Получаем проекты именно этого партнера для статистики и истории
        const myProjects = Store.getVisibleProjects(); 
        
        // Рендерим новый красивый дашборд
        container.innerHTML = View.renderPartnerDashboardEnhanced(data, myProjects);
    },

    savePartnerProfile() {
        const name = document.getElementById('p-name').value;
        const inn = document.getElementById('p-inn').value;
        const contact = document.getElementById('p-contact').value;
        const email = document.getElementById('p-email').value;

        if (!name.trim()) { alert("Введите название"); return; }

        const profileData = { name, inn, contact, email, ordersCount: 0 };
        
        let partnerId = localStorage.getItem('eco_partner_id');
        if (!partnerId) {
            partnerId = Date.now();
            localStorage.setItem('eco_partner_id', partnerId);
        }
        partnerId = Number(partnerId);

        localStorage.setItem('eco_partner_profile', JSON.stringify(profileData));

        const existing = Store.state.partners.find(p => p.id === partnerId);
        if (existing) {
            Store.updatePartner(partnerId, { name, inn, contact, email });
        } else {
            Store.addPartner({
                id: partnerId, name, inn, contact, email,
                username: Store.state.user?.username || "",
                phone: "", status: "lead", contract: "Нет договора",
                projects: [], finance: { total: 0, paid: 0, debt: 0 },
                rating: 0, note: "Из приложения"
            });
        }

        this.checkPartnerAuth();
        this.renderCRM();
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    },

    togglePartnerEdit(isEdit) {
        if (isEdit) {
            const stored = localStorage.getItem('eco_partner_profile');
            if(stored) {
                const p = JSON.parse(stored);
                document.getElementById('p-name').value = p.name;
                document.getElementById('p-inn').value = p.inn;
                document.getElementById('p-contact').value = p.contact;
                document.getElementById('p-email').value = p.email;
            }
            document.getElementById('partner-auth')?.classList.remove('hidden');
            document.getElementById('partner-dashboard')?.classList.add('hidden');
        }
    },

    // --- Admin Modal ---
    openStatusModal() {
        const modal = document.getElementById('status-edit-modal');
        if (!modal) return;
        
        const cp = document.querySelector('.color-picker-row');
        if(cp) cp.style.display = 'none';

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
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    },

    openProjectModal(project) {
        const modal = document.getElementById('project-detail-modal');
        const body = document.getElementById('modal-body');
        if (!modal || !body) return;
        
        body.innerHTML = View.renderProjectModalContent(project);
        modal.classList.remove('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        Controller.init();
    } catch (e) {
        console.error("Init failed:", e);
    }
});