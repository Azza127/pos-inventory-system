import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ FormsModule, RouterLink ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private userService = inject(UserService);
  private router = inject(Router);

  username = '';
  password = '';
  showPassword = false;
  errorMessage = '';
  isLoading = false;

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    this.errorMessage = '';
    const username = this.username.trim();
    const password = this.password.trim();

    if (!username) {
      this.errorMessage = 'Please enter your username.';
      return;
    }
    const usernamePattern = /^[A-Za-z][A-Za-z0-9]*$/;
    if (!usernamePattern.test(username)) {
      this.errorMessage = 'Username must start with a letter and contain only letters and numbers.';
      return;
    }
    if (!password) {
      this.errorMessage = 'Please enter your password.';
      return;
    }

    this.isLoading = true;
    this.userService.getUsers().subscribe({
      next: (users: User[]) => {
        console.log( 'USERS FROM SERVER:', users );
        const user = users.find((u: User) => u.username === username && u.password === password);
        if (!user) {
          this.isLoading = false;
          this.errorMessage ='Invalid username or password.';
          return;
        }
        if (user.status !== 'Active') {
          this.isLoading = false;
          this.errorMessage = 'Your account is inactive. Please contact the administrator.';
          return;
        }
        console.log('LOGIN SUCCESS:', user);
        localStorage.setItem('isLoggedIn','true');
        localStorage.setItem( 'currentUser', JSON.stringify(user));
        this.isLoading = false;
        this.router.navigate([ '/dashboard' ]);
      },
        error: (error) => { console.error('SERVER ERROR:',error);
        this.isLoading = false;
        this.errorMessage ='Unable to connect to JSON Server.';
      }
    });
  }
}