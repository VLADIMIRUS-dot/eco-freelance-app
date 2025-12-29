/**
 * ==============================================
 * МОДУЛЬ ОТРИСОВКИ (VIEW)
 * ==============================================
 */

const View = {
    
    renderProfile(profileData, isAdmin) {
        const { workload, geo, documents } = profileData;
        const barColor = workload.color || '#2ecc71';
        
        // Кнопка редактирования видна ТОЛЬКО админу
        const editBtnHTML = isAdmin 
            ? `<i class="fa-solid fa-pen-to-square admin-only edit-status-icon" data-action="open-status-editor"></i>` 
            : '';

        const docsHTML = documents.map(doc => `
            <div class="menu-item" data-action="open-doc" data-title="${doc.title}">
                <div class="menu-icon-box" style="background: rgba(36, 129, 204, 0.1); color: #2481cc;">
                     <i class="fa-solid fa-file-contract"></i>
                </div>
                <div class="menu-text">
                    <span>${doc.title}</span>
                    <small>Посмотреть документ</small>
                </div>
                <i class="fa-solid fa-chevron-right arrow-icon"></i>
            </div>
        `).join('');

        return `
            <header class="profile-header">
                <div class="profile-card">
                    <img src="${profileData.avatar}" alt="Avatar" class="avatar" onerror="this.src='${CONFIG.PLACEHOLDER_AVATAR}'">
                    <div class="profile-info">
                        <h1 id="profile-name">${profileData.name}</h1>
                        <p class="role">${profileData.title}</p>
                        <div class="tags">${profileData.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
                    </div>
                </div>
            </header>

            <div class="status-section">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>Моя загрузка ${editBtnHTML}</h3>
                </div>
                <div class="workload-container">
                    <div class="workload-bar">
                        <div class="workload-fill" style="width: ${workload.percent}%; background-color: ${barColor};"></div>
                    </div>
                    <p class="status-text">${workload.percent}% — ${workload.statusText}</p>
                </div>
            </div>

            <div class="geo-section">
                <div class="geo-header"><h3>География работ</h3></div>
                <div id="bubbles-cloud" class="bubbles-container">${this._generateBubblesHTML(geo)}</div>
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-primary" data-action="contact-telegram"><i class="fa-brands fa-telegram"></i> Написать мне</button>
                <button class="btn btn-primary btn-attention" data-action="nav-to-calc"><i class="fa-solid fa-calculator"></i> Заказать разработку</button>
                <button class="btn btn-outline" data-action="download-resume"><i class="fa-solid fa-file-pdf"></i> Скачать Резюме</button>
                <div class="menu-list">${docsHTML}</div>
            </div>
        `;
    },

    _generateBubblesHTML(regions) {
        if (!regions) return '';
        const shuffled = [...regions].sort(() => Math.random() - 0.5).slice(0, 12);
        return shuffled.map(name => `<div class="bubble">${name}</div>`).join('');
    },

    initBubblesAnimation(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const bubbles = container.querySelectorAll('.bubble');
        if (bubbles.length === 0) return;

        const animateRandomBubble = () => {
            if (document.hidden || !container.offsetParent) { setTimeout(animateRandomBubble, 1000); return; }
            const randomIndex = Math.floor(Math.random() * bubbles.length);
            const bubble = bubbles[randomIndex];
            if (!bubble.classList.contains('animating')) {
                bubble.classList.add('animating');
                bubble.addEventListener('animationend', () => { bubble.classList.remove('animating'); }, { once: true });
            }
            setTimeout(animateRandomBubble, 300 + Math.random() * 500);
        };
        animateRandomBubble();
    },

    renderProjectsList(projects) {
        if (!projects || projects.length === 0) {
            return `<div class="empty-state" style="text-align:center; padding: 40px; color: #999;"><i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 10px;"></i><p>Проектов пока нет</p></div>`;
        }
        return projects.map(project => {
            let progressColor = '#2ecc71';
            if (project.status === 'paused') progressColor = '#f1c40f';
            else if (project.status === 'analysis') progressColor = '#3498db';

            return `
                <div class="project-card" data-action="open-project-modal" data-id="${project.id}">
                    <div class="card-header"><span class="card-title">${project.clientName}</span><span class="card-type">${project.type}</span></div>
                    <div class="progress-wrapper"><div class="progress-line" style="width: ${project.progress}%; background-color: ${progressColor}"></div></div>
                    <div class="card-footer">
                        <span style="color: ${progressColor}; font-weight: 600;"><i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${project.statusLabel}</span>
                        <span>Дедлайн: ${project.deadline}</span>
                    </div>
                </div>`;
        }).join('');
    },

    renderProjectModalContent(project) {
        const historyHTML = project.history.length 
            ? project.history.map(item => `<div style="margin-bottom: 10px; font-size: 0.9rem; border-left: 2px solid #ccc; padding-left: 10px;"><div style="font-weight: bold; font-size: 0.75rem; color: #888;">${item.date}</div><div style="${item.type === 'warning' ? 'color: #e74c3c' : ''}">${item.text}</div></div>`).join('') 
            : '<div style="color:#999; font-size:0.9rem;">Событий пока нет</div>';

        return `
            <h2>${project.type} - ${project.clientName}</h2>
            <div style="margin-bottom: 15px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 8px;">
                <strong>💻 Ресурсы:</strong><br>${project.resources.method}<br><span style="font-size: 0.8rem; color: #888;">${project.resources.details}</span>
            </div>
            <h3>📜 Журнал событий</h3>
            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">${historyHTML}</div>
            <button class="btn btn-outline full-width" data-action="close-modal">Закрыть</button>
        `;
    },

    renderServicesOptions(services) { return services.map(s => `<option value="${s.id}">${s.name}</option>`).join(''); },
    renderServicesList(services) {
        return services.map(s => `<div style="margin-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 10px;"><strong>${s.name}</strong><p style="font-size: 0.85rem; color: #777;">${s.desc}</p><div style="font-size: 0.8rem; margin-top: 5px;">От <b>${s.basePrice.toLocaleString()} ₽</b> / ${s.unit}</div></div>`).join('');
    },
    renderCalculatorInputs(service) {
        if (!service) return '';
        return service.params.map(param => {
            let inputHTML = '';
            if (param.type === 'number') {
                inputHTML = `<div class="input-with-suffix"><input type="number" class="calc-input styled-num-input" data-id="${param.id}" value="${param.default}" min="0" step="1"><span class="input-suffix">${param.suffix || ''}</span></div>`;
            } else if (param.type === 'range') {
                inputHTML = `<input type="range" class="calc-input" data-id="${param.id}" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}"><div class="calc-range-wrapper"><span>${param.min}</span><span id="val-${param.id}" style="color:var(--tg-theme-button-color)">${param.default}</span><span>${param.max}</span></div>`;
            } else if (param.type === 'select') {
                const options = param.options.map(opt => `<option value="${opt.val}">${opt.text}</option>`).join('');
                inputHTML = `<select class="calc-input" data-id="${param.id}">${options}</select>`;
            } else if (param.type === 'checkbox') {
                return `<div class="form-group checkbox-group"><input type="checkbox" class="calc-input" id="chk-${param.id}" data-id="${param.id}"><label for="chk-${param.id}">${param.label}</label></div>`;
            }
            return `<div class="form-group"><label>${param.label}</label>${inputHTML}</div>`;
        }).join('');
    },
    renderEstimateList(estimateData, servicesData) {
        if (!estimateData || estimateData.length === 0) return '';
        return estimateData.map((obj, objIndex) => {
            let objTotal = 0;
            const servicesHTML = obj.services.map((srv, srvIndex) => {
                objTotal += srv.price;
                const options = servicesData.map(s => `<option value="${s.id}" ${s.id === srv.serviceId ? 'selected' : ''}>${s.name}</option>`).join('');
                return `<div class="service-row"><div class="custom-select-wrapper"><select data-action="update-est-service" data-obj-idx="${objIndex}" data-srv-idx="${srvIndex}">${options}</select><i class="fa-solid fa-chevron-down select-arrow"></i></div><div style="display:flex; align-items:center; gap:10px;"><span style="white-space:nowrap;">${srv.price.toLocaleString()} ₽</span><i class="fa-solid fa-trash text-red" data-action="remove-est-service" data-obj-idx="${objIndex}" data-srv-idx="${srvIndex}"></i></div></div>`;
            }).join('');
            return `<div class="estimate-object-card"><div class="obj-header"><input type="text" class="obj-name-input" value="${obj.name}" data-action="update-est-name" data-obj-idx="${objIndex}"><span class="remove-obj-btn" data-action="remove-est-obj" data-obj-idx="${objIndex}">Удалить</span></div><div class="obj-params-row"><label><i class="fa-solid fa-industry"></i> Источников:</label><input type="number" class="obj-sources-input" value="${obj.sourcesCount}" data-action="update-est-sources" data-obj-idx="${objIndex}"></div><div class="obj-services-list">${servicesHTML.length ? servicesHTML : '<p style="font-size:0.8rem; color:#999; text-align:center; padding:10px;">Добавьте услуги</p>'}</div><div style="text-align:right; margin-bottom:10px; margin-top:10px; border-top:1px solid #eee; padding-top:5px;"><small>Итого: <strong>${objTotal.toLocaleString()} ₽</strong></small></div><button class="btn btn-outline full-width" style="font-size:0.8rem; padding:8px;" data-action="add-est-service" data-obj-idx="${objIndex}"><i class="fa-solid fa-plus"></i> Добавить услугу</button></div>`;
        }).join('');
    },

    renderCRM(partners, filterStatus, totalDebt, totalPotential) {
        const statsHTML = `
            <div class="crm-search-box"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Поиск..." class="full-width" data-action="crm-search"></div>
            <div class="crm-stats-row"><div class="stat-box"><strong class="text-debt">${totalDebt.toLocaleString()} ₽</strong><small>Долг мне</small></div><div class="stat-box"><strong class="text-profit">${totalPotential.toLocaleString()} ₽</strong><small>Ожидаю</small></div></div>
            <div class="crm-filters"><span class="crm-chip ${filterStatus === 'all' ? 'active' : ''}" data-action="crm-filter" data-val="all">Все</span><span class="crm-chip alert ${filterStatus === 'debt' ? 'active' : ''}" data-action="crm-filter" data-val="debt">⚠️ Должники</span><span class="crm-chip ${filterStatus === 'active' ? 'active' : ''}" data-action="crm-filter" data-val="active">В работе</span><span class="crm-chip ${filterStatus === 'lead' ? 'active' : ''}" data-action="crm-filter" data-val="lead">Лиды</span></div>
        `;

        let listHTML = '';
        if (partners.length === 0) listHTML = `<div style="text-align:center; padding:30px; color:#999;">Никого не найдено</div>`;
        else {
            listHTML = partners.map(p => {
                const percentPaid = Math.min(100, (p.finance.paid / p.finance.total) * 100) || 0;
                const percentDebt = Math.min(100, (p.finance.debt / p.finance.total) * 100) || 0;
                
                // ИНТЕРАКТИВНЫЕ ЗВЕЗДЫ
                let stars = '';
                for(let i=1; i<=5; i++) {
                    const color = i <= p.rating ? '#f1c40f' : '#ddd';
                    stars += `<i class="fa-solid fa-star" style="color: ${color}; font-size: 0.9rem; cursor:pointer; padding:2px;" data-action="crm-rate" data-id="${p.id}" data-val="${i}"></i>`;
                }

                const projectsHTML = p.projects.map(prj => `<span class="project-badge active">${prj.type}</span>`).join('');

                return `
                <div class="crm-card-modern">
                    <div data-action="crm-toggle-details" data-id="${p.id}">
                        <div class="crm-top-row">
                            <div><div class="crm-name">${p.name}</div><span class="crm-inn-tiny">ИНН: ${p.inn}</span><div class="rating-stars-mini">${stars}</div></div>
                            <i class="fa-solid fa-chevron-down arrow-indicator" id="crm-arrow-${p.id}" style="color:#ccc; transition:0.3s;"></i>
                        </div>
                        <div class="crm-tags-row">${projectsHTML}${p.finance.debt > 0 ? '<span class="project-badge" style="background:#ffebee; color:#c62828;">Долг</span>' : ''}</div>
                        <div class="fin-bar-wrapper"><div class="fin-segment-paid" style="width: ${percentPaid}%"></div><div class="fin-segment-debt" style="width: ${percentDebt}%"></div></div>
                        <div class="fin-text-row"><span style="color:var(--status-green)">${p.finance.paid.toLocaleString()}</span>${p.finance.debt > 0 ? `<strong style="color:var(--status-red)">-${p.finance.debt.toLocaleString()}</strong>` : '<span style="color:#ccc">0</span>'}</div>
                    </div>
                    <div class="crm-details" id="crm-details-${p.id}">
                        <div class="crm-detail-item"><i class="fa-solid fa-file-signature"></i> <span>${p.contract}</span></div>
                        <div class="crm-detail-item"><i class="fa-solid fa-user"></i> <span>${p.contact}</span></div>
                        <div class="crm-detail-item"><i class="fa-solid fa-phone"></i> <span>${p.phone || "Нет номера"}</span></div>
                        <div style="background:rgba(0,0,0,0.03); padding:8px; border-radius:8px; margin:10px 0;">
                            <label style="font-size:0.7rem; color:#999; display:block; margin-bottom:4px;">Заметка:</label>
                            <textarea class="full-width" style="border:none; background:transparent; font-size:0.85rem; resize:none;" rows="2" data-action="crm-note-change" data-id="${p.id}">${p.note}</textarea>
                        </div>
                        <div class="crm-btns-row">
                            <div class="crm-action-btn" data-action="crm-open-tg" data-username="${p.username}"><i class="fa-brands fa-telegram" style="color:#2481cc"></i> TG</div>
                            <div class="crm-action-btn" data-action="crm-copy-inn" data-inn="${p.inn}"><i class="fa-solid fa-copy"></i> ИНН</div>
                            <div class="crm-action-btn" style="color:var(--status-red)" data-action="crm-delete" data-id="${p.id}"><i class="fa-solid fa-trash"></i></div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
        return statsHTML + listHTML;
    }
};
