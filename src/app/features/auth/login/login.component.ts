import { AuthShellComponent } from '../auth-shell.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkspaceSelectorComponent } from '../../../shared/ui/workspace-selector.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AuthShellComponent,
    IconComponent,
    WorkspaceSelectorComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['../auth-form.css'],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);
  chooseWorkspace = signal(false);
  enterWorkspace() {
    void this.router.navigate(['/dashboard']);
  }

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    public themeService: ThemeService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  onSubmit(): void {
    const emailControl = this.loginForm.get('email');
    const passwordControl = this.loginForm.get('password');

    const emailValue = emailControl?.value ? String(emailControl.value).trim() : '';
    const passwordValue = passwordControl?.value ? String(passwordControl.value) : '';

    // Si algún campo está vacío al intentar iniciar sesión
    if (!emailValue || !passwordValue) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Por favor, rellene todos los campos para iniciar sesión.');
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      if (emailControl?.hasError('email')) {
        this.errorMessage.set('Por favor, ingrese un correo electrónico válido.');
      } else {
        this.errorMessage.set('Por favor, verifique los datos ingresados.');
      }
      return;
    }

    this.errorMessage.set(null);
    const { email, password } = this.loginForm.value;

    this.authService.login({ email: email.trim(), password }).subscribe({
      next: (result) => {
        if (result.user.role_id === 'CLIENTE') this.enterWorkspace();
        else this.chooseWorkspace.set(true);
      },
      error: (err) => {
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.errorMessage.set(detail);
        } else if (Array.isArray(err?.error?.errors)) {
          this.errorMessage.set(err.error.errors[0]?.message || 'Datos inválidos');
        } else {
          this.errorMessage.set('Error de autenticación. Verifica tus credenciales.');
        }
      },
    });
  }
}
