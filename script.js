// ==========================================
// TIRANDO MAGIA - CONEXIÓN CON SUPABASE
// ==========================================

const SUPABASE_URL = "https://buptjwmgwyeivjpcyvai.supabase.co";

// Tu Publishable Key
const SUPABASE_KEY = "sb_publishable_l9ibdIMfbbo8FJoyh3vs1w_-HJjSFI3";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// REGISTRO
// ==========================================

const registerForm = document.querySelector("#register-form");

if (registerForm) {

    registerForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const name = document.querySelector("#name").value.trim();
        const email = document.querySelector("#email").value.trim();
        const password = document.querySelector("#password").value;
        const instrument = document.querySelector("#instrument").value;

        // Comprobar campos
        if (!name || !email || !password || !instrument) {
            alert("Completá todos los campos.");
            return;
        }

        try {

            const { data, error } = await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {
                    data: {
                        name: name,
                        instrument: instrument
                    }
                }

            });


            // Error de Supabase
            if (error) {

                console.error("Error de registro:", error);

                alert("Error: " + error.message);

                return;
            }


            // Guardamos temporalmente los datos
            localStorage.setItem("register_email", email);
            localStorage.setItem("register_name", name);
            localStorage.setItem("register_instrument", instrument);


            // Ir a la página de verificación
            window.location.href = "verificar.html";

        } catch (error) {

            console.error("Error inesperado:", error);

            alert("Ocurrió un error al crear la cuenta.");

        }

    });

}


// ==========================================
// VERIFICACIÓN DEL CÓDIGO
// ==========================================

const verifyForm = document.querySelector("#verify-form");

if (verifyForm) {

    verifyForm.addEventListener("submit", async function (event) {

        event.preventDefault();


        // Email guardado durante el registro
        const email = localStorage.getItem("register_email");

        // Código ingresado
        const code = document
            .querySelector("#verification-code")
            .value
            .trim();


        // Comprobar email
        if (!email) {

            alert("No encontramos el email del registro.");

            return;
        }


        // Comprobar código de 8 dígitos
        if (!/^\d{8}$/.test(code)) {

            alert("El código debe tener 8 dígitos.");

            return;
        }


        try {

            // Verificar código con Supabase
            const { data, error } =
                await supabaseClient.auth.verifyOtp({

                    email: email,

                    token: code,

                    type: "email"

                });


            // Código incorrecto
            if (error) {

                console.error("Error de verificación:", error);

                alert("Código incorrecto o vencido.");

                return;
            }


            // ==========================================
            // CUENTA VERIFICADA
            // ==========================================

            alert(
                "¡Cuenta verificada! Bienvenido a Tirando Magia 🎸"
            );


            // Limpiar datos temporales
            localStorage.removeItem("register_email");
            localStorage.removeItem("register_name");
            localStorage.removeItem("register_instrument");


            // Ir al inicio
            window.location.href = "index.html";

        } catch (error) {

            console.error("Error inesperado:", error);

            alert("Ocurrió un error al verificar el código.");

        }

    });

}