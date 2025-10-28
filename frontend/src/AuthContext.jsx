import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// 1. Criar o Contexto
const AuthContext = createContext(null);

// 2. Criar o Provedor (Provider)
export function ProvedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null); // Armazenará os dados do usuário (nome, email, role)
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true); // Controla o "loading" inicial
  
  // Função para buscar os dados do usuário (com o token)
  const fetchUsuario = useCallback(async (authToken) => {
    if (authToken) {
      try {
        // Define o cabeçalho do Axios ANTES de fazer a chamada
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        
        const response = await axios.get(`${API_URL}/api/users/me`);
        
        // Salva os dados do usuário no estado
        setUsuario(response.data); 
        
        // Salva a preferência de tema (bônus da etapa anterior)
        localStorage.setItem('tema', response.data.preferencia_tema || 'light');
        
      } catch (error) {
        console.error("Token inválido ou sessão expirada. Fazendo logout.", error);
        // Se o token for inválido (ex: 401), limpa tudo
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  // Efeito que roda UMA VEZ quando o app carrega
  useEffect(() => {
    fetchUsuario(token);
  }, [token, fetchUsuario]); // Depende do token e da função

  // Função de Login: chamada pela PaginaLogin
  const login = (novoToken) => {
    localStorage.setItem('authToken', novoToken);
    setToken(novoToken); // Isso vai disparar o useEffect acima para buscar o usuário
    // O redirecionamento será feito na PaginaLogin
  };

  // Função de Logout: chamada pelo Layout
  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('tema'); // Limpa o tema
    setToken(null);
    setUsuario(null);
    delete axios.defaults.headers.common['Authorization'];
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