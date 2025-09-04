// Authentication JavaScript

class AuthHandler {
    constructor() {
        this.initializeEventListeners();
        this.initializePasswordToggles();
        this.initializePasswordStrength();
        this.initializeFormValidation();
    }

    initializeEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Signup form
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }

        // Social login buttons
        const socialButtons = document.querySelectorAll('.social-btn');
        socialButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSocialLogin(btn);
            });
        });

        // Forgot password
        const forgotPassword = document.querySelector('.forgot-password');
        if (forgotPassword) {
            forgotPassword.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }
    }

    initializePasswordToggles() {
        const passwordToggles = document.querySelectorAll('.password-toggle');
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const passwordInput = toggle.parentElement.querySelector('input');
                const icon = toggle.querySelector('i');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    }

    initializePasswordStrength() {
        const passwordInput = document.getElementById('password');
        const strengthBar = document.querySelector('.strength-fill');
        const strengthText = document.querySelector('.strength-text');

        if (passwordInput && strengthBar) {
            passwordInput.addEventListener('input', () => {
                const password = passwordInput.value;
                const strength = this.calculatePasswordStrength(password);
                
                strengthBar.className = 'strength-fill';
                
                if (password.length === 0) {
                    strengthText.textContent = 'Password strength';
                    return;
                }

                switch (strength.level) {
                    case 1:
                        strengthBar.classList.add('weak');
                        strengthText.textContent = 'Weak password';
                        break;
                    case 2:
                        strengthBar.classList.add('fair');
                        strengthText.textContent = 'Fair password';
                        break;
                    case 3:
                        strengthBar.classList.add('good');
                        strengthText.textContent = 'Good password';
                        break;
                    case 4:
                        strengthBar.classList.add('strong');
                        strengthText.textContent = 'Strong password';
                        break;
                }
            });
        }
    }

    calculatePasswordStrength(password) {
        let score = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            symbols: /[^A-Za-z0-9]/.test(password)
        };

        Object.values(checks).forEach(check => {
            if (check) score++;
        });

        return {
            score: score,
            level: Math.min(Math.floor(score), 4),
            checks: checks
        };
    }

    initializeFormValidation() {
        // Real-time validation
        const inputs = document.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });

            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.validateField(input);
                }
            });
        });

        // Password confirmation validation
        const confirmPassword = document.getElementById('confirmPassword');
        const password = document.getElementById('password');
        
        if (confirmPassword && password) {
            confirmPassword.addEventListener('input', () => {
                this.validatePasswordMatch(password, confirmPassword);
            });
        }
    }

    validateField(field) {
        const errorElement = document.getElementById(field.name + 'Error');
        let isValid = true;
        let errorMessage = '';

        // Clear previous styles
        field.classList.remove('error', 'success');
        if (errorElement) errorElement.textContent = '';

        // Required field validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }

        // Password validation
        if (field.type === 'password' && field.value) {
            if (field.value.length < 8) {
                isValid = false;
                errorMessage = 'Password must be at least 8 characters long';
            }
        }

        // Apply validation styles
        if (field.value.trim()) {
            if (isValid) {
                field.classList.add('success');
            } else {
                field.classList.add('error');
                if (errorElement) errorElement.textContent = errorMessage;
            }
        }

        return isValid;
    }

    validatePasswordMatch(password, confirmPassword) {
        const errorElement = document.getElementById('confirmPasswordError');
        
        confirmPassword.classList.remove('error', 'success');
        if (errorElement) errorElement.textContent = '';

        if (confirmPassword.value && password.value !== confirmPassword.value) {
            confirmPassword.classList.add('error');
            if (errorElement) errorElement.textContent = 'Passwords do not match';
            return false;
        } else if (confirmPassword.value) {
            confirmPassword.classList.add('success');
            return true;
        }

        return true;
    }

    async handleLogin() {
        const form = document.getElementById('loginForm');
        const formData = new FormData(form);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            rememberMe: formData.get('rememberMe') === 'on'
        };

        // Validate form
        const isValid = this.validateLoginForm(loginData);
        if (!isValid) return;

        this.showLoading();

        try {
            // Simulate API call
            await this.simulateLogin(loginData);
            
            // Store login state
            localStorage.setItem('userLoggedIn', 'true');
            localStorage.setItem('userEmail', loginData.email);
            
            this.showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect to generator
            setTimeout(() => {
                window.location.href = 'generator.html';
            }, 1500);

        } catch (error) {
            this.showNotification('Login failed. Please check your credentials.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleSignup() {
        const form = document.getElementById('signupForm');
        const formData = new FormData(form);
        const signupData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            institution: formData.get('institution'),
            department: formData.get('department'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword'),
            agreeTerms: formData.get('agreeTerms') === 'on',
            newsletter: formData.get('newsletter') === 'on'
        };

        // Validate form
        const isValid = this.validateSignupForm(signupData);
        if (!isValid) return;

        this.showLoading();

        try {
            // Simulate API call
            await this.simulateSignup(signupData);
            
            this.showNotification('Account created successfully! Please check your email to verify your account.', 'success');
            
            // Redirect to login
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            this.showNotification('Signup failed. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    validateLoginForm(data) {
        let isValid = true;

        // Email validation
        if (!data.email) {
            this.showFieldError('email', 'Email is required');
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        // Password validation
        if (!data.password) {
            this.showFieldError('password', 'Password is required');
            isValid = false;
        }

        return isValid;
    }

    validateSignupForm(data) {
        let isValid = true;

        // Name validation
        if (!data.firstName.trim()) {
            this.showFieldError('firstName', 'First name is required');
            isValid = false;
        }

        if (!data.lastName.trim()) {
            this.showFieldError('lastName', 'Last name is required');
            isValid = false;
        }

        // Email validation
        if (!data.email) {
            this.showFieldError('email', 'Email is required');
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        // Institution validation
        if (!data.institution) {
            this.showFieldError('institution', 'Please select an institution');
            isValid = false;
        }

        // Department validation
        if (!data.department.trim()) {
            this.showFieldError('department', 'Department is required');
            isValid = false;
        }

        // Password validation
        if (!data.password) {
            this.showFieldError('password', 'Password is required');
            isValid = false;
        } else if (data.password.length < 8) {
            this.showFieldError('password', 'Password must be at least 8 characters long');
            isValid = false;
        }

        // Confirm password validation
        if (data.password !== data.confirmPassword) {
            this.showFieldError('confirmPassword', 'Passwords do not match');
            isValid = false;
        }

        // Terms validation
        if (!data.agreeTerms) {
            this.showNotification('You must agree to the Terms of Service and Privacy Policy', 'error');
            isValid = false;
        }

        return isValid;
    }

    showFieldError(fieldName, message) {
        const field = document.getElementById(fieldName);
        const errorElement = document.getElementById(fieldName + 'Error');
        
        if (field) {
            field.classList.add('error');
            field.classList.remove('success');
        }
        
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    async handleSocialLogin(button) {
        const provider = button.classList.contains('google-btn') ? 'Google' : 'Microsoft';
        
        this.showNotification(`${provider} login would be implemented with OAuth integration.`, 'info');
    }

    handleForgotPassword() {
        this.showNotification('Password reset functionality would be implemented with email verification.', 'info');
    }

    async simulateLogin(data) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate login validation
        if (data.email && data.password) {
            return { success: true, user: { email: data.email } };
        } else {
            throw new Error('Invalid credentials');
        }
    }

    async simulateSignup(data) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // Simulate signup validation
        if (data.email && data.password && data.firstName && data.lastName) {
            return { success: true, user: { email: data.email } };
        } else {
            throw new Error('Invalid signup data');
        }
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Additional CSS for notifications and animations
const additionalStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    }
    
    .notification.success {
        border-left: 4px solid #48bb78;
    }
    
    .notification.error {
        border-left: 4px solid #f56565;
    }
    
    .notification.info {
        border-left: 4px solid #4299e1;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
    
    .notification.success .notification-content i {
        color: #48bb78;
    }
    
    .notification.error .notification-content i {
        color: #f56565;
    }
    
    .notification.info .notification-content i {
        color: #4299e1;
    }
    
    .notification-content button {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: #a0aec0;
        margin-left: auto;
        padding: 0 5px;
    }
    
    @keyframes slideInRight {
        from { 
            transform: translateX(100%); 
            opacity: 0; 
        }
        to { 
            transform: translateX(0); 
            opacity: 1; 
        }
    }
    
    .form-group input.error,
    .form-group select.error {
        border-color: #f56565;
        box-shadow: 0 0 0 3px rgba(245, 101, 101, 0.1);
    }
    
    .form-group input.success,
    .form-group select.success {
        border-color: #48bb78;
        box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.1);
    }
`;

// Add the additional styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the authentication handler when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthHandler();
});

