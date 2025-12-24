// js/logic.js

// === 0. ПРОВЕРКА ЗАГРУЗКИ DATA.JS ===
if (typeof CONFIG === 'undefined' || typeof servicesData === 'undefined') {
    console.error("CRITICAL ERROR: data.js не загружен или содержит ошибки!");
    alert("Ошибка загрузки конфигурации. Проверьте консоль.");
}

const tg = window.Telegram.WebApp;

// === 1. ЛОГИКА АВТОРИЗАЦИИ ===
// Пытаемся получить ID от Телеграма
let currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

// Если ID нет (мы в браузере), берем ID админа из конфига
if (!currentUserId) {
    console.warn("⚠️ Запущено в браузере: Включен режим Админа для тестов");
    currentUserId = CONFIG.ADMIN_ID;
}

// Определяем права
const isAdmin = (currentUserId === CONFIG.ADMIN_ID);
let estimateData = []; // Хранилище сметы

console.log(`[App] User: ${currentUserId}, Admin: ${isAdmin}`);


// === 2. ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        tg.ready();
        tg.expand(); 
        
        initTheme();
        initNavigation();
        initViews();
        checkFirstVisit();
        
        console.log("[App] Инициализация прошла успешно");
    } catch (e) {
        console.error("[App] Ошибка инициализации:", e);
    }
});

/**
 * Основная функция отрисовки экранов
 */
function initViews() {
    // 1. Профиль
    if(typeof renderProfileView === 'function') {
        renderProfileView(engineerProfile);
        
        // Обновляем ссылку кнопки "Написать мне" на актуальную из CONFIG
        const contactBtn = document.querySelector('.action-buttons .btn-primary');
        if (contactBtn) {
            // Удаляем старый onclick из HTML и вешаем новый
            contactBtn.removeAttribute('onclick');
            contactBtn.addEventListener('click', () => {
                const url = CONFIG.TELEGRAM_LINK;
                if(tg.openTelegramLink) tg.openTelegramLink(url);
                else window.open(url, '_blank');
            });
        }
    }

    // 2. Проекты
    if(typeof renderProjectsView === 'function') {
        const visibleProjects = isAdmin 
            ? projectsData 
            : projectsData.filter(p => p.ownerId === currentUserId);
        renderProjectsView(visibleProjects);
    }

    // 3. Калькулятор
    if(typeof fillCalculatorOptions === 'function') {
        fillCalculatorOptions(servicesData);
        renderServicesListView(servicesData);
        initSimpleCalculator();
    }

    // 4. CRM (Админ)
    if (isAdmin && typeof renderPartnersView === 'function') {
        renderPartnersView(partnersData);
        toggleAdminElementsView(true);
    }
}

/**
 * Настройка Темы
 */
function initTheme() {
    function applyTheme() {
        if (tg.colorScheme) {
            document.body.setAttribute('data-theme', tg.colorScheme);
        }
        // Красим хедер телефона в цвет фона
        if(tg.themeParams && tg.themeParams.bg_color) {
            tg.setHeaderColor(tg.themeParams.bg_color);
            tg.setBackgroundColor(tg.themeParams.bg_color);
        }
    }
    applyTheme();
    tg.onEvent('themeChanged', applyTheme);
}

/**
 * Настройка Навигации (Табы)
 */
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

            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}


