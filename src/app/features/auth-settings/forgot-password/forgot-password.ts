import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})

export class ForgotPassword {
  username = '';
  newPassword = '';
  confirmPassword = '';
  step = 1;
  errorMessage = '';
  successMessage = '';
  userId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  findUser() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.username.trim()) {
      this.errorMessage = 'Please enter your username.';
      return;
    }

    this.http.get<any[]>(`http://localhost:3000/users?username=${this.username.trim()}`)
    .subscribe({ next: (users) => {
        if (users.length === 0) {
          this.errorMessage = 'Username not found.';
          return;
        }
        this.userId = users[0].id;
        this.step = 2;
      },
      error: () => {this.errorMessage = 'Something went wrong. Please try again.';}
    });
  }

  resetPassword() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (this.userId === null) {
      return;
    }

    this.http.patch( `http://localhost:3000/users/${this.userId}`, { password: this.newPassword })
    .subscribe({ next: () => { this.successMessage = 'Password reset successfully!';
        setTimeout(() => { this.router.navigate(['/login']); }, 1500); },
      error: () => {this.errorMessage = 'Failed to reset password.';}
    });
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }
}