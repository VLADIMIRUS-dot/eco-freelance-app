// js/data.js

// === 1. КОНФИГУРАЦИЯ ===
const CONFIG = {
    // Ваш реальный ID (для прав админа)
    ADMIN_ID: 8027648882, 
    
    // Ссылка для связи
    TELEGRAM_LINK: "https://t.me/EcoSubcontract",
    
    // Заглушка аватарки
    PLACEHOLDER_AVATAR: "https://via.placeholder.com/100"
};

// === 2. ПРОФИЛЬ ЭКОЛОГА ===
const engineerProfile = {
    name: "Владимир Протасов",
    title: "Инженер-эколог / Проектировщик",
    avatar: "images/avatar.jpg", 
    tags: ["ОПИ", "НДВ", "НМУ", "ПЭК", "СЗЗ", "ЛК РПН"],
    
    workload: {
        percent: 75,
        statusText: "Загружен. Беру только отчетность.",
        color: "#f1c40f" // Желтый
    },
	
    geo: {
        regions: ["Курганская область", "Тюменская область", "ХМАО", "ЯНАО", "Томская область", "Курган", "Кемеровская область", "Пензенская область", "Кемерово"]
    },
	
    documents: [
        { title: "Мои реквизиты (НПД)", link: "#" },
        { title: "Шаблон договора", link: "#" },
        { title: "Аттестат", link: "#" }
    ]
};

// === 3. УСЛУГИ ===
const servicesData = [
    { 
        id: 'ndv', 
        name: 'Проект НДВ (ПДВ)', 
        basePrice: 15000, 
        unit: 'источник',
        desc: 'Для 1-3 категорий НВОС.',
        params: [
            { id: 'sources', label: 'Кол-во источников', type: 'range', min: 1, max: 100, step: 1, default: 10, costPerUnit: 2500 },
            { id: 'sites', label: 'Промплощадки', type: 'range', min: 1, max: 5, step: 1, default: 1, costPerUnit: 5000 }
        ]
    },
    { 
        id: 'szz', 
        name: 'Проект СЗЗ', 
        basePrice: 30000, 
        unit: 'проект',
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
        id: 'pek', 
        name: 'ПЭК + Отчетность', 
        basePrice: 10000, 
        unit: 'комплект',
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
];

// === 4. ПРОЕКТЫ ===
const projectsData = [
    {
        id: 101,
        ownerId: 222222, // ID Клиента "Завод"
        clientName: "ООО 'Завод Металл'",
        type: "НДВ",
        status: "paused",
        statusLabel: "Приостановлено",
        progress: 40,
        deadline: "25.12.2023",
        resources: { method: "RDP", details: "Сервер заказчика" },
        history: [
            { date: "01.11", type: "start", text: "Старт работ" },
            { date: "10.11", type: "warning", text: "Ждем справку" }
        ],
        files: []
    },
    {
        id: 102,
        ownerId: 222222,
        clientName: "ООО 'Завод Металл'",
        type: "ПЭК",
        status: "done",
        statusLabel: "Готов",
        progress: 100,
        deadline: "01.11.2023",
        resources: { method: "Личное ПО", details: "Интеграл" },
        history: [],
        files: []
    }
];

// === 5. ПАРТНЕРЫ (CRM) ===
const partnersData = [
    {
        id: 1,
        name: "ООО 'Завод Металл'",
        inn: "7712345678",
        contact: "Иван Петрович (ГИП)",
        email: "gip@zavod.ru",
        username: "ivan_gip", // Telegram username (без @)
        
        // Админские данные
        rating: 5, // 1-5
        note: "Платят четко. Любят звонить утром. Договор №45-23.",
        status: "active", // active, ban
        
        // Финансы (для дашборда)
        finances: { debt: 0, wait: 15000 } 
    },
    {
        id: 2,
        name: "ИП Неплательщик О.А.",
        inn: "540000000012",
        contact: "Менеджер Олег",
        email: "oleg@mail.ru",
        username: "", // Нет телеграма
        
        rating: 1,
        note: "Тянут с оплатой. Требуют скидки. Больше не работать без 100% предоплаты!",
        status: "bad",
        
        finances: { debt: 25000, wait: 0 }
    },
    {
        id: 3,
        name: "АО 'СтройТрест'",
        inn: "7700009999",
        contact: "Анна (Секретарь)",
        email: "info@stroy.com",
        username: "anna_stroy",
        
        rating: 4,
        note: "Новый клиент. Пока присматриваемся.",
        status: "new",
        
        finances: { debt: 0, wait: 0 }
    }
];