// js/views.js

/**
 * ==============================================
 * МОДУЛЬ ОТРИСОВКИ (VIEW)
 * Отвечает только за манипуляции с DOM и генерацию HTML.
 * Данные получает из аргументов функций.
 * ==============================================
 */

/**
 * 1. РЕНДЕР ПРОФИЛЯ
 * Заполняет шапку, шкалу загрузки и пузыри географии.
 * @param {Object} profileData - Объект профиля из data.js
 */
function renderProfileView(profileData) {
    // 1. Применяем локальные изменения статуса (если админ редактировал)
    const savedStatus = localStorage.getItem('admin_custom_status');
    if (savedStatus) {
        try {
            const parsed = JSON.parse(savedStatus);
            profileData.workload = parsed; 
        } catch(e) {}
    }

    const container = document.getElementById('view-profile');
    if (!container) return;
    
    // Иконка карандаша (видна только если есть класс admin-only)
    const editBtnHTML = `<i class="fa-solid fa-pen-to-square admin-only edit-status-icon" onclick="openStatusEditor()"></i>`;

    container.innerHTML = `
        <header class="profile-header">
            <div class="profile-card">
                <img src="${profileData.avatar}" alt="Avatar" class="avatar" onerror="this.src='${CONFIG.PLACEHOLDER_AVATAR}'">
                <div class="profile-info">
                    <h1 id="profile-name">${profileData.name}</h1>
                    <p class="role">${profileData.title}</p>
                    <div class="tags">
                        ${profileData.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        </header>

        <!-- БЛОК ЗАГРУЗКИ -->
        <div class="status-section">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Моя загрузка ${editBtnHTML}</h3>
            </div>
            <div class="workload-container">
                <div class="workload-bar">
                    <div class="workload-fill" style="width: ${profileData.workload.percent}%; background: ${profileData.workload.color};"></div>
                </div>
                <p class="status-text">${profileData.workload.percent}% — ${profileData.workload.statusText}</p>
            </div>
        </div>

        <!-- ГЕОГРАФИЯ -->
        <div class="geo-section">
            <div class="geo-header">
                <h3>География работ</h3>
            </div>
            <div id="bubbles-cloud" class="bubbles-container"></div>
        </div>
        
        <!-- КНОПКИ ДЕЙСТВИЙ -->
        <div class="action-buttons">
            <!-- 1. Написать мне (Телеграм) -->
            <button class="btn btn-primary" onclick="window.open('${CONFIG.TELEGRAM_LINK}')">
                <i class="fa-brands fa-telegram"></i> Написать мне
            </button>
            
            <!-- 2. НОВАЯ КНОПКА: Заказать (Калькулятор) -->
            <!-- Используем тот же стиль btn-primary, но другую иконку -->
            <button class="btn btn-primary" onclick="goToCalculator()">
                <i class="fa-solid fa-calculator"></i> Заказать разработку
            </button>

            <!-- 3. Резюме (Оставим outline, чтобы не было "светофора" из 3 залитых кнопок) -->
            <button class="btn btn-outline">
                <i class="fa-solid fa-file-pdf"></i> Скачать Резюме
            </button>
            
            <div class="menu-list">
                ${profileData.documents.map(doc => `
                    <div class="menu-item" onclick="alert('Открываем документ: ${doc.title}')">
                        <div class="menu-icon-box" style="background: rgba(36, 129, 204, 0.1); color: #2481cc;">
                             <i class="fa-solid fa-file-contract"></i>
                        </div>
                        <div class="menu-text">
                            <span>${doc.title}</span>
                            <small>Посмотреть документ</small>
                        </div>
                        <i class="fa-solid fa-chevron-right arrow-icon"></i>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    renderGeoBubbles(profileData.geo.regions);
}

/**
 * Вспомогательная функция для пузырей
 */