// === 3. ЛОГИКА КАЛЬКУЛЯТОРА (Simple) ===
function initSimpleCalculator() {
    const typeSelect = document.getElementById('calc-service-type');
    const dynamicContainer = document.getElementById('dynamic-calc-inputs');
    const priceDisplay = document.getElementById('calc-total-price');
    const timeDisplay = document.getElementById('calc-total-time');
    const orderBtn = document.getElementById('btn-order-calc');
    
    // Файлы
    const fileInput = document.getElementById('calc-file-input');
    const dropZone = document.getElementById('file-drop-zone');
    let uploadedFiles = []; 

    if (!typeSelect || !dynamicContainer) return;

    // Рендер полей
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
                    </div>
                `;
            } 
            else if (param.type === 'select') {
                wrapper.className = 'form-group';
                const optionsHTML = param.options.map(opt => `<option value="${opt.val}">${opt.text}</option>`).join('');
                wrapper.innerHTML = `
                    <label>${param.label}</label>
                    <select class="calc-input" data-id="${param.id}">
                        ${optionsHTML}
                    </select>
                `;
            } 
            else if (param.type === 'checkbox') {
                wrapper.className = 'form-group checkbox-group';
                wrapper.innerHTML = `
                    <input type="checkbox" class="calc-input" id="chk-${param.id}" data-id="${param.id}">
                    <label for="chk-${param.id}">${param.label}</label>
                `;
            }

            dynamicContainer.appendChild(wrapper);
        });

        // Слушатели ввода
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

    // Расчет
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
            }
            else if (paramConfig.type === 'select') {
                const val = parseInt(input.value);
                const option = paramConfig.options.find(o => o.val === val);
                if (option?.cost) total += option.cost;
            }
            else if (paramConfig.type === 'checkbox') {
                if (input.checked && paramConfig.cost) total += paramConfig.cost;
            }
        });

        if(priceDisplay) priceDisplay.textContent = total.toLocaleString('ru-RU') + ' ₽';
        if(timeDisplay) timeDisplay.textContent = `${days}-${days + 5} раб. дней`;
    }

    // Файлы
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                Array.from(e.target.files).forEach(file => {
                    if (!uploadedFiles.includes(file.name)) {
                        uploadedFiles.push(file.name);
                    }
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
            </div>
        `).join('');
    }
    
    // Глобальная функция удаления
    window.removeFileGlobal = function(index) {
        uploadedFiles.splice(index, 1);
        renderFileList();
    };

    // Кнопка Заказать
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
            
            // Открываем диалог (Используем CONFIG.TELEGRAM_LINK)
            const botLink = CONFIG.TELEGRAM_LINK.replace('https://t.me/', '');
            const finalUrl = `https://t.me/${botLink}?text=${encodeURIComponent(msg)}`;
            
            if(tg.openTelegramLink) tg.openTelegramLink(finalUrl);
            else window.open(finalUrl, '_blank');
        });
    }

    typeSelect.addEventListener('change', renderInputs);
    renderInputs();
}


// === 4. ПРОФИЛЬ ПАРТНЕРА ===
function checkFirstVisit() {
    const data = localStorage.getItem('eco_partner_profile');
    const authBlock = document.getElementById('partner-auth');
    const dashBlock = document.getElementById('partner-dashboard');

    if (!data) {
        // === СЦЕНАРИЙ 1: НОВЫЙ ПОЛЬЗОВАТЕЛЬ ===
        // Данных нет -> Готовим форму регистрации
        authBlock?.classList.remove('hidden');
        dashBlock?.classList.add('hidden');
        
        // Автоматически переключаем на вкладку "Мой профиль", чтобы он зарегистрировался
        setTimeout(() => {
            const btn = document.querySelector('.nav-item[data-target="view-partner"]');
            if(btn) btn.click();
        }, 500);

    } else {
        // === СЦЕНАРИЙ 2: ПОВТОРНЫЙ ВХОД ===
        // Данные есть -> Просто готовим ЛК (в фоновом режиме), но никуда не переключаем
        authBlock?.classList.add('hidden');
        dashBlock?.classList.remove('hidden');
        renderPartnerDashboard(JSON.parse(data));
        
        // На всякий случай убеждаемся, что активна вкладка "Эколог" (она и так активна по дефолту в HTML, но для надежности)
        // document.querySelector('.nav-item[data-target="view-profile"]')?.click(); 
    }
}

// Заполнение дашборда данными из LocalStorage
function renderPartnerDashboard(data) {
    if(document.getElementById('lk-company-name')) document.getElementById('lk-company-name').textContent = data.name;
    if(document.getElementById('lk-inn')) document.getElementById('lk-inn').textContent = data.inn ? `ИНН: ${data.inn}` : 'ИНН: —';
    if(document.getElementById('lk-contact')) document.getElementById('lk-contact').textContent = data.contact || '—';
    if(document.getElementById('lk-email')) document.getElementById('lk-email').textContent = data.email || '—';

    // Пример логики статуса (можно усложнить)
    const statusEl = document.getElementById('lk-status');
    if(statusEl) {
        if (data.ordersCount > 0) {
            statusEl.textContent = "Постоянный клиент";
            // Тут можно менять % скидки
        } else {
            statusEl.textContent = "Новый партнер";
        }
    }
}

