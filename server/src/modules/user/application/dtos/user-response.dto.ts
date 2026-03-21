export class UserResponse {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'TUTOR';
}

export class UserListItem {
  id: string;
  name: string;
  role: 'STUDENT' | 'TUTOR';
}