function renderGeoBubbles(regions) {
    const container = document.getElementById('bubbles-cloud');
    if (!container || !regions) return;

    // 1. Перемешиваем массив регионов один раз при загрузке.
    // Текст фиксируется на своих местах и не "прыгает" по экрану.
    const shuffledRegions = [...regions].sort(() => Math.random() - 0.5);

    // 2. Отрисовываем все пузыри сразу (они скрыты CSS-ом через opacity: 0)
    container.innerHTML = shuffledRegions.map(name => `<div class="bubble">${name}</div>`).join('');

    const bubbles = document.querySelectorAll('.bubble');

    function activateRandomBubble() {
        if (bubbles.length === 0) return;

        // Выбираем случайный пузырь из списка
        const randomIndex = Math.floor(Math.random() * bubbles.length);
        const bubble = bubbles[randomIndex];

        // Если он сейчас не мигает — запускаем анимацию
        if (!bubble.classList.contains('animating')) {
            bubble.classList.add('animating');
            
            // Когда анимация (popInAndOut) закончится — убираем класс, 
            // чтобы пузырь мог мигнуть снова в будущем
            bubble.addEventListener('animationend', () => {
                bubble.classList.remove('animating');
            }, { once: true });
        }
    }

    // Очищаем старый интервал (на случай перезагрузки страницы без обновления)
    if (window.bubblesInterval) clearInterval(window.bubblesInterval);

    // Запускаем "мигалку" каждые 400мс
    window.bubblesInterval = setInterval(activateRandomBubble, 400);

    // Для быстрого старта "зажигаем" пару пузырей сразу, не дожидаясь таймера
    setTimeout(() => activateRandomBubble(), 0);
    setTimeout(() => activateRandomBubble(), 200);
}

/**
 * 2. РЕНДЕР ПРОЕКТОВ
 * Генерирует карточки проектов.
 * @param {Array} projects - Список проектов
 */
function renderProjectsView(projects) {
    const container = document.getElementById('projects-list');
    if (!container) return;
    
    container.innerHTML = ''; // Очистка перед рендером

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align:center; padding: 40px; color: #999;">
                <i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 10px;"></i>
                <p>Проектов пока нет</p>
            </div>`;
        return;
    }

    projects.forEach(project => {
        // Выбор цвета статуса
        const statusColorClass = project.status === 'paused' ? 'text-yellow' : 'text-green';
        const progressColor = project.status === 'paused' ? '#f1c40f' : '#2ecc71';

        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="card-header">
                <span class="card-title">${project.clientName}</span>
                <span class="card-type">${project.type}</span>
            </div>
            <div class="progress-wrapper">
                <div class="progress-line" style="width: ${project.progress}%; background-color: ${progressColor}"></div>
            </div>
            <div class="card-footer">
                <span class="${statusColorClass}">
                    <i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${project.statusLabel}
                </span>
                <span>Дедлайн: ${project.deadline}</span>
            </div>
        `;

        // Клик открывает модалку
        card.addEventListener('click', () => fillAndShowModal(project));
        container.appendChild(card);
    });
}


/**
 * 3. МОДАЛЬНОЕ ОКНО (ДЕТАЛИ ПРОЕКТА)
 */
function fillAndShowModal(project) {
    const modal = document.getElementById('project-detail-modal');
    const body = document.getElementById('modal-body');
    const closeBtn = document.querySelector('.close-modal');
    
    if (!modal || !body) return;

    // Генерируем историю событий
    const historyHTML = project.history.length 
        ? project.history.map(item => `
            <div style="margin-bottom: 10px; font-size: 0.9rem; border-left: 2px solid #ccc; padding-left: 10px;">
                <div style="font-weight: bold; font-size: 0.75rem; color: #888;">${item.date}</div>
                <div style="${item.type === 'warning' ? 'color: #e74c3c' : ''}">${item.text}</div>
            </div>
          `).join('')
        : '<div style="color:#999; font-size:0.9rem;">Событий пока нет</div>';

    // Заполняем тело модалки
    body.innerHTML = `
        <h2>${project.type} - ${project.clientName}</h2>
        
        <div style="margin-bottom: 15px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 8px;">
            <strong>💻 Ресурсы:</strong><br>
            ${project.resources.method}<br>
            <span style="font-size: 0.8rem; color: #888;">${project.resources.details}</span>
        </div>
        
        <h3>📜 Журнал событий</h3>
        <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
            ${historyHTML}
        </div>

        <button class="btn btn-outline full-width" id="btn-modal-close-action">
            Закрыть
        </button>
    `;

    // Показываем окно
    modal.classList.remove('hidden');

    // Функция закрытия
    const closeModal = () => modal.classList.add('hidden');

    // Вешаем закрытие на:
    // 1. Крестик
    if (closeBtn) closeBtn.onclick = closeModal;
    // 2. Кнопку внутри
    document.getElementById('btn-modal-close-action').onclick = closeModal;
    // 3. Фон (затемненную область)
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}


