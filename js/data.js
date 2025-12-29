/**
 * ==============================================
 * МОДУЛЬ ДАННЫХ (MODEL / STORE)
 * Центральное хранилище состояния приложения
 * ==============================================
 */

const CONFIG = {
    ADMIN_ID: 8027648882,
    TELEGRAM_LINK: "https://t.me/EcoSubcontract",
    PLACEHOLDER_AVATAR: "https://via.placeholder.com/100",
    // Флаг для отладки в браузере без Telegram
    FORCE_ADMIN_MODE: false 
};

const Store = {
    state: {
        user: null, // Текущий пользователь TG
        isAdmin: false,
        
        // Профиль инженера (статичные + динамические данные)
        engineer: {
            name: "Владимир Протасов",
            title: "Инженер-эколог / Проектировщик",
            avatar: "images/avatar.jpg",
            tags: ["ОПИ", "НДВ", "НМУ", "ПЭК", "СЗЗ", "ЛК РПН"],
            workload: {
                percent: 75,
                statusText: "Загружен. Беру только отчетность.",
                color: "#f1c40f"
            },
            geo: ["Курганская область", "Тюменская область", "ХМАО", "ЯНАО", "Томская область", "Курган", "Кемеровская область", "Пензенская область", "Кемерово"],
            documents: [
                { title: "Мои реквизиты (НПД)", link: "#" },
                { title: "Шаблон договора", link: "#" },
                { title: "Аттестат", link: "#" }
            ]
        },

        // Услуги (статичные)
        services: [
            { 
                id: 'ndv', name: 'Проект НДВ (ПДВ)', basePrice: 15000, unit: 'источник',
                desc: 'Для 1-3 категорий НВОС.',
                params: [
                    { id: 'sources', label: 'Кол-во источников', type: 'number', default: 10, costPerUnit: 2500 },
                    { id: 'sites', label: 'Промплощадки', type: 'number', default: 1, costPerUnit: 5000 }
                ]
            },
            { 
                id: 'szz', name: 'Проект СЗЗ', basePrice: 30000, unit: 'проект',
                desc: 'Санитарно-защитная зона.',
                params: [
                    { id: 'hazard_class', label: 'Класс опасности', type: 'select', options: [
                        { val: 1, text: '1 класс (1000м)', cost: 100000 },
                        { val: 2, text: '2 класс (500м)', cost: 80000 },
                        { val: 3, text: '3 класс (300м)', cost: 50000 },
                        { val: 4, text: '4 класс (100м)', cost: 20000 },
                        { val: 5, text: '5 класс (50м)', cost: 10000 }
                    ]},
                    { id: 'risk', label: 'Оценка риска?', type: 'checkbox', cost: 45000 }
                ]
            },
            { 
                id: 'pek', name: 'ПЭК + Отчетность', basePrice: 10000, unit: 'комплект',
                desc: 'Программа контроля.',
                params: [
                     { id: 'category', label: 'Категория', type: 'select', options: [
                        { val: 1, text: '1 категория (КЭР)', cost: 150000 },
                        { val: 2, text: '2 категория (ДВОС)', cost: 30000 },
                        { val: 3, text: '3 категория', cost: 5000 }
                    ]},
                    { id: 'urgent', label: 'Срочность', type: 'checkbox', cost: 5000 }
                ]
            }
        ],

        // Проекты (динамические)
        projects: [
            {
                id: 101, ownerId: 222222, clientName: "ООО 'Завод Металл'", type: "НДВ",
                status: "paused", statusLabel: "Приостановлено", progress: 40, deadline: "25.12.2023",
                resources: { method: "RDP", details: "Сервер заказчика" },
                history: [{ date: "01.11", type: "start", text: "Старт работ" }, { date: "10.11", type: "warning", text: "Ждем справку" }]
            },
            {
                id: 102, ownerId: 222222, clientName: "ООО 'Завод Металл'", type: "ПЭК",
                status: "done", statusLabel: "Готов", progress: 100, deadline: "01.11.2023",
                resources: { method: "Личное ПО", details: "Интеграл" },
                history: []
            }
        ],

        // Партнеры / CRM (динамические)
        partners: [
            {
                id: 1, name: "ООО 'Северный Металл'", inn: "7712000001", contact: "Сергей (ГИП)",
                username: "sergey_gip", phone: "+79001112233", email: "gip@sever-met.ru",
                status: "active", contract: "№45-23 от 10.01.23",
                projects: [{ type: "НДВ", stage: "Экспертиза", deadline: "20.12" }, { type: "ПЭК", stage: "Сдача", deadline: "01.12" }],
                finance: { total: 150000, paid: 100000, debt: 50000 },
                rating: 5, note: "Хорошие ребята, но бухгалтерия долго проводит счета."
            },
            {
                id: 2, name: "ИП Строитель В.В.", inn: "540011122233", contact: "Виктор", username: "",
                phone: "+79998887766", email: "stroy@mail.ru",
                status: "lead", contract: "На согласовании",
                projects: [{ type: "СЗЗ", stage: "Расчет", deadline: "—" }],
                finance: { total: 45000, paid: 0, debt: 0 },
                rating: 3, note: "Торгуется за каждую копейку. Предоплату не внес."
            },
            {
                id: 3, name: "АО 'НефтеХимТранс'", inn: "7700999888", contact: "Анна (Эколог)", username: "anna_eco",
                phone: "", email: "eco@nht.ru",
                status: "active", contract: "№12-24 БЕЗРОЧНЫЙ",
                projects: [{ type: "Отчетность", stage: "Сбор данных", deadline: "15.01" }],
                finance: { total: 15000, paid: 15000, debt: 0 },
                rating: 5, note: "Платят четко. Любят звонить в 9 утра."
            }
        ],

        // Текущая смета (Calculator Advanced Mode)
        estimate: []
    },

    // === INIT ===
    init(tgUser) {
        this.state.user = tgUser;
        const userId = tgUser?.id || 0;
        
        // Определение прав админа
        this.state.isAdmin = (userId == CONFIG.ADMIN_ID) || CONFIG.FORCE_ADMIN_MODE;

        // Загрузка сохраненных данных
        this.loadSettings();
    },

    // === PERSISTENCE ===
    loadSettings() {
        // 1. Статус загрузки инженера
        const savedStatus = localStorage.getItem('admin_custom_status');
        if (savedStatus) {
            try { this.state.engineer.workload = JSON.parse(savedStatus); } catch(e) {}
        }

        // 2. Профиль партнера (если это клиент)
        const savedPartner = localStorage.getItem('eco_partner_profile');
        if (savedPartner) {
            // Здесь мы не сохраняем в state глобально, так как это локальные данные клиента,
            // но можем вернуть их через геттер.
        }
    },

    saveWorkloadStatus(newStatus) {
        this.state.engineer.workload = newStatus;
        localStorage.setItem('admin_custom_status', JSON.stringify(newStatus));
    },

    // === ACTIONS (Getters/Setters) ===
    
    getVisibleProjects() {
        if (this.state.isAdmin) return this.state.projects;
        // Показываем проекты пользователя + демо-проекты (если нужно)
        // В оригинале фильтрация по ownerId
        const userId = this.state.user?.id;
        const partnerId = localStorage.getItem('eco_partner_id');
        return this.state.projects.filter(p => p.ownerId == userId || p.ownerId == partnerId);
    },

    addProject(project) {
        this.state.projects.unshift(project);
    },

    // CRM Actions
    getPartners(filter = 'all', searchQuery = '') {
        let data = this.state.partners;
        
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(p => p.name.toLowerCase().includes(q) || p.inn.includes(q));
        }

        // Filter
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

    // Estimate Actions
    addToEstimate(obj) { this.state.estimate.push(obj); },
    removeFromEstimate(idx) { this.state.estimate.splice(idx, 1); },
    updateEstimateObject(idx, key, val) { this.state.estimate[idx][key] = val; }
};