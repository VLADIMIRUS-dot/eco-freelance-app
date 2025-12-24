// js/logic.js

// === 0. ПРОВЕРКА ЗАГРУЗКИ DATA.JS ===
if (typeof CONFIG === 'undefined' || typeof servicesData === 'undefined') {
    console.error("CRITICAL ERROR: data.js не загружен!");
    alert("Ошибка: data.js не найден.");
}

const tg = window.Telegram.WebApp;

// === 1. ЛОГИКА АВТОРИЗАЦИИ ===
// Получаем ID пользователя
let currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

// Если открыли в браузере без Телеграма — ставим режим отладки (по желанию)
if (!currentUserId) {
    // console.warn("⚠️ Нет ID Telegram. Включен режим теста (Ваш ID).");
    // currentUserId = CONFIG.ADMIN_ID; // Раскомментируйте для тестов в браузере
}

// ПРОВЕРКА НА АДМИНА
// Используем нестрогое равенство (==), чтобы 8027648882 (number) было равно "8027648882" (string)
const isAdmin = (currentUserId == CONFIG.ADMIN_ID); 
let estimateData = []; // Хранилище сметы

console.log(`[App] User: ${currentUserId}, Admin Access: ${isAdmin}`);

// === 2. ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        tg.ready();
        tg.expand(); // Раскрываем на весь экран
        
        initTheme();
        initNavigation();
        
        // Сначала рендерим всё
        initViews();
        
        // Потом проверяем партнера
        checkFirstVisit();
        
        // В КОНЦЕ: Если админ, показываем скрытые блоки
        if (typeof toggleAdminElementsView === 'function') {
             toggleAdminElementsView(isAdmin);
        }

        console.log("[App] Ready");
    } catch (e) {
        console.error("[App] Init Error:", e);
    }
});

/**
 * Инициализация представлений
 */
