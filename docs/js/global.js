/**
 * global.js
 * Archivo de scripts comunes para todo el proyecto ProyecTIC.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("ProyecTIC: Frontend cargado correctamente.");

    // PÁGINA DE AUTENTICACIÓN
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    
    if (tabLogin && tabRegister) {
        const confirmPasswordGroup = document.getElementById('confirm-password-group');
        const confirmPasswordInput = document.getElementById('password-confirm');
        const btnSubmit = document.getElementById('btn-submit');
        const linkForgot = document.getElementById('link-forgot');
        const linkToggle = document.getElementById('link-toggle');

        // Función para cambiar a modo "Iniciar sesión"
        const switchToLogin = () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            
            confirmPasswordGroup.style.display = 'none';
            confirmPasswordInput.removeAttribute('required');
            
            btnSubmit.textContent = 'Entrar';
            linkForgot.style.display = 'block';
            linkToggle.textContent = '¿No tienes cuenta? Regístrate';
        };

        // Función para cambiar a modo "Registrarse"
        const switchToRegister = () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            
            confirmPasswordGroup.style.display = 'block';
            confirmPasswordInput.setAttribute('required', 'true');
            
            btnSubmit.textContent = 'Crear cuenta';
            linkForgot.style.display = 'none';
            linkToggle.textContent = '¿Ya tienes cuenta? Inicia sesión';
        };

        // Eventos de los botones
        tabLogin.addEventListener('click', switchToLogin);
        tabRegister.addEventListener('click', switchToRegister);

        // Evento del enlace inferior para cambiar de modo rápido
        linkToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (tabLogin.classList.contains('active')) {
                switchToRegister();
            } else {
                switchToLogin();
            }
        });
    }
});