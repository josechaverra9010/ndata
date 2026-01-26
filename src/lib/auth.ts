// Definición de roles permitidos en la aplicación
export type UserRole = 'patient' | 'admin' | 'superadmin';

// Interfaz de Usuario que refleja los datos que vienen del Backend
export interface User {
  id: string;
  name: string;
  nombres?: string;
  apellidos?: string;
  email: string;
  role: UserRole;
  avatar?: string;
  altura?: number;
  peso_actual?: number;
  createdAt: string;
}

/**
 * Determina la ruta de redirección basada en el rol del usuario.
 * Esta función es utilizada en el componente Auth.tsx después de un login exitoso.
 */
export function getRedirectPath(role: UserRole): string {
  switch (role) {
    case 'superadmin':
      return '/superadmin';
    case 'admin':
      return '/'; // Dashboard principal del nutricionista
    case 'patient':
      return '/patient'; // Ruta base para pacientes en App.tsx
    default:
      return '/auth';
  }
}

/**
 * Utilidad para manejar el cierre de sesión eliminando el token.
 */
export function logout() {
  localStorage.removeItem("userToken"); // Elimina el JWT del navegador
  window.location.href = "/auth";
}