/**
 * 4. УСЛУГИ И КАЛЬКУЛЯТОР
 */

// Заполняет <select> услугами
function fillCalculatorOptions(services) {
    const typeSelect = document.getElementById('calc-service-type');
    if (typeSelect) {
        typeSelect.innerHTML = services.map(s => 
            `<option value="${s.id}">${s.name}</option>`
        ).join('');
    }
}

// Рисует текстовый список услуг под калькулятором
function renderServicesListView(services) {
    const container = document.getElementById('services-container');
    if (container) {
        container.innerHTML = services.map(s => `
            <div style="margin-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 10px;">
                <strong>${s.name}</strong>
                <p style="font-size: 0.85rem; color: #777;">${s.desc}</p>
                <div style="font-size: 0.8rem; margin-top: 5px;">
                    От <b>${s.basePrice.toLocaleString()} ₽</b> / ${s.unit}
                </div>
            </div>
        `).join('');
    }
}


/**
 * 5. АДМИНКА (ПАРТНЕРЫ)
 */
function renderPartnersView(partners) {
    const container = document.getElementById('partners-list');
    const debtDisplay = document.getElementById('fin-debt');
    const waitDisplay = document.getElementById('fin-wait');
    
    if (!container) return;

    let totalDebt = 0;
    let totalWait = 0;

    container.innerHTML = partners.map(p => {
        totalDebt += p.finances.debt;
        totalWait += p.finances.wait;

        // Определяем цвет боковой полоски
        let badgeColor = 'var(--status-green)'; // По умолчанию зеленый
        if (p.rating <= 2) badgeColor = 'var(--status-red)'; // Плохой рейтинг
        if (p.finances.debt > 0) badgeColor = 'var(--status-red)'; // Должник
        
        // Генерация звезд
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            const starClass = i <= p.rating ? 'fa-solid' : 'fa-regular';
            const colorStyle = i <= p.rating ? 'color: #f1c40f;' : 'color: #ccc;';
            // onclick вызывает глобальную функцию смены рейтинга
            starsHTML += `<i class="${starClass} fa-star star-btn" style="${colorStyle}" onclick="updatePartnerRating(${p.id}, ${i})"></i>`;
        }

        // Кнопка Телеграм
        const tgButton = p.username 
            ? `<button class="btn-mini btn-tg" onclick="openPartnerChat('${p.username}')"><i class="fa-brands fa-telegram"></i> Чат</button>`
            : `<span class="no-tg"><i class="fa-solid fa-ban"></i> Нет TG</span>`;

        return `
            <div class="partner-card-crm" style="border-left: 5px solid ${badgeColor};">
                
                <!-- Верх: Название и Удаление -->
                <div class="crm-header">
                    <div class="crm-title">
                        <h3>${p.name}</h3>
                        <div class="crm-inn">ИНН: ${p.inn || 'Не указан'}</div>
                    </div>
                    <button class="btn-icon-delete" onclick="deletePartner(${p.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <!-- Контакты -->
                <div class="crm-contacts">
                    <div class="crm-row"><i class="fa-solid fa-user"></i> ${p.contact}</div>
                    <div class="crm-row"><i class="fa-solid fa-envelope"></i> ${p.email || 'Нет email'}</div>
                </div>

                <!-- Управление: Рейтинг и ТГ -->
                <div class="crm-actions">
                    <div class="crm-stars">${starsHTML}</div>
                    ${tgButton}
                </div>

                <!-- Заметки Админа (Приватные) -->
                <div class="crm-notes">
                    <label>Моя заметка (вижу только я):</label>
                    <textarea 
                        onchange="updatePartnerNote(${p.id}, this.value)" 
                        placeholder="Напишите комментарий о клиенте...">${p.note || ''}</textarea>
                </div>

                <!-- Финансы (если есть долг) -->
                ${p.finances.debt > 0 ? `<div class="crm-debt-alert">⚠️ Долг: ${p.finances.debt.toLocaleString()} ₽</div>` : ''}

            </div>
        `;
    }).join('');

    // Обновляем дашборд
    if (debtDisplay) debtDisplay.textContent = totalDebt.toLocaleString() + ' ₽';
    if (waitDisplay) waitDisplay.textContent = totalWait.toLocaleString() + ' ₽';
}

/**
 * Управление видимостью админских блоков
 */
function toggleAdminElementsView(show) {
    const elements = document.querySelectorAll('.admin-only');
    elements.forEach(el => {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

}

