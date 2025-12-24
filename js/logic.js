// js/logic.js
// === 0. ПРОВЕРКА ЗАГРУЗКИ DATA.JS ===
if (typeof CONFIG === 'undefined' || typeof servicesData === 'undefined') {
    console.error("CRITICAL ERROR: data.js не загружен!");
    alert("Ошибка: data.js не найден.");
}

const tg = window.Telegram.WebApp;

// === 1. ЛОГИКА АВТОРИЗАЦИИ ===
let currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

// Для тестов в браузере (если нет ID, но включен режим админа в data.js)
if (!currentUserId && typeof CONFIG.FORCE_ADMIN_MODE !== 'undefined' && CONFIG.FORCE_ADMIN_MODE) {
    currentUserId = CONFIG.ADMIN_ID;
}

// ПРОВЕРКА НА АДМИНА (Нестрогое сравнение)
const isAdmin = (currentUserId == CONFIG.ADMIN_ID); 
let estimateData = []; 

console.log(`[App] User: ${currentUserId}, Admin Access: ${isAdmin}`);

// === 2. ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        tg.ready();
        tg.expand();
        
        initTheme();
        initNavigation();
        initViews();
        checkFirstVisit();
        
        // Показ элементов админа
        if (typeof toggleAdminElementsView === 'function') {
             toggleAdminElementsView(isAdmin);
        }
        
        // Скрываем выбор цвета в модалке (он теперь автоматический)
        const colorPicker = document.querySelector('.color-picker-row');
        if (colorPicker) colorPicker.style.display = 'none';

        console.log("[App] Ready");
    } catch (e) {
        console.error("[App] Init Error:", e);
    }
});

/** Инициализация представлений */
function initViews() {
    if(typeof renderProfileView === 'function') {
        renderProfileView(engineerProfile);
        
        // Фикс кнопки "Написать мне"
        const contactBtn = document.querySelector('.action-buttons .btn-primary');
        if (contactBtn) {
            contactBtn.replaceWith(contactBtn.cloneNode(true));
            document.querySelector('.action-buttons .btn-primary').addEventListener('click', () => {
                const url = CONFIG.TELEGRAM_LINK;
                if(tg.openTelegramLink) tg.openTelegramLink(url);
                else window.open(url, '_blank');
            });
        }
    }

    if(typeof renderProjectsView === 'function') {
        const visibleProjects = isAdmin ? projectsData : projectsData.filter(p => p.ownerId == currentUserId);
        renderProjectsView(visibleProjects);
    }

    if(typeof fillCalculatorOptions === 'function') {
        fillCalculatorOptions(servicesData);
        renderServicesListView(servicesData);
        initSimpleCalculator();
    }

    if (typeof renderPartnersView === 'function') {
        renderPartnersView(partnersData);
    }
}

function initTheme() {
    function applyTheme() {
        if (tg.colorScheme) document.body.setAttribute('data-theme', tg.colorScheme);
        if(tg.themeParams && tg.themeParams.bg_color) {
            tg.setHeaderColor(tg.themeParams.bg_color);
            tg.setBackgroundColor(tg.themeParams.bg_color);
        }
    }
    applyTheme();
    tg.onEvent('themeChanged', applyTheme);
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (!targetView) return;
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => view.classList.remove('active'));
            item.classList.add('active');
            targetView.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        });
    });
}

