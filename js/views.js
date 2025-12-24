// js/views.js

/**
 * ==============================================
 * МОДУЛЬ ОТРИСОВКИ (VIEW)
 * ==============================================
 */

/**
 * 1. РЕНДЕР ПРОФИЛЯ
 */
function renderProfileView(profileData) {
    // Проверка локальных изменений
    const savedStatus = localStorage.getItem('admin_custom_status');
    if (savedStatus) {
        try {
            const parsed = JSON.parse(savedStatus);
            profileData.workload = parsed; 
        } catch(e) {}
    }

    const container = document.getElementById('view-profile');
    if (!container) return;
    
    // Если цвет не задан (первый запуск), считаем его автоматически
    if (!profileData.workload.color) {
        // Формула: 120 (green) -> 0 (red)
        const hue = Math.floor((100 - profileData.workload.percent) * 1.2);
        profileData.workload.color = `hsl(${hue}, 85%, 45%)`;
    }

    // Иконка карандаша (видна только админу через CSS)
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
                    <!-- ВАЖНО: background передается напрямую в style -->
                    <div class="workload-fill" style="width: ${profileData.workload.percent}%; background-color: ${profileData.workload.color};"></div>
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
        
        <!-- КНОПКИ -->
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.open('${CONFIG.TELEGRAM_LINK}')">
                <i class="fa-brands fa-telegram"></i> Написать мне
            </button>
            
            <button class="btn btn-primary" onclick="goToCalculator()">
                <i class="fa-solid fa-calculator"></i> Заказать разработку
            </button>

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

/** Вспомогательная функция для пузырей */
function renderGeoBubbles(regions) {
    const container = document.getElementById('bubbles-cloud');
    if (!container || !regions) return;
    const shuffledRegions = [...regions].sort(() => Math.random() - 0.5);
    container.innerHTML = shuffledRegions.map(name => `<div class="bubble">${name}</div>`).join('');
    const bubbles = document.querySelectorAll('.bubble');
    function activateRandomBubble() {
        if (bubbles.length === 0) return;
        const randomIndex = Math.floor(Math.random() * bubbles.length);
        const bubble = bubbles[randomIndex];
        if (!bubble.classList.contains('animating')) {
            bubble.classList.add('animating');
            bubble.addEventListener('animationend', () => {
                bubble.classList.remove('animating');
            }, { once: true });
        }
    }
    if (window.bubblesInterval) clearInterval(window.bubblesInterval);
    window.bubblesInterval = setInterval(activateRandomBubble, 400);
    setTimeout(() => activateRandomBubble(), 0);
    setTimeout(() => activateRandomBubble(), 200);
}

/** 2. РЕНДЕР ПРОЕКТОВ */
function renderProjectsView(projects) {
    const container = document.getElementById('projects-list');
    if (!container) return;
    container.innerHTML = ''; 
    if (projects.length === 0) {
        container.innerHTML = `<div class="empty-state" style="text-align:center; padding: 40px; color: #999;"><i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 10px;"></i><p>Проектов пока нет</p></div>`;
        return;
    }
    projects.forEach(project => {
        const statusColorClass = project.status === 'paused' ? 'text-yellow' : 'text-green';
        const progressColor = project.status === 'paused' ? '#f1c40f' : '#2ecc71';
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="card-header"><span class="card-title">${project.clientName}</span><span class="card-type">${project.type}</span></div>
            <div class="progress-wrapper"><div class="progress-line" style="width: ${project.progress}%; background-color: ${progressColor}"></div></div>
            <div class="card-footer"><span class="${statusColorClass}"><i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${project.statusLabel}</span><span>Дедлайн: ${project.deadline}</span></div>`;
        card.addEventListener('click', () => fillAndShowModal(project));
        container.appendChild(card);
    });
}

/** 3. МОДАЛЬНОЕ ОКНО */
function fillAndShowModal(project) {
    const modal = document.getElementById('project-detail-modal');
    const body = document.getElementById('modal-body');
    const closeBtn = document.querySelector('.close-modal');
    if (!modal || !body) return;
    const historyHTML = project.history.length ? project.history.map(item => `<div style="margin-bottom: 10px; font-size: 0.9rem; border-left: 2px solid #ccc; padding-left: 10px;"><div style="font-weight: bold; font-size: 0.75rem; color: #888;">${item.date}</div><div style="${item.type === 'warning' ? 'color: #e74c3c' : ''}">${item.text}</div></div>`).join('') : '<div style="color:#999; font-size:0.9rem;">Событий пока нет</div>';
    body.innerHTML = `<h2>${project.type} - ${project.clientName}</h2><div style="margin-bottom: 15px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 8px;"><strong>💻 Ресурсы:</strong><br>${project.resources.method}<br><span style="font-size: 0.8rem; color: #888;">${project.resources.details}</span></div><h3>📜 Журнал событий</h3><div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">${historyHTML}</div><button class="btn btn-outline full-width" id="btn-modal-close-action">Закрыть</button>`;
    modal.classList.remove('hidden');
    const closeModal = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.onclick = closeModal;
    document.getElementById('btn-modal-close-action').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

/** 4. УСЛУГИ */
function fillCalculatorOptions(services) {
    const typeSelect = document.getElementById('calc-service-type');
    if (typeSelect) typeSelect.innerHTML = services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}
function renderServicesListView(services) {
    const container = document.getElementById('services-container');
    if (container) container.innerHTML = services.map(s => `<div style="margin-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 10px;"><strong>${s.name}</strong><p style="font-size: 0.85rem; color: #777;">${s.desc}</p><div style="font-size: 0.8rem; margin-top: 5px;">От <b>${s.basePrice.toLocaleString()} ₽</b> / ${s.unit}</div></div>`).join('');
}

/** 5. CRM */
function renderPartnersView(partners) {
    const container = document.getElementById('partners-list');
    const debtDisplay = document.getElementById('fin-debt');
    const waitDisplay = document.getElementById('fin-wait');
    if (!container) return;
    let totalDebt = 0; let totalWait = 0;
    container.innerHTML = partners.map(p => {
        totalDebt += p.finances.debt; totalWait += p.finances.wait;
        let badgeColor = 'var(--status-green)';
        if (p.rating <= 2 || p.finances.debt > 0) badgeColor = 'var(--status-red)';
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            const starClass = i <= p.rating ? 'fa-solid' : 'fa-regular';
            const colorStyle = i <= p.rating ? 'color: #f1c40f;' : 'color: #ccc;';
            starsHTML += `<i class="${starClass} fa-star star-btn" style="${colorStyle}" onclick="updatePartnerRating(${p.id}, ${i})"></i>`;
        }
        const tgButton = p.username ? `<button class="btn-mini btn-tg" onclick="openPartnerChat('${p.username}')"><i class="fa-brands fa-telegram"></i> Чат</button>` : `<span class="no-tg"><i class="fa-solid fa-ban"></i> Нет TG</span>`;
        return `<div class="partner-card-crm" style="border-left: 5px solid ${badgeColor};"><div class="crm-header"><div class="crm-title"><h3>${p.name}</h3><div class="crm-inn">ИНН: ${p.inn || 'Не указан'}</div></div><button class="btn-icon-delete" onclick="deletePartner(${p.id})"><i class="fa-solid fa-trash"></i></button></div><div class="crm-contacts"><div class="crm-row"><i class="fa-solid fa-user"></i> ${p.contact}</div><div class="crm-row"><i class="fa-solid fa-envelope"></i> ${p.email || 'Нет email'}</div></div><div class="crm-actions"><div class="crm-stars">${starsHTML}</div>${tgButton}</div><div class="crm-notes"><label>Заметка:</label><textarea onchange="updatePartnerNote(${p.id}, this.value)">${p.note || ''}</textarea></div>${p.finances.debt > 0 ? `<div class="crm-debt-alert">⚠️ Долг: ${p.finances.debt.toLocaleString()} ₽</div>` : ''}</div>`;
    }).join('');
    if (debtDisplay) debtDisplay.textContent = totalDebt.toLocaleString() + ' ₽';
    if (waitDisplay) waitDisplay.textContent = totalWait.toLocaleString() + ' ₽';
}

function toggleAdminElementsView(show) {
    const elements = document.querySelectorAll('.admin-only');
    elements.forEach(el => {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}
