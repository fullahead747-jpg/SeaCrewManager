export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const userData = localStorage.getItem('user_data');
  
  if (!token || !userData) {
    return {};
  }

  try {
    const user = JSON.parse(userData);
    return {
      'Authorization': `Bearer ${token}`,
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-Username': user.username,
    };
  } catch {
    return {};
  }
}
