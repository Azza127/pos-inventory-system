import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';
import { PopupService } from '../../../core/services/popup.service';

@Component({
  selector: 'app-team-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-members.html',
  styleUrl: './team-members.css'
})

export class TeamMembers implements OnInit {
  private readonly userService = inject(UserService);
  private readonly popupService = inject(PopupService);

  users: User[] = [];
  showModal = false;
  isEditMode = false;
  selectedUserId: string | null = null;
  userForm = { username: '', password: '', name: '', role: 'Employee' as User['role'],status: 'Active' as User['status']};

    ngOnInit(): void {
    const cachedUsers = localStorage.getItem('teamMembers');
    if (cachedUsers) {
      try {
        this.users = JSON.parse(cachedUsers) as User[];
      } catch {
        localStorage.removeItem('teamMembers');
      }
    }
    this.loadUsers();
  }

  showAlert(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'warning', title?: string): void {
    this.popupService.showAlert(message, type, title);
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe({next: (users) => {
        this.users = users;
        localStorage.setItem('teamMembers', JSON.stringify(users));
        console.log('USERS:', users);
      },
      error: (error) => {
        console.error( 'GET USERS ERROR:', error );
      }
    });
  }

  getCurrentUser(): User | null {
    const currentUserData =
      localStorage.getItem('currentUser');
    if (!currentUserData) {
      return null;
    }
    try {
      return JSON.parse(currentUserData) as User;

    } catch (error) {
      console.error( 'CURRENT USER ERROR:', error );
      return null;
    }
  }

  getCurrentRole(): User['role'] | null {
    const currentUser =
      this.getCurrentUser();
    if (!currentUser) {
      return null;
    }
    return currentUser.role;
  }

  // Owner: can add any role. Manager: can add Employee only.
  canAddUser(): boolean {
    const role = this.getCurrentRole();
    return role === 'Owner' || role === 'Manager';
  }

  // Owner: can edit anyone. Manager: can edit Employees only.
  canEditUser(targetUser: User): boolean {
    const role = this.getCurrentRole();
    if (role === 'Owner') return true;
    if (role === 'Manager') return targetUser.role === 'Employee';
    return false;
  }

  // Owner: can delete anyone (not self). Manager: can delete Employees only.
  canDeleteUser(targetUser: User): boolean {
    const role = this.getCurrentRole();
    if (role === 'Owner') return true;
    if (role === 'Manager') return targetUser.role === 'Employee';
    return false;
  }

  getNameError(): string {
    const name =
      this.userForm.name.trim();
    if (!name) {
      return '';
    }
    const namePattern =
      /^[A-Za-z]+(?: [A-Za-z]+)*$/;
    if (!namePattern.test(name)) {
      return 'Name must contain letters and spaces only.';
    }
    return '';
  }

  getUsernameError(): string {
    const username =
      this.userForm.username.trim();
    if (!username) {
      return '';
    }
    if (!/^[A-Za-z]/.test(username)) {
      return 'Username must start with a letter.';
    }
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(username)) {
      return 'Username can contain only letters and numbers.';
    }

    const usernameExists = this.users.some(user => user.username.toLowerCase() === username.toLowerCase() && user.id !== this.selectedUserId
      );