// === 3. КАЛЬКУЛЯТОР ===
function initSimpleCalculator() {
    const typeSelect = document.getElementById('calc-service-type');
    const dynamicContainer = document.getElementById('dynamic-calc-inputs');
    const priceDisplay = document.getElementById('calc-total-price');
    const timeDisplay = document.getElementById('calc-total-time');
    const orderBtn = document.getElementById('btn-order-calc');
    const fileInput = document.getElementById('calc-file-input');
    const dropZone = document.getElementById('file-drop-zone');
    let uploadedFiles = []; 

    if (!typeSelect || !dynamicContainer) return;

    function renderInputs() {
        const serviceId = typeSelect.value;
        const service = servicesData.find(s => s.id === serviceId);
        dynamicContainer.innerHTML = ''; 
        if (!service) return;

        service.params.forEach(param => {
            const wrapper = document.createElement('div');
            if (param.type === 'range') {
                wrapper.className = 'form-group';
                wrapper.innerHTML = `<label>${param.label}</label><input type="range" class="calc-input" data-id="${param.id}" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}"><div class="calc-range-wrapper"><span>${param.min}</span><span id="val-${param.id}" style="color:var(--tg-theme-button-color)">${param.default}</span><span>${param.max}</span></div>`;
            } else if (param.type === 'select') {
                const optionsHTML = param.options.map(opt => `<option value="${opt.val}">${opt.text}</option>`).join('');
                wrapper.className = 'form-group';
                wrapper.innerHTML = `<label>${param.label}</label><select class="calc-input" data-id="${param.id}">${optionsHTML}</select>`;
            } else if (param.type === 'checkbox') {
                wrapper.className = 'form-group checkbox-group';
                wrapper.innerHTML = `<input type="checkbox" class="calc-input" id="chk-${param.id}" data-id="${param.id}"><label for="chk-${param.id}">${param.label}</label>`;
            }
            dynamicContainer.appendChild(wrapper);
        });

        document.querySelectorAll('.calc-input').forEach(input => {
            input.addEventListener('input', (e) => {
                if(e.target.type === 'range') document.getElementById(`val-${e.target.getAttribute('data-id')}`).textContent = e.target.value;
                calculateTotal();
            });
        });
        calculateTotal();
    }

    function calculateTotal() {
        const serviceId = typeSelect.value;
        const service = servicesData.find(s => s.id === serviceId);
        let total = service.basePrice;
        let days = 10;
        document.querySelectorAll('.calc-input').forEach(input => {
            const paramId = input.getAttribute('data-id');
            const paramConfig = service.params.find(p => p.id === paramId);
            if (!paramConfig) return;
            if (paramConfig.type === 'range') {
                const val = parseInt(input.value) || 0;
                if (paramConfig.costPerUnit) total += (val * paramConfig.costPerUnit);
                days += Math.floor(val / 5);
            } else if (paramConfig.type === 'select') {
                const val = parseInt(input.value);
                const option = paramConfig.options.find(o => o.val === val);
                if (option?.cost) total += option.cost;
            } else if (paramConfig.type === 'checkbox') {
                if (input.checked && paramConfig.cost) total += paramConfig.cost;
            }
        });
        if(priceDisplay) priceDisplay.textContent = total.toLocaleString('ru-RU') + ' ₽';
        if(timeDisplay) timeDisplay.textContent = `${days}-${days + 5} раб. дней`;
    }

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                Array.from(e.target.files).forEach(file => {
                    if (!uploadedFiles.includes(file.name)) uploadedFiles.push(file.name);
                });
                renderFileList();
            }
            fileInput.value = ''; 
        });
    }

    function renderFileList() {
        const listDisplay = document.getElementById('file-list-display');
        if (!listDisplay) return;
        listDisplay.innerHTML = uploadedFiles.map((name, index) => `<div class="file-item"><span style="overflow: hidden; text-overflow: ellipsis;">📎 ${name}</span><i class="fa-solid fa-xmark file-remove" onclick="removeFileGlobal(${index})"></i></div>`).join('');
    }
    window.removeFileGlobal = function(index) { uploadedFiles.splice(index, 1); renderFileList(); };

    if (orderBtn) {
        orderBtn.addEventListener('click', () => {
            const service = servicesData.find(s => s.id === typeSelect.value).name;
            const price = priceDisplay.textContent;
            let details = '';
            document.querySelectorAll('.calc-input').forEach(input => {
                const label = input.closest('.form-group').querySelector('label')?.textContent || '';
                let val = input.value;
                if (input.type === 'checkbox') val = input.checked ? 'Да' : 'Нет';
                if (input.tagName === 'SELECT') val = input.options[input.selectedIndex].text;
                details += `\n🔹 ${label}: ${val}`;
            });
            const fileMsg = uploadedFiles.length > 0 ? `\n📎 Файлов: ${uploadedFiles.length}` : '';
            const msg = `👋 *Заявка*\n\n🛠 ${service}${details}\n\n💰 ${price}${fileMsg}`;
            const botLink = CONFIG.TELEGRAM_LINK.replace('https://t.me/', '');
            if(tg.openTelegramLink) tg.openTelegramLink(`https://t.me/${botLink}?text=${encodeURIComponent(msg)}`);
            else window.open(`https://t.me/${botLink}?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }
    typeSelect.addEventListener('change', renderInputs);
    renderInputs();
}

// === 4. ПАРТНЕРСКИЙ ПРОФИЛЬ ===
function checkFirstVisit() {
    const data = localStorage.getItem('eco_partner_profile');
    const authBlock = document.getElementById('partner-auth');
    const dashBlock = document.getElementById('partner-dashboard');
    if (!data) {
        authBlock?.classList.remove('hidden');
        dashBlock?.classList.add('hidden');
    } else {
        authBlock?.classList.add('hidden');
        dashBlock?.classList.remove('hidden');
        renderPartnerDashboard(JSON.parse(data));
    }
}
function renderPartnerDashboard(data) {
    if(document.getElementById('lk-company-name')) document.getElementById('lk-company-name').textContent = data.name;
    if(document.getElementById('lk-inn')) document.getElementById('lk-inn').textContent = data.inn ? `ИНН: ${data.inn}` : 'ИНН: —';
    if(document.getElementById('lk-contact')) document.getElementById('lk-contact').textContent = data.contact || '—';
    if(document.getElementById('lk-email')) document.getElementById('lk-email').textContent = data.email || '—';
    const statusEl = document.getElementById('lk-status');
    if(statusEl) statusEl.textContent = data.ordersCount > 0 ? "Постоянный клиент" : "Новый партнер";
}
window.savePartnerProfile = function() {
    const nameInput = document.getElementById('p-name');
    if (!nameInput || !nameInput.value.trim()) { alert("Введите название"); return; }
    localStorage.setItem('eco_partner_profile', JSON.stringify({
        name: nameInput.value,
        inn: document.getElementById('p-inn')?.value,
        contact: document.getElementById('p-contact')?.value,
        email: document.getElementById('p-email')?.value,
        ordersCount: 0
    }));
    checkFirstVisit();
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
};
window.togglePartnerEditMode = function(isEdit) {
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
    } else { checkFirstVisit(); }
};
window.logoutPartner = function() {
    if(confirm('Выйти?')) {
        localStorage.removeItem('eco_partner_profile');
        document.getElementById('partner-form').reset();
        checkFirstVisit();
    }
};

// === 5. ОБЩИЕ ФУНКЦИИ (ДЛЯ UI) ===
window.switchCalcMode = function(mode, btn) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    const simpleMode = document.getElementById('calc-simple-mode');
    const advMode = document.getElementById('calc-advanced-mode');
    if (mode === 'simple') {
        simpleMode?.classList.remove('hidden');
        advMode?.classList.add('hidden');
    } else {
        simpleMode?.classList.add('hidden');
        advMode?.classList.remove('hidden');
        if (estimateData.length === 0) window.addNewObjectToEstimate();
    }
};
window.addNewObjectToEstimate = function() { estimateData.push({ id: Date.now(), name: `Объект №${estimateData.length + 1}`, services: [] }); renderEstimateLogic(); };
window.addServiceToObject = function(objIndex) { if(servicesData.length > 0) { estimateData[objIndex].services.push({ serviceId: servicesData[0].id, price: servicesData[0].basePrice }); renderEstimateLogic(); }};
window.removeServiceFromObject = function(objIndex, srvIndex) { estimateData[objIndex].services.splice(srvIndex, 1); renderEstimateLogic(); };
window.removeObject = function(index) { if (confirm('Удалить?')) { estimateData.splice(index, 1); renderEstimateLogic(); }};
window.updateServiceType = function(objIndex, srvIndex, newId) {
    const srvInfo = servicesData.find(s => s.id === newId);
    if(srvInfo) { estimateData[objIndex].services[srvIndex].serviceId = newId; estimateData[objIndex].services[srvIndex].price = srvInfo.basePrice; renderEstimateLogic(); }
};
function renderEstimateLogic() {
    const container = document.getElementById('estimate-container');
    if(!container) return;
    container.innerHTML = '';
    let globalTotal = 0;
    estimateData.forEach((obj, objIndex) => {
        let objTotal = 0;
        const servicesHTML = obj.services.map((srv, srvIndex) => {
            objTotal += srv.price;
            const options = servicesData.map(s => `<option value="${s.id}" ${s.id === srv.serviceId ? 'selected' : ''}>${s.name}</option>`).join('');
            return `<div class="service-row"><select onchange="window.updateServiceType(${objIndex}, ${srvIndex}, this.value)" style="width:60%; border:none; background:transparent; font-weight:500;">${options}</select><div style="display:flex; align-items:center; gap:10px;"><span>${srv.price.toLocaleString()} ₽</span><i class="fa-solid fa-trash text-red" onclick="window.removeServiceFromObject(${objIndex}, ${srvIndex})"></i></div></div>`;
        }).join('');
        globalTotal += objTotal;
        const card = document.createElement('div');
        card.className = 'estimate-object-card';
        card.innerHTML = `<div class="obj-header"><input type="text" value="${obj.name}" onchange="estimateData[${objIndex}].name = this.value"><span class="remove-obj-btn" onclick="window.removeObject(${objIndex})">Удалить</span></div><div class="obj-services-list">${servicesHTML.length ? servicesHTML : '<p style="font-size:0.8rem; color:#999;">Нет услуг</p>'}</div><div style="text-align:right; margin-bottom:10px;"><small>Итого: <strong>${objTotal.toLocaleString()} ₽</strong></small></div><button class="btn btn-outline full-width" style="font-size:0.8rem; padding:8px;" onclick="window.addServiceToObject(${objIndex})"><i class="fa-solid fa-plus"></i> Добавить услугу</button>`;
        container.appendChild(card);
    });
    const totalEl = document.getElementById('estimate-total-sum');
    if(totalEl) totalEl.textContent = globalTotal.toLocaleString() + ' ₽';
}
window.sendEstimateToTelegram = function() {
    if (estimateData.length === 0) return;
    let msg = "📑 *КП (Смета):*\n\n";
    let total = 0;
    estimateData.forEach(obj => {
        msg += `🏭 *${obj.name}*\n`;
        obj.services.forEach(srv => {
            const srvInfo = servicesData.find(s => s.id === srv.serviceId);
            msg += ` — ${srvInfo.name}: ${srv.price.toLocaleString()} ₽\n`;
            total += srv.price;
        });
        msg += "\n";
    });
    msg += `💰 *ИТОГО: ${total.toLocaleString()} ₽*`;
    const botLink = CONFIG.TELEGRAM_LINK.replace('https://t.me/', '');
    if(tg.openTelegramLink) tg.openTelegramLink(`https://t.me/${botLink}?text=${encodeURIComponent(msg)}`);
    else window.open(`https://t.me/${botLink}?text=${encodeURIComponent(msg)}`, '_blank');
};
window.goToCalculator = function() {
    const calcTab = document.querySelector('.nav-item[data-target="view-services"]');
    if (calcTab) { calcTab.click(); setTimeout(() => { document.getElementById('calc-simple-mode')?.scrollIntoView({ behavior: 'smooth' }); }, 300); }
};

// ==========================================
// === ОБНОВЛЕННЫЙ ФУНКЦИОНАЛ АДМИНА ===
// ==========================================

// 1. Открыть редактор (скрываем выбор цвета)
window.openStatusEditor = function() {
    const modal = document.getElementById('status-edit-modal');
    if (!modal) return;
    
    // Скрываем выбор цвета в UI, так как он теперь автоматический
    const colorPicker = document.querySelector('.color-picker-row');
    if(colorPicker) colorPicker.style.display = 'none';
    
    document.getElementById('edit-percent').value = engineerProfile.workload.percent;
    document.getElementById('edit-percent-val').textContent = engineerProfile.workload.percent;
    document.getElementById('edit-status-text').value = engineerProfile.workload.statusText;
    
    modal.classList.remove('hidden');
};

// 2. Закрыть
window.closeStatusModal = function() {
    document.getElementById('status-edit-modal').classList.add('hidden');
};

// 3. Динамический ползунок
document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('edit-percent');
    if(range) {
        range.addEventListener('input', (e) => {
            document.getElementById('edit-percent-val').textContent = e.target.value;
        });
    }
});

// 4. ГЕНЕРАЦИЯ ЦВЕТА (Green -> Yellow -> Red)
// 0% = Hue 120 (Green), 100% = Hue 0 (Red)
function calculateAutoColor(percent) {
    // Формула: чем больше процент, тем меньше Hue (ближе к красному)
    // 100% * 1.2 = 120. 
    // При percent = 0 -> hue = 120 (Green)
    // При percent = 50 -> hue = 60 (Yellow)
    // При percent = 100 -> hue = 0 (Red)
    const hue = Math.floor((100 - percent) * 1.2);
    return `hsl(${hue}, 85%, 45%)`; 
}

// 5. СОХРАНЕНИЕ
window.saveNewStatus = function() {
    const newPercent = parseInt(document.getElementById('edit-percent').value);
    const newText = document.getElementById('edit-status-text').value;

    // Автоматический цвет
    const autoColor = calculateAutoColor(newPercent);

    const newStatusData = {
        percent: newPercent,
        statusText: newText || "Работаю",
        color: autoColor // Теперь цвет рассчитывается сам!
    };

    // Обновляем память
    engineerProfile.workload = newStatusData;
    // Сохраняем навсегда
    localStorage.setItem('admin_custom_status', JSON.stringify(newStatusData));

    // Важно: в CSS views.js у нас был градиент. 
    // Нужно переписать стиль элемента напрямую, чтобы показать сплошной цвет
    renderProfileView(engineerProfile);
    
    // Принудительно меняем стиль, если renderProfileView использует CSS-класс с градиентом
    const barFill = document.querySelector('.workload-fill');
    if(barFill) {
        barFill.style.background = 'none'; // Сбрасываем градиент
        barFill.style.backgroundColor = autoColor; // Ставим наш цвет
    }

    window.closeStatusModal();
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
};

// === CRM ===
window.updatePartnerRating = function(id, newRating) {
    const partner = partnersData.find(p => p.id === id);
    if (partner) { partner.rating = newRating; renderPartnersView(partnersData); if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged(); }
};
window.updatePartnerNote = function(id, text) { const partner = partnersData.find(p => p.id === id); if (partner) partner.note = text; };
window.openPartnerChat = function(username) {
    if(tg.openTelegramLink) tg.openTelegramLink(`https://t.me/${username}`); else window.open(`https://t.me/${username}`, '_blank');
};
window.deletePartner = function(id) {
    if(confirm('Удалить?')) {
        const index = partnersData.findIndex(p => p.id === id);
        if (index !== -1) { partnersData.splice(index, 1); renderPartnersView(partnersData); }
    }
};
// ==========================================
// === CRM 2.0 LOGIC ===
// ==========================================

// Глобальные переменные для фильтра
let crmSearchQuery = "";
let crmFilterStatus = "all"; // all, debt, active, lead

// 1. Инициализация CRM (вызывается из initViews)
function initCRM() {
    renderModernCRM();
}

// 2. Функция фильтрации и рендера
function renderModernCRM() {
    const container = document.getElementById('partners-list');
    if (!container) return;

    // Фильтрация
    let filtered = partnersData.filter(p => {
        // Поиск по имени или ИНН
        const matchSearch = p.name.toLowerCase().includes(crmSearchQuery) || 
                            p.inn.includes(crmSearchQuery);
        
        // Фильтр по статусу (табы)
        let matchFilter = true;
        if (crmFilterStatus === 'debt') matchFilter = p.finance.debt > 0;
        if (crmFilterStatus === 'active') matchFilter = p.status === 'active';
        if (crmFilterStatus === 'lead') matchFilter = p.status === 'lead';
        
        return matchSearch && matchFilter;
    });

    // Считаем общие цифры для дашборда
    let totalDebt = 0;
    let totalPotential = 0; // Долг + Остаток к оплате
    partnersData.forEach(p => {
        totalDebt += p.finance.debt;
        totalPotential += (p.finance.total - p.finance.paid);
    });

    // Обновляем HTML
    renderCRMHTML(container, filtered, totalDebt, totalPotential);
}

// 3. Переключение фильтров (Tabs)
window.setCRMFilter = function(filterType, btn) {
    crmFilterStatus = filterType;
    
    // Визуальное переключение кнопок
    document.querySelectorAll('.crm-chip').forEach(c => c.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    renderModernCRM();
    if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
};

// 4. Поиск
window.onCRMSearch = function(val) {
    crmSearchQuery = val.toLowerCase().trim();
    renderModernCRM();
};

// 5. Раскрыть/Скрыть детали
window.toggleCRMDetails = function(id) {
    const detailsBlock = document.getElementById(`crm-details-${id}`);
    const arrow = document.getElementById(`crm-arrow-${id}`);
    
    if (detailsBlock) {
        const isOpen = detailsBlock.classList.contains('open');
        if (isOpen) {
            detailsBlock.classList.remove('open');
            arrow.style.transform = 'rotate(0deg)';
        } else {
            detailsBlock.classList.add('open');
            arrow.style.transform = 'rotate(180deg)';
        }
    }
};

// 6. Скопировать ИНН
window.copyINN = function(inn) {
    navigator.clipboard.writeText(inn).then(() => {
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        alert("ИНН скопирован: " + inn); // В WebApp лучше использовать кастомный тост, но alert сойдет
    });
};