// Сохранение профиля (Кнопка "Сохранить и Войти")
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
        ordersCount: 0 // Счетчик заказов для будущего
    };

    localStorage.setItem('eco_partner_profile', JSON.stringify(partnerData));
    
    // Перезагружаем состояние экрана без перезагрузки страницы
    checkFirstVisit();
    
    // Уведомление
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
};

// Кнопка "Редактировать" (карандаш)
window.togglePartnerEditMode = function(isEdit) {
    const authBlock = document.getElementById('partner-auth');
    const dashBlock = document.getElementById('partner-dashboard');
    
    if (isEdit) {
        // Заполняем форму текущими данными
        const stored = localStorage.getItem('eco_partner_profile');
        if(stored) {
            const p = JSON.parse(stored);
            document.getElementById('p-name').value = p.name;
            document.getElementById('p-inn').value = p.inn;
            document.getElementById('p-contact').value = p.contact;
            document.getElementById('p-email').value = p.email;
        }
        // Показываем форму
        authBlock?.classList.remove('hidden');
        dashBlock?.classList.add('hidden');
    } else {
        // Отмена (возврат в дашборд)
        checkFirstVisit();
    }
};

// Кнопка "Выйти" (Сброс данных)
window.logoutPartner = function() {
    if(confirm('Вы уверены, что хотите удалить профиль организации с этого устройства?')) {
        localStorage.removeItem('eco_partner_profile');
        // Очищаем поля
        document.getElementById('partner-form').reset();
        // Возвращаем на экран регистрации
        checkFirstVisit();
    }
};


// === 5. ГЛОБАЛЬНЫЕ ФУНКЦИИ (ДЛЯ HTML ONCLICK) ===

// Переключатель Быстрый / Смета
window.switchCalcMode = function(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    // Безопасное получение кнопки
    if(event && event.currentTarget) event.currentTarget.classList.add('active');

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

// Добавить объект в смету
window.addNewObjectToEstimate = function() {
    estimateData.push({ id: Date.now(), name: `Объект №${estimateData.length + 1}`, services: [] });
    renderEstimateLogic();
};

// Добавить услугу
window.addServiceToObject = function(objIndex) {
    if(servicesData.length > 0) {
        estimateData[objIndex].services.push({
            serviceId: servicesData[0].id,
            price: servicesData[0].basePrice
        });
        renderEstimateLogic();
    }
};

// Удалить услугу
window.removeServiceFromObject = function(objIndex, srvIndex) {
    estimateData[objIndex].services.splice(srvIndex, 1);
    renderEstimateLogic();
};

// Удалить объект
window.removeObject = function(index) {
    if (confirm('Удалить этот объект?')) {
        estimateData.splice(index, 1);
        renderEstimateLogic();
    }
};

// Обновить тип услуги
window.updateServiceType = function(objIndex, srvIndex, newId) {
    const srvInfo = servicesData.find(s => s.id === newId);
    if(srvInfo) {
        estimateData[objIndex].services[srvIndex].serviceId = newId;
        estimateData[objIndex].services[srvIndex].price = srvInfo.basePrice;
        renderEstimateLogic();
    }
};

// Отрисовка сметы
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
                </div>
            `;
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
            </button>
        `;
        container.appendChild(card);
    });

    const totalEl = document.getElementById('estimate-total-sum');
    if(totalEl) totalEl.textContent = globalTotal.toLocaleString() + ' ₽';
}

// Отправка сметы
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

// === CRM ФУНКЦИИ (ДЛЯ АДМИНА) ===