    if (usernameExists) {
      return 'Username already exists.';
    }
    return '';
  }

  getPasswordError(): string {
    const password = this.userForm.password;
    if (!password) {
      return '';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    return '';
  }

  openAddModal(): void {
    if (!this.canAddUser()) {
      this.showAlert('You do not have permission to add users.');
      return;
    }
    this.isEditMode = false;
    this.selectedUserId = null;
    this.userForm = {  username: '',  password: '',  name: '', role: 'Employee', status: 'Active'};
    this.showModal = true;
  }

  openEditModal(user: User): void {
    if (!this.canEditUser(user)) {
      this.showAlert( 'You do not have permission to edit this account.','error','Access Denied' );
      return;
    }
    this.isEditMode = true;
    this.selectedUserId = user.id;
    this.userForm = { username: user.username, password: user.password, name: user.name, role: user.role, status: user.status };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedUserId = null;
    this.isEditMode = false;
    this.userForm = { username: '', password: '', name: '',  role: 'Employee', status: 'Active'};
  }

  private handleSaveSuccess(message: string): void {
    this.loadUsers();
    this.showAlert(message, 'success', 'Success');
    this.closeModal();
  }

  saveUser(): void {
    if (this.isEditMode) {
      // Find the user being edited to check permission against their role
      const targetUser = this.users.find(u => u.id === this.selectedUserId);
      if (!targetUser || !this.canEditUser(targetUser)) {
        this.showAlert( 'You do not have permission to edit this account.', 'error', 'Access Denied' );
        return;
      }
    } else {
      if (!this.canAddUser()) {
        this.showAlert( 'You do not have permission to add users.' );
        return;
      }
    }

    const name = this.userForm.name.trim();
    const username = this.userForm.username.trim();
    const password = this.userForm.password.trim();
    if (
      !name || !username ||!password
    ) {
      this.showAlert( 'Please fill all required fields.' );
      return;
    }

    const namePattern =  /^[A-Za-z]+(?: [A-Za-z]+)*$/;
    if (!namePattern.test(name)) {
      this.showAlert( 'Name must contain letters and spaces only.');
      return;
    }

    const usernamePattern = /^[A-Za-z][A-Za-z0-9]*$/;
    if (!usernamePattern.test(username)) {
      this.showAlert('Username must start with a letter and contain only letters and numbers.' );
      return;
    }
    if (password.length < 6) {
      this.showAlert( 'Password must be at least 6 characters.');
      return;
    }

    const usernameExists = this.users.some(user =>
        user.username.toLowerCase() ===username.toLowerCase() && user.id !== this.selectedUserId
      );

    if (usernameExists) {
      this.showAlert( 'Username already exists. Please choose another username.' );
      return;
    }
    if (
      this.isEditMode && this.selectedUserId !== null
    ) {
      const updatedUser: User = { id: this.selectedUserId,  username: username, password: password, name: name, role: this.userForm.role, status: this.userForm.status };
      this.userService
        .updateUser(updatedUser).subscribe({ next: () => {
            console.log( 'USER UPDATED:', updatedUser );
            this.handleSaveSuccess('Member updated successfully.');
          },
          error: (error) => {
            console.error( 'UPDATE USER ERROR:', error );
            this.showAlert( 'Failed to update user.' );
          }
        });
      return;
    }

    const newUser: Omit<User, 'id'> = { username: username, password: password, name: name, role: this.userForm.role,status: this.userForm.status};
    this.userService
      .addUser(newUser).subscribe({ next: (createdUser) => {
          console.log('USER ADDED:', createdUser );
          this.handleSaveSuccess('Member added successfully.');
        },
        error: (error) => {
          console.error( 'ADD USER ERROR:', error );
          this.showAlert( 'Failed to add user.');
        }
      });
  }

  deleteUser(user: User): void {
    if (!this.canDeleteUser(user)) {
      this.showAlert('You do not have permission to delete this account.', 'error', 'Access Denied' );
      return;
    }

    const currentUser = this.getCurrentUser();
    if ( currentUser && currentUser.id === user.id ) {
      this.showAlert('You cannot delete your own account.');
      return;
    }
    this.popupService.showConfirm(`Are you sure you want to delete ${user.name}?`, 'Delete User')
    .subscribe({ next: (confirmed) => {
        if (!confirmed) {
          return;
        }

        this.userService
          .deleteUser(user.id) .subscribe({ next: () => {
              console.log( 'USER DELETED:', user );
              this.loadUsers();
              this.showAlert( 'Member deleted successfully.', 'success', 'Success');
            },
            error: (error) => {
              console.error( 'DELETE USER ERROR:', error );
              this.showAlert( 'Failed to delete user.' );
            }
          });
      }
    });
  }
}
