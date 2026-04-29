export interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
  hospital_id: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}
