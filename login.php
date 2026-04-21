<?php
// Load session and config (BASE_PATH is defined in config.php)
define('DICOM_VIEWER', true);
require_once __DIR__ . '/auth/session.php';

// Redirect if already logged in

if (isLoggedIn()) {
    header('Location: ' . BASE_PATH . '/dashboard.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="base-path" content="<?= BASE_PATH ?>">
    <meta name="base-url" content="<?= BASE_URL ?>">
    <title>Login - Accurate Viewer</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        .login-container {
            width: 100%;
            max-width: 450px;
            padding: 20px;
        }

        .login-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
        }

        .login-header {
            text-align: center;
            margin-bottom: 35px;
        }

        .login-header .logo {
            background: linear-gradient(135deg, #0d6efd, #0dcaf0);
            width: 80px;
            height: 80px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            box-shadow: 0 10px 30px rgba(13, 110, 253, 0.4);
        }

        .login-header .logo i {
            font-size: 40px;
            color: white;
        }

        .login-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: white;
            margin-bottom: 8px;
        }

        .login-header p {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            margin: 0;
        }

        .form-floating {
            margin-bottom: 20px;
        }

        .form-floating > label {
            color: rgba(255, 255, 255, 0.6);
        }

        .form-control {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: white;
            padding: 12px 16px;
            font-size: 15px;
        }

        .form-control:focus {
            background: rgba(255, 255, 255, 0.12);
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
            color: white;
        }

        .form-control::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }

        .form-check-input {
            background-color: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.15);
        }

        .form-check-input:checked {
            background-color: #0d6efd;
            border-color: #0d6efd;
        }

        .form-check-label {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
        }

        .btn-login {
            width: 100%;
            padding: 14px;
            font-size: 16px;
            font-weight: 600;
            background: linear-gradient(135deg, #0d6efd, #0dcaf0);
            border: none;
            border-radius: 10px;
            color: white;
            transition: all 0.3s ease;
            box-shadow: 0 5px 20px rgba(13, 110, 253, 0.4);
        }

        .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(13, 110, 253, 0.6);
        }

        .btn-login:active {
            transform: translateY(0);
        }

        .alert {
            border-radius: 10px;
            border: none;
            margin-bottom: 20px;
        }

        .alert-danger {
            background: rgba(220, 53, 69, 0.2);
            color: #ff6b6b;
            border: 1px solid rgba(220, 53, 69, 0.3);
        }

        .forgot-password {
            text-align: center;
            margin-top: 20px;
        }

        .forgot-password a {
            color: #0dcaf0;
            text-decoration: none;
            font-size: 14px;
            transition: color 0.3s ease;
        }

        .forgot-password a:hover {
            color: #0d6efd;
        }

        .footer-text {
            text-align: center;
            margin-top: 30px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
        }

        .password-toggle {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            color: rgba(255, 255, 255, 0.6);
            z-index: 10;
        }

        .password-toggle:hover {
            color: rgba(255, 255, 255, 0.9);
        }

        @media (max-width: 576px) {
            .login-card {
                padding: 30px 20px;
            }

            .login-header h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <div class="logo">
                    <i class="bi bi-heart-pulse-fill"></i>
                </div>
                <h1>Hospital DICOM Viewer</h1>
                <p>Sign in to access medical imaging</p>
            </div>

            <div id="errorMessage" class="alert alert-danger" style="display: none;">
                <i class="bi bi-exclamation-circle-fill me-2"></i>
                <span id="errorText"></span>
            </div>

            <form id="loginForm">
                <div class="form-floating">
                    <input type="email" class="form-control" id="email" name="email" placeholder="name@hospital.com" required autofocus>
                    <label for="email"><i class="bi bi-envelope me-2"></i>Email address</label>
                </div>

                <div class="form-floating" style="position: relative;">
                    <input type="password" class="form-control" id="password" name="password" placeholder="Password" required>
                    <label for="password"><i class="bi bi-lock me-2"></i>Password</label>
                    <i class="bi bi-eye password-toggle" id="togglePassword"></i>
                </div>

                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="rememberMe" name="remember">
                    <label class="form-check-label" for="rememberMe">
                        Remember me for 30 days
                    </label>
                </div>

                <button type="submit" class="btn btn-login" id="loginBtn">
                    <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
                </button>
            </form>

            <div class="forgot-password">
                <a href="<?= BASE_PATH ?>/forgot-password.php">
                    <i class="bi bi-question-circle me-1"></i>Forgot your password?
                </a>
            </div>

            <div class="footer-text">
                <i class="bi bi-shield-check me-1"></i>Secure medical data access
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Base path configuration
        const basePath = document.querySelector('meta[name="base-path"]')?.content || '';

        // Password toggle
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');

        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });

        // Form submission
        const loginForm = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');

        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Disable button and show loading
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
            errorMessage.style.display = 'none';

            const formData = new FormData(loginForm);
            const jsonData = Object.fromEntries(formData.entries());
            
            // Map email to username as expected by the API
            jsonData.username = jsonData.email;

            try {
                const response = await fetch(`${basePath}/api/auth/login.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(jsonData)
                });

                const data = await response.json();

                if (data.success) {
                    // Show success message
                    loginBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Success! Redirecting...';
                    loginBtn.classList.remove('btn-login');
                    loginBtn.classList.add('btn-success');

                    // Redirect to dashboard
                    setTimeout(() => {
                        window.location.href = `${basePath}/dashboard.php`;
                    }, 500);
                } else {
                    // Show error message
                    errorText.textContent = data.message || 'Invalid email or password';
                    errorMessage.style.display = 'block';

                    // Reset button
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
                }
            } catch (error) {
                console.error('Login error:', error);
                errorText.textContent = 'Connection error. Please check your network and try again.';
                errorMessage.style.display = 'block';

                // Reset button
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
            }
        });

        // Auto-hide error message when user starts typing
        document.getElementById('email').addEventListener('input', hideError);
        document.getElementById('password').addEventListener('input', hideError);

        function hideError() {
            if (errorMessage.style.display !== 'none') {
                errorMessage.style.display = 'none';
            }
        }
    </script>
</body>
</html>
