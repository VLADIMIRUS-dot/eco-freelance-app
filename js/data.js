/**
 * ==============================================
 * МОДУЛЬ ДАННЫХ (MODEL / STORE)
 * ==============================================
 */

const CONFIG = {
    // ВАЖНО: Замените на ваш реальный ID для тестов
    ADMIN_ID: 8027648882, 
    TELEGRAM_LINK: "https://t.me/EcoSubcontract",
    PLACEHOLDER_AVATAR: "https://via.placeholder.com/100",
    
    // true = вы всегда Админ (для отладки в браузере)
    // false = проверка по ID из Telegram
    FORCE_ADMIN_MODE: false 
};

const Store = {
    state: {
        user: null,
        isAdmin: false,
        partnerId: null, // ID текущего пользователя как партнера (из localStorage)

        engineer: {
            name: "Владимир Протасов",
            title: "Инженер-эколог / Проектировщик",
            avatar: "images/avatar.jpg",
            tags: ["ОПИ", "НДВ", "НМУ", "ПЭК", "СЗЗ", "ЛК РПН"],
            workload: { percent: 75, statusText: "Загружен", color: "#f1c40f" },
            geo: ["Курганская область", "Тюменская область", "ХМАО", "ЯНАО", "Томская область", "Курган", "Кемерово"],
            documents: [
                { title: "Мои реквизиты (НПД)", link: "#" },
                { title: "Шаблон договора", link: "#" }
            ]
        },

        services: [
            { 
                id: 'ndv', name: 'Проект НДВ (ПДВ)', basePrice: 15000, unit: 'источник', desc: 'Для 1-3 категорий НВОС.',
                params: [
                    { id: 'sources', label: 'Кол-во источников', type: 'number', default: 10, costPerUnit: 2500 },
                    { id: 'sites', label: 'Промплощадки', type: 'number', default: 1, costPerUnit: 5000 }
                ]
            },
            { 
                id: 'szz', name: 'Проект СЗЗ', basePrice: 30000, unit: 'проект', desc: 'Санитарно-защитная зона.',
                params: [
                    { id: 'hazard_class', label: 'Класс опасности', type: 'select', options: [
                        { val: 1, text: '1 класс (1000м)', cost: 100000 },
                        { val: 2, text: '2 класс (500м)', cost: 80000 },
                        { val: 3, text: '3 класс (300м)', cost: 50000 }
                    ]},
                    { id: 'risk', label: 'Оценка риска?', type: 'checkbox', cost: 45000 }
                ]
            }
        ],

        projects: [
            {
                id: 101, ownerId: 222222, clientName: "ООО 'Завод Металл'", type: "НДВ",
                status: "paused", statusLabel: "Приостановлено", progress: 40, deadline: "25.12.2023",
                resources: { method: "RDP", details: "Сервер заказчика" },
                history: [{ date: "01.11", type: "start", text: "Старт работ" }]
            },
            {
                id: 102, ownerId: 222222, clientName: "ООО 'Завод Металл'", type: "ПЭК",
                status: "done", statusLabel: "Готов", progress: 100, deadline: "01.11.2023",
                resources: { method: "Личное ПО", details: "Интеграл" },
                history: []
            }
        ],

        partners: [
            {
                id: 1, name: "ООО 'Северный Металл'", inn: "7712000001", contact: "Сергей (ГИП)",
                username: "sergey_gip", phone: "+79001112233", email: "gip@sever-met.ru",
                status: "active", contract: "№45-23 от 10.01.23",
                projects: [{ type: "НДВ", stage: "Экспертиза", deadline: "20.12" }],
                finance: { total: 150000, paid: 100000, debt: 50000 },
                rating: 5, note: "Хорошие ребята."
            },
            {
                id: 2, name: "ИП Строитель В.В.", inn: "540011122233", contact: "Виктор", username: "",
                phone: "+79998887766", email: "stroy@mail.ru",
                status: "lead", contract: "На согласовании",
                projects: [],
                finance: { total: 45000, paid: 0, debt: 0 },
                rating: 3, note: "Торгуется."
            }
        ],

        estimate: []
    },

    init(tgUser) {
        this.state.user = tgUser;
        const userId = tgUser?.id || 0;
        
        // ЛОГИКА АДМИНА: ID совпадает ИЛИ включен режим отладки
        this.state.isAdmin = (userId == CONFIG.ADMIN_ID) || CONFIG.FORCE_ADMIN_MODE;
        
        // ID Партнера (из локального хранилища браузера/телефона)
        this.state.partnerId = localStorage.getItem('eco_partner_id');

        this.loadSettings();
    },

    loadSettings() {
        const savedStatus = localStorage.getItem('admin_custom_status');
        if (savedStatus) {
            try { this.state.engineer.workload = JSON.parse(savedStatus); } catch(e) {}
        }
    },

    saveWorkloadStatus(newStatus) {
        this.state.engineer.workload = newStatus;
        localStorage.setItem('admin_custom_status', JSON.stringify(newStatus));
    },

    // === ЛОГИКА ДОСТУПА К ПРОЕКТАМ ===
    getVisibleProjects() {
        // 1. Если Админ — отдаем ВСЕ проекты
        if (this.state.isAdmin) {
            return this.state.projects;
        }
        
        // 2. Если Партнер — отдаем только ЕГО проекты
        // Сравниваем ownerId с ID пользователя TG или с ID из localStorage
        const tgId = this.state.user?.id;
        const localId = this.state.partnerId;

        return this.state.projects.filter(p => {
            // Нестрогое сравнение (==), т.к. id могут быть строками или числами
            return (tgId && p.ownerId == tgId) || (localId && p.ownerId == localId);
        });
    },

    addProject(project) {
        this.state.projects.unshift(project);
    },

    // === CRM ACTIONS ===
    getPartners(filter = 'all', searchQuery = '') {
        let data = this.state.partners;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(p => p.name.toLowerCase().includes(q) || p.inn.includes(q));
        }
        if (filter === 'debt') data = data.filter(p => p.finance.debt > 0);
        else if (filter === 'active') data = data.filter(p => p.status === 'active');
        else if (filter === 'lead') data = data.filter(p => p.status === 'lead');
        return data;
    },

    addPartner(partnerData) {
        this.state.partners.unshift(partnerData);
    },

    updatePartner(id, updates) {
        const idx = this.state.partners.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.state.partners[idx] = { ...this.state.partners[idx], ...updates };
            return true;
        }
        return false;
    },

    deletePartner(id) {
        const idx = this.state.partners.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.state.partners.splice(idx, 1);
            return true;
        }
        return false;
    },

    // === ESTIMATE ACTIONS ===
    addToEstimate(obj) { this.state.estimate.push(obj); },
    removeFromEstimate(idx) { this.state.estimate.splice(idx, 1); },
    updateEstimateObject(idx, key, val) { this.state.estimate[idx][key] = val; }
};
