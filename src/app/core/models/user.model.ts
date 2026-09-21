export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'Owner' | 'Manager' | 'Employee';
  status: 'Active' | 'Inactive';
}