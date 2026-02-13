import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api, { getAuthToken, clearAuthToken } from './api';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

// 1. Criar o Contexto
const AuthContext = createContext(null);

// 2. Criar o Provedor (Provider)
export function ProvedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null); // Armazenará os dados do usuário (nome, email, role)
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Controla o "loading" inicial
  
  // Função para buscar os dados do usuário (por cookie HttpOnly)
  const fetchUsuario = useCallback(async () => {
    try {
      const response = await api.get('/api/users/me');
      setUsuario(response.data);
      setToken(getAuthToken() ? 'bearer' : 'cookie');
      localStorage.setItem('tema', response.data.preferencia_tema || 'light');
      await api.get('/api/csrf-token');
    } catch {
      setUsuario(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efeito que roda UMA VEZ quando o app carrega
  useEffect(() => {
    fetchUsuario();
  }, [fetchUsuario]);

  // Função de Login: chamada pela PaginaLogin
  const login = async () => {
    await fetchUsuario();
  };

  // Função de Logout: chamada pelo Layout
  const logout = async () => {
    try {
      await api.post('/api/logout');
    } catch {
      // Ignora erro de logout remoto para garantir limpeza local
    }
    clearAuthToken();
    localStorage.removeItem('tema'); // Limpa o tema
    setToken(null);
    setUsuario(null);
    window.location.href = '/login'; // Força recarregamento para o login
  };

  // O valor que será compartilhado com toda a aplicação
  const value = {
    usuario,
    token,
    isLoading,
    login,
    logout
  };

  // Não renderiza nada até o 'loading' inicial terminar
  if (isLoading) {
    // TODO: Criar um componente de "Loading..." de tela cheia
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Hook customizado (para facilitar o uso)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um ProvedorAuth');
  }
  return context;
};