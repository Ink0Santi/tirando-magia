/* =========================================================
   TIRANDO MAGIA — NÚCLEO COMPARTIDO
   Se carga en todas las páginas después de supabase-js.
   Todo lo común queda disponible en window.TM
========================================================= */

(function () {
    "use strict";

    // ======================================================
    // SUPABASE
    // ======================================================

    const SUPABASE_URL = "https://buptjwmgwyeivjpcyvai.supabase.co";
    const SUPABASE_KEY = "sb_publishable_l9ibdIMfbbo8FJoyh3vs1w_-HJjSFI3";

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });


    // ======================================================
    // DATOS FIJOS
    // ======================================================

    const INSTRUMENTS = [
        { value: "Guitarra", emoji: "🎸" },
        { value: "Bajo", emoji: "🎸" },
        { value: "Batería", emoji: "🥁" },
        { value: "Voz", emoji: "🎤" },
        { value: "Piano", emoji: "🎹" },
        { value: "Teclado", emoji: "🎹" },
        { value: "Violín", emoji: "🎻" },
        { value: "Saxofón", emoji: "🎷" },
        { value: "Trompeta", emoji: "🎺" },
        { value: "Producción", emoji: "🎛️" },
        { value: "Otro", emoji: "🎵" }
    ];

    const LEVELS = [
        { value: "Principiante", emoji: "🌱" },
        { value: "Intermedio", emoji: "🎵" },
        { value: "Avanzado", emoji: "🔥" }
    ];

    const LOOKING_FOR = [
        { value: "Formar una banda", emoji: "🎸" },
        { value: "Unirme a una banda", emoji: "🎤" },
        { value: "Buscar músicos", emoji: "🔎" },
        { value: "Proyecto musical", emoji: "🎵" },
        { value: "Tomar clases", emoji: "📚" },
        { value: "Dar clases", emoji: "🎓" },
        { value: "Solo conocer músicos", emoji: "🤝", label: "Conocer músicos" }
    ];

    const CLASS_MODES = [
        { value: "Presencial", emoji: "🏠" },
        { value: "Online", emoji: "💻" },
        { value: "Presencial y online", emoji: "🌐" }
    ];

    const ROLES = {
        musico: { label: "Músico", plural: "Músicos", emoji: "🎸" },
        profesor: { label: "Profesor/a", plural: "Profesores", emoji: "🎓" }
    };

    // Columnas nuevas que agrega supabase.sql
    const EXTENDED_FIELDS = [
        "role",
        "class_price",
        "class_mode",
        "teaching_levels",
        "teaching_experience",
        "profile_photo"
    ];


    // ======================================================
    // TEXTO
    // ======================================================

    function normalize(text) {
        return String(text || "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .trim();
    }

    function escapeHTML(text) {
        if (text === null || text === undefined) return "";

        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function splitList(text) {
        return String(text || "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    function debounce(fn, ms = 250) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }


    // ======================================================
    // OPCIONES
    // ======================================================

    function findOption(list, value) {
        const wanted = normalize(value);
        if (!wanted) return null;
        return list.find(option => normalize(option.value) === wanted) || null;
    }

    // Convierte valores viejos ("bateria") al formato actual ("Batería")
    function canonicalInstrument(value) {
        const option = findOption(INSTRUMENTS, value);
        return option ? option.value : (value || "");
    }

    function instrumentEmoji(value) {
        const option = findOption(INSTRUMENTS, value);
        return option ? option.emoji : "🎵";
    }

    function optionLabel(option) {
        return `${option.emoji} ${option.label || option.value}`;
    }

    function labelFor(list, value) {
        const option = findOption(list, value);
        return option ? optionLabel(option) : (value || "");
    }

    function fillSelect(select, list, placeholder) {
        select.innerHTML = "";

        if (placeholder !== undefined) {
            select.add(new Option(placeholder, ""));
        }

        list.forEach(option => {
            select.add(new Option(optionLabel(option), option.value));
        });
    }


    // ======================================================
    // PERFILES
    // ======================================================

    function isTeacher(profile) {
        return Boolean(profile) && profile.role === "profesor";
    }

    function roleOf(profile) {
        return isTeacher(profile) ? "profesor" : "musico";
    }

    function avatarHTML(profile) {
        const photo = safeUrl(profile && profile.profile_photo);

        if (photo) {
            return `<img src="${escapeHTML(photo)}" alt="" loading="lazy">`;
        }

        const emoji = isTeacher(profile)
            ? "🎓"
            : instrumentEmoji(profile && profile.instrument);

        return `<span aria-hidden="true">${emoji}</span>`;
    }

    function formatPrice(value) {
        const number = Number(value);

        if (!Number.isFinite(number) || number <= 0) return "";

        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0
        }).format(number);
    }

    function isMissingColumn(error) {
        return Boolean(error) && (error.code === "PGRST204" || error.code === "42703");
    }

    // Crea un perfil mínimo con los datos del registro si todavía no existe.
    // Devuelve "exists", "created" o null si falló.
    async function ensureProfile(user) {
        if (!user) return null;

        const { data: existing, error } = await db
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Error buscando perfil:", error);
            return null;
        }

        if (existing) return "exists";

        const meta = user.user_metadata || {};

        const base = {
            id: user.id,
            name: meta.name || "",
            instrument: canonicalInstrument(meta.instrument),
            updated_at: new Date().toISOString()
        };

        let { error: saveError } = await db
            .from("profiles")
            .upsert({ ...base, role: meta.role === "profesor" ? "profesor" : "musico" });

        if (isMissingColumn(saveError)) {
            ({ error: saveError } = await db.from("profiles").upsert(base));
        }

        if (saveError) {
            console.error("Error creando perfil:", saveError);
            return null;
        }

        return "created";
    }


    // ======================================================
    // URLS SEGURAS
    // ======================================================

    // Solo permite http/https: evita links "javascript:..."
    function safeUrl(url) {
        if (!url) return "";

        let text = String(url).trim();

        if (!/^https?:\/\//i.test(text)) {
            if (/^[\w-]+(\.[\w-]+)+/.test(text)) {
                text = "https://" + text;
            } else {
                return "";
            }
        }

        try {
            const parsed = new URL(text);
            return parsed.protocol === "http:" || parsed.protocol === "https:"
                ? parsed.href
                : "";
        } catch {
            return "";
        }
    }

    function instagramUrl(value) {
        if (!value) return "";

        const text = String(value).trim();

        if (/instagram\.com/i.test(text)) return safeUrl(text);

        const handle = text.replace(/^@/, "").replace(/[^\w.]/g, "");

        return handle ? "https://instagram.com/" + handle : "";
    }

    function mapsUrl(location) {
        return location
            ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location)
            : "";
    }

    // Solo acepta páginas locales como destino después del login
    function safeNext(next) {
        return /^[\w-]+\.html(\?[^#]*)?$/.test(next || "") ? next : "";
    }

    // Los IDs se usan dentro de filtros de Supabase: validarlos evita inyecciones
    function isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || "");
    }

    function currentPage() {
        return (location.pathname.split("/").pop() || "index.html") + location.search;
    }


    // ======================================================
    // FECHAS
    // ======================================================

    function isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
    }

    function formatTime(date) {
        return new Date(date).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatShortDate(date) {
        if (!date) return "";

        const d = new Date(date);
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (isSameDay(d, now)) return formatTime(d);
        if (isSameDay(d, yesterday)) return "Ayer";

        return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    }

    function formatDayLabel(date) {
        const d = new Date(date);
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (isSameDay(d, now)) return "Hoy";
        if (isSameDay(d, yesterday)) return "Ayer";

        return d.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long"
        });
    }


    // ======================================================
    // SESIÓN
    // ======================================================

    async function getSession() {
        const { data, error } = await db.auth.getSession();

        if (error) {
            console.error("Error obteniendo la sesión:", error);
            return null;
        }

        return data.session;
    }

    async function requireSession() {
        const session = await getSession();

        if (!session) {
            location.href = "login.html?next=" + encodeURIComponent(currentPage());
            return null;
        }

        return session;
    }

    async function logout() {
        await db.auth.signOut();
        location.href = "index.html";
    }


    // ======================================================
    // ERRORES
    // ======================================================

    function friendlyError(error) {
        const message = (error && error.message) || String(error || "");
        const text = message.toLowerCase();

        if (isMissingColumn(error)) {
            return "Falta actualizar la base de datos: ejecutá supabase.sql en Supabase.";
        }
        if (text.includes("invalid login credentials")) return "El email o la contraseña son incorrectos.";
        if (text.includes("email not confirmed")) return "Todavía no verificaste tu email.";
        if (text.includes("already registered")) return "Ya existe una cuenta con ese email.";
        if (text.includes("password should be at least")) return "La contraseña tiene que tener al menos 6 caracteres.";
        if (text.includes("rate limit") || text.includes("too many") || text.includes("security purposes")) {
            return "Demasiados intentos. Esperá un momento y probá de nuevo.";
        }
        if (text.includes("expired") || text.includes("otp") || text.includes("token")) {
            return "El código es incorrecto o venció.";
        }
        if (text.includes("failed to fetch") || text.includes("network")) {
            return "No hay conexión. Revisá tu internet.";
        }
        if (text.includes("invalid api key")) return "La clave de Supabase no es válida.";

        return message || "Ocurrió un error inesperado.";
    }


    // ======================================================
    // INTERFAZ
    // ======================================================

    function toast(message, type = "info", ms = 3500) {
        let stack = document.querySelector(".toast-stack");

        if (!stack) {
            stack = document.createElement("div");
            stack.className = "toast-stack";
            stack.setAttribute("aria-live", "polite");
            document.body.appendChild(stack);
        }

        const item = document.createElement("div");
        item.className = `toast toast-${type}`;
        item.textContent = message;
        stack.appendChild(item);

        requestAnimationFrame(() => item.classList.add("show"));

        setTimeout(() => {
            item.classList.remove("show");
            setTimeout(() => item.remove(), 300);
        }, ms);
    }

    function setBusy(button, busy, busyText) {
        if (!button) return;

        if (busy) {
            button.dataset.label = button.innerHTML;
            button.textContent = busyText || "Cargando...";
            button.disabled = true;
            button.classList.add("is-loading");
        } else {
            if (button.dataset.label) button.innerHTML = button.dataset.label;
            button.disabled = false;
            button.classList.remove("is-loading");
        }
    }

    function showAlert(element, message, type = "error") {
        if (!element) return;

        if (!message) {
            element.hidden = true;
            element.textContent = "";
            return;
        }

        element.className = `alert alert-${type}`;
        element.innerHTML = message;
        element.hidden = false;
    }

    function setupPasswordToggles(root = document) {
        root.querySelectorAll("[data-toggle-password]").forEach(button => {
            const input = document.getElementById(button.dataset.togglePassword);
            if (!input) return;

            button.addEventListener("click", () => {
                const show = input.type === "password";
                input.type = show ? "text" : "password";
                button.textContent = show ? "Ocultar" : "Ver";
                button.setAttribute("aria-pressed", String(show));
            });
        });
    }


    // ======================================================
    // NAVBAR
    // ======================================================

    function renderHeader(session) {
        const header = document.getElementById("site-header");
        if (!header) return;

        const links = [
            { key: "inicio", href: "index.html", label: "Inicio" },
            { key: "buscar", href: "buscar.html", label: "Buscar músicos" },
            { key: "profesores", href: "buscar.html?tipo=profesor", label: "🎓 Profesores" }
        ];

        if (session) {
            links.push(
                { key: "mensajes", href: "mensajes.html", label: "💬 Mensajes" },
                { key: "perfil", href: "perfil.html", label: "👤 Mi perfil" }
            );
        }

        const authLinks = session
            ? `<button type="button" class="nav-link nav-logout" data-logout>Cerrar sesión</button>`
            : `<a class="nav-link" href="login.html">Iniciar sesión</a>
               <a class="btn btn-primary btn-sm" href="registro.html">Crear cuenta</a>`;

        header.innerHTML = `
            <nav class="nav">
                <a href="index.html" class="logo" aria-label="Tirando Magia - Inicio">
                    🎵 <span>Tirando Magia</span>
                </a>

                <button type="button" class="nav-toggle" aria-expanded="false"
                        aria-controls="nav-menu" aria-label="Abrir menú">☰</button>

                <div class="nav-menu" id="nav-menu">
                    ${links.map(link => `
                        <a class="nav-link" href="${link.href}" data-nav="${link.key}">${link.label}</a>
                    `).join("")}
                    ${authLinks}
                </div>
            </nav>
        `;

        setActiveNav(header.dataset.active);

        const nav = header.querySelector(".nav");
        const toggle = header.querySelector(".nav-toggle");

        toggle.addEventListener("click", () => {
            const open = nav.classList.toggle("open");
            toggle.setAttribute("aria-expanded", String(open));
            toggle.textContent = open ? "✕" : "☰";
        });

        const logoutButton = header.querySelector("[data-logout]");
        if (logoutButton) logoutButton.addEventListener("click", logout);
    }

    function setActiveNav(key) {
        const header = document.getElementById("site-header");
        if (!header) return;

        header.dataset.active = key || "";

        header.querySelectorAll("[data-nav]").forEach(link => {
            if (link.dataset.nav === key) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    async function initHeader() {
        if (!document.getElementById("site-header")) return;

        renderHeader(await getSession());

        db.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
                renderHeader(session);
            }
        });
    }

    initHeader();


    // ======================================================
    // EXPORTAR
    // ======================================================

    window.TM = {
        db,

        INSTRUMENTS,
        LEVELS,
        LOOKING_FOR,
        CLASS_MODES,
        ROLES,
        EXTENDED_FIELDS,

        normalize,
        escapeHTML,
        splitList,
        debounce,

        findOption,
        canonicalInstrument,
        instrumentEmoji,
        optionLabel,
        labelFor,
        fillSelect,

        isTeacher,
        roleOf,
        avatarHTML,
        formatPrice,
        isMissingColumn,
        ensureProfile,

        safeUrl,
        instagramUrl,
        mapsUrl,
        safeNext,
        isUuid,

        formatTime,
        formatShortDate,
        formatDayLabel,
        isSameDay,

        getSession,
        requireSession,
        logout,

        friendlyError,
        toast,
        setBusy,
        showAlert,
        setupPasswordToggles,
        setActiveNav
    };
})();
