class SanitizedUser {
  id: string;
  nome: string;
  email: string;
}

export class AuthRequest extends Request {
  user: SanitizedUser;
}