function initViews() {
    // 1. Профиль
    if(typeof renderProfileView === 'function') {
        renderProfileView(engineerProfile);
        
        // Исправляем кнопку "Написать мне"
        const contactBtn = document.querySelector('.action-buttons .btn-primary');
        if (contactBtn) {
            contactBtn.replaceWith(contactBtn.cloneNode(true)); // Сброс старых слушателей
            document.querySelector('.action-buttons .btn-primary').addEventListener('click', () => {
                const url = CONFIG.TELEGRAM_LINK;
                if(tg.openTelegramLink) tg.openTelegramLink(url);
                else window.open(url, '_blank');
            });
        }
    }

    // 2. Проекты (Фильтрация: Админ видит всё, Клиент только своё)
    if(typeof renderProjectsView === 'function') {
        const visibleProjects = isAdmin 
            ? projectsData 
            : projectsData.filter(p => p.ownerId == currentUserId);
        renderProjectsView(visibleProjects);
    }

    // 3. Калькулятор
    if(typeof fillCalculatorOptions === 'function') {
        fillCalculatorOptions(servicesData);
        renderServicesListView(servicesData);
        initSimpleCalculator();
    }

    // 4. CRM (Только рендер, показ управляется через CSS)
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

            // Скролл вверх
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
                wrapper.innerHTML = `
                    <label>${param.label}</label>
                    <input type="range" class="calc-input" data-id="${param.id}" 
                           min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}">
                    <div class="calc-range-wrapper">
                        <span>${param.min}</span>
                        <span id="val-${param.id}" style="color:var(--tg-theme-button-color)">${param.default}</span>
                        <span>${param.max}</span>
                    </div>`;
            } else if (param.type === 'select') {
                wrapper.className = 'form-group';
                const optionsHTML = param.options.map(opt => `<option value="${opt.val}">${opt.text}</option>`).join('');
                wrapper.innerHTML = `<label>${param.label}</label><select class="calc-input" data-id="${param.id}">${optionsHTML}</select>`;
            } else if (param.type === 'checkbox') {
                wrapper.className = 'form-group checkbox-group';
                wrapper.innerHTML = `<input type="checkbox" class="calc-input" id="chk-${param.id}" data-id="${param.id}"><label for="chk-${param.id}">${param.label}</label>`;
            }
            dynamicContainer.appendChild(wrapper);
        });

        document.querySelectorAll('.calc-input').forEach(input => {
            input.addEventListener('input', (e) => {
                if(e.target.type === 'range') {
                    const id = e.target.getAttribute('data-id');
                    const valSpan = document.getElementById(`val-${id}`);
                    if(valSpan) valSpan.textContent = e.target.value;
                }
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
        listDisplay.innerHTML = uploadedFiles.map((name, index) => `
            <div class="file-item">
                <span style="overflow: hidden; text-overflow: ellipsis;">📎 ${name}</span>
                <i class="fa-solid fa-xmark file-remove" onclick="removeFileGlobal(${index})"></i>
            </div>`).join('');
    }
    
    window.removeFileGlobal = function(index) {
        uploadedFiles.splice(index, 1);
        renderFileList();
    };

    if (orderBtn) {
        orderBtn.addEventListener('click', () => {
            const service = servicesData.find(s => s.id === typeSelect.value).name;
            const price = priceDisplay.textContent;
            let details = '';
            document.querySelectorAll('.calc-input').forEach(input => {
                const paramId = input.getAttribute('data-id');
                const label = input.closest('.form-group').querySelector('label')?.textContent || paramId;
                let val = input.value;
                if (input.type === 'checkbox') val = input.checked ? 'Да' : 'Нет';
                if (input.tagName === 'SELECT') val = input.options[input.selectedIndex].text;
                details += `\n🔹 ${label}: ${val}`;
            });
            const fileMsg = uploadedFiles.length > 0 ? `\n📎 Файлов: ${uploadedFiles.length}` : '';
            const msg = `👋 *Заявка*\n\n🛠 ${service}${details}\n\n💰 ${price}${fileMsg}`;
            const botLink = CONFIG.TELEGRAM_LINK.replace('https://t.me/', '');
            const finalUrl = `https://t.me/${botLink}?text=${encodeURIComponent(msg)}`;
            if(tg.openTelegramLink) tg.openTelegramLink(finalUrl);
            else window.open(finalUrl, '_blank');
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
    if (!nameInput || !nameInput.value.trim()) {
        alert("Введите название организации");
        return;
    }
    const partnerData = {
        name: nameInput.value,
        inn: document.getElementById('p-inn')?.value,
        contact: document.getElementById('p-contact')?.value,
        email: document.getElementById('p-email')?.value,
        ordersCount: 0
    };
    localStorage.setItem('eco_partner_profile', JSON.stringify(partnerData));
    checkFirstVisit();
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
};

window.togglePartnerEditMode = function(isEdit) {
    const authBlock = document.getElementById('partner-auth');
    const dashBlock = document.getElementById('partner-dashboard');
    if (isEdit) {
        const stored = localStorage.getItem('eco_partner_profile');
        if(stored) {
            const p = JSON.parse(stored);
            document.getElementById('p-name').value = p.name;
            document.getElementById('p-inn').value = p.inn;
            document.getElementById('p-contact').value = p.contact;
            document.getElementById('p-email').value = p.email;
        }
        authBlock?.classList.remove('hidden');
        dashBlock?.classList.add('hidden');
    } else {
        checkFirstVisit();
    }
};

window.logoutPartner = function() {
    if(confirm('Вы уверены, что хотите удалить профиль организации с этого устройства?')) {
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

window.addNewObjectToEstimate = function() {
    estimateData.push({ id: Date.now(), name: `Объект №${estimateData.length + 1}`, services: [] });
    renderEstimateLogic();
};

window.addServiceToObject = function(objIndex) {
    if(servicesData.length > 0) {
        estimateData[objIndex].services.push({
            serviceId: servicesData[0].id,
            price: servicesData[0].basePrice
        });
        renderEstimateLogic();
    }
};

window.removeServiceFromObject = function(objIndex, srvIndex) {
    estimateData[objIndex].services.splice(srvIndex, 1);
    renderEstimateLogic();
};

window.removeObject = function(index) {
    if (confirm('Удалить этот объект?')) {
        estimateData.splice(index, 1);
        renderEstimateLogic();
    }
};

window.updateServiceType = function(objIndex, srvIndex, newId) {
    const srvInfo = servicesData.find(s => s.id === newId);
    if(srvInfo) {
        estimateData[objIndex].services[srvIndex].serviceId = newId;
        estimateData[objIndex].services[srvIndex].price = srvInfo.basePrice;
        renderEstimateLogic();
    }
};

function renderEstimateLogic() {
    const container = document.getElementById('estimate-container');
    if(!container) return;
    container.innerHTML = '';
    let globalTotal = 0;

    estimateData.forEach((obj, objIndex) => {
        let objTotal = 0;
        const servicesHTML = obj.services.map((srv, srvIndex) => {
            const price = srv.price; 
            objTotal += price;
            const options = servicesData.map(s => 
                `<option value="${s.id}" ${s.id === srv.serviceId ? 'selected' : ''}>${s.name}</option>`
            ).join('');
            return `
                <div class="service-row">
                    <select onchange="window.updateServiceType(${objIndex}, ${srvIndex}, this.value)" 
                            style="width:60%; border:none; background:transparent; font-weight:500;">
                        ${options}
                    </select>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${price.toLocaleString()} ₽</span>
                        <i class="fa-solid fa-trash text-red" onclick="window.removeServiceFromObject(${objIndex}, ${srvIndex})"></i>
                    </div>
                </div>`;
        }).join('');
        globalTotal += objTotal;
        const card = document.createElement('div');
        card.className = 'estimate-object-card';
        card.innerHTML = `
            <div class="obj-header">
                <input type="text" value="${obj.name}" onchange="estimateData[${objIndex}].name = this.value">
                <span class="remove-obj-btn" onclick="window.removeObject(${objIndex})">Удалить</span>
            </div>
            <div class="obj-services-list">
                ${servicesHTML.length ? servicesHTML : '<p style="font-size:0.8rem; color:#999;">Нет услуг</p>'}
            </div>
            <div style="text-align:right; margin-bottom:10px;">
                <small>Итого: <strong>${objTotal.toLocaleString()} ₽</strong></small>
            </div>
            <button class="btn btn-outline full-width" style="font-size:0.8rem; padding:8px;" onclick="window.addServiceToObject(${objIndex})">
                <i class="fa-solid fa-plus"></i> Добавить услугу
            </button>`;
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
    const finalUrl = `https://t.me/${botLink}?text=${encodeURIComponent(msg)}`;
    if(tg.openTelegramLink) tg.openTelegramLink(finalUrl);
    else window.open(finalUrl, '_blank');
};

window.goToCalculator = function() {
    const calcTab = document.querySelector('.nav-item[data-target="view-services"]');
    if (calcTab) {
        calcTab.click(); 
        setTimeout(() => {
            const calcBlock = document.getElementById('calc-simple-mode');
            if (calcBlock) calcBlock.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
};


// ==========================================
// === ФУНКЦИИ АДМИНА (ТЕПЕРЬ ДОБАВЛЕНЫ) ===
// ==========================================

// 1. Открыть редактор статуса
window.openStatusEditor = function() {
    const modal = document.getElementById('status-edit-modal');
    if (!modal) return;
    
    // Подтягиваем текущие значения
    document.getElementById('edit-percent').value = engineerProfile.workload.percent;
    document.getElementById('edit-percent-val').textContent = engineerProfile.workload.percent;
    document.getElementById('edit-status-text').value = engineerProfile.workload.statusText;
    
    // Устанавливаем текущий цвет
    window.selectStatusColor(engineerProfile.workload.color);
    
    modal.classList.remove('hidden');
};

// 2. Закрыть редактор
window.closeStatusModal = function() {
    document.getElementById('status-edit-modal').classList.add('hidden');
};

// 3. Выбор цвета в модалке
window.selectStatusColor = function(color) {
    document.getElementById('edit-status-color').value = color;
    document.querySelectorAll('.color-circle').forEach(circle => {
        if (circle.getAttribute('style').includes(color)) {
            circle.style.borderColor = '#000';
            circle.style.transform = "scale(1.1)";
        } else {
            circle.style.borderColor = 'transparent';
            circle.style.transform = "scale(1.0)";
        }
    });
};

// 4. Логика ползунка процентов
document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('edit-percent');
    if(range) {
        range.addEventListener('input', (e) => {
            document.getElementById('edit-percent-val').textContent = e.target.value;
        });
    }
});

// 5. СОХРАНИТЬ НОВЫЙ СТАТУС
window.saveNewStatus = function() {
    const newPercent = document.getElementById('edit-percent').value;
    const newText = document.getElementById('edit-status-text').value;
    const newColor = document.getElementById('edit-status-color').value;

    const newStatusData = {
        percent: parseInt(newPercent),
        statusText: newText || "Работаю",
        color: newColor || "#2ecc71"
    };

    // Обновляем память и LocalStorage
    engineerProfile.workload = newStatusData;
    localStorage.setItem('admin_custom_status', JSON.stringify(newStatusData));

    // Перерисовываем
    renderProfileView(engineerProfile);
    window.closeStatusModal();
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
};

// === ФУНКЦИИ CRM ===

// Обновить рейтинг
window.updatePartnerRating = function(id, newRating) {
    const partner = partnersData.find(p => p.id === id);
    if (partner) {
        partner.rating = newRating;
        renderPartnersView(partnersData);
        if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    }
};

// Обновить заметку
window.updatePartnerNote = function(id, text) {
    const partner = partnersData.find(p => p.id === id);
    if (partner) partner.note = text;
};

// Открыть чат
window.openPartnerChat = function(username) {
    if(tg.openTelegramLink) tg.openTelegramLink(`https://t.me/${username}`);
    else window.open(`https://t.me/${username}`, '_blank');
};

// Удалить партнера
window.deletePartner = function(id) {
    if(confirm('Удалить этого партнера из базы?')) {
        const index = partnersData.findIndex(p => p.id === id);
        if (index !== -1) {
            partnersData.splice(index, 1);
            renderPartnersView(partnersData);
        }
    }
};