// 1. Обновить рейтинг (звезды)
window.updatePartnerRating = function(id, newRating) {
    const partner = partnersData.find(p => p.id === id);
    if (partner) {
        partner.rating = newRating;
        // Перерисовываем список, чтобы звезды загорелись
        renderPartnersView(partnersData);
        // Вибрация для тактильного отклика
        if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    }
};

// 2. Обновить заметку (сохраняется при потере фокуса)
window.updatePartnerNote = function(id, text) {
    const partner = partnersData.find(p => p.id === id);
    if (partner) {
        partner.note = text;
        console.log(`Заметка для ${partner.name} обновлена:`, text);
        // Тут можно было бы отправить данные на сервер
    }
};

// 3. Открыть чат
window.openPartnerChat = function(username) {
    const url = `https://t.me/${username}`;
    if(tg.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
};

// 4. Удалить партнера
window.deletePartner = function(id) {
    if(confirm('Удалить этого партнера из базы?')) {
        const index = partnersData.findIndex(p => p.id === id);
        if (index !== -1) {
            partnersData.splice(index, 1);
            renderPartnersView(partnersData);
        }
    }
};
// === 6. НОВЫЙ ФУНКЦИОНАЛ ===

// 1. Переход в калькулятор (CTA кнопка)
window.goToCalculator = function() {
    // Ищем кнопку таба
    const calcTab = document.querySelector('.nav-item[data-target="view-services"]');
    if (calcTab) {
        calcTab.click(); // Эмулируем клик по табу
        
        // Скроллим к началу калькулятора
        setTimeout(() => {
            const calcBlock = document.getElementById('calc-simple-mode');
            if (calcBlock) calcBlock.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
};

// 2. Логика Редактора статуса (Админ)
window.openStatusEditor = function() {
    const modal = document.getElementById('status-edit-modal');
    const slider = document.getElementById('edit-percent');
    const textInput = document.getElementById('edit-status-text');
    const valSpan = document.getElementById('edit-percent-val');
    
    // Подгружаем текущие данные (с учетом локальных изменений)
    const current = engineerProfile.workload;
    
    slider.value = current.percent;
    valSpan.textContent = current.percent;
    textInput.value = current.statusText;
    document.getElementById('edit-status-color').value = current.color;
    
    // Выделяем активный цвет
    document.querySelectorAll('.color-circle').forEach(c => {
        c.classList.toggle('active', c.getAttribute('style').includes(current.color));
    });

    // Живое обновление цифры при свайпе
    slider.oninput = function() { valSpan.textContent = this.value; };

    modal.classList.remove('hidden');
};

window.closeStatusModal = function() {
    document.getElementById('status-edit-modal').classList.add('hidden');
};

window.selectStatusColor = function(color) {
    document.getElementById('edit-status-color').value = color;
    // Визуальное выделение
    document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
    // Ищем круг с таким же цветом (грубый поиск)
    const circles = document.querySelectorAll('.color-circle');
    circles.forEach(c => {
        if(c.getAttribute('style').includes(color)) c.classList.add('active');
    });
};

window.saveNewStatus = function() {
    const percent = parseInt(document.getElementById('edit-percent').value);
    const text = document.getElementById('edit-status-text').value;
    const color = document.getElementById('edit-status-color').value || '#2ecc71';

    const newStatus = {
        percent: percent,
        statusText: text,
        color: color
    };

    // 1. Сохраняем в память (чтобы работало прямо сейчас)
    engineerProfile.workload = newStatus;
    
    // 2. Сохраняем в LocalStorage (чтобы сохранилось после перезагрузки У ВАС)
    localStorage.setItem('admin_custom_status', JSON.stringify(newStatus));

    // 3. Перерисовываем профиль
    renderProfileView(engineerProfile);
    
    // Если мы админ, нужно снова показать скрытые элементы (карандашик),
    // так как renderProfileView перерисовал HTML начисто.
    if(isAdmin) toggleAdminElementsView(true);

    closeStatusModal();
    
    // Выводим алерт с JSON, чтобы вы могли скопировать в data.js
    alert("Статус обновлен (Локально)!\n\nЧтобы клиенты увидели это изменение, скопируйте объект ниже в data.js:\n\n" + JSON.stringify(newStatus));
};
