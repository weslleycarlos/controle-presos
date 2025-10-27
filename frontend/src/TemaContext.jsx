import React, { createContext, useState, useMemo, useContext } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// 1. Criar o Contexto
export const TemaContext = createContext({
  toggleTema: () => {},
  modo: 'light',
});

// 2. Função auxiliar para pegar o tema salvo
export const getTemaSalvo = () => {
  return localStorage.getItem('tema') || 'light';
};

// 3. Criar o Provedor (Provider)
export function ProvedorTema({ children }) {
  const [modo, setModo] = useState(getTemaSalvo());

  // Função para salvar a preferência no backend (sem bloquear a UI)
  const salvarTemaNoBackend = async (novoModo) => {
    const token = localStorage.getItem('authToken');
    if (!token) return; // Não pode salvar se estiver deslogado

    try {
      // Usamos o endpoint que já existe
      await axios.put(`${API_URL}/api/users/me`, 
        { preferencia_tema: novoModo },
        // Precisamos garantir que o token seja enviado nesta chamada
        { headers: { Authorization: `Bearer ${token}` } } 
      );
    } catch (error) {
      console.error("Falha ao salvar preferência de tema:", error);
    }
  };
  
  // Função que será chamada pelo botão "Switch"
  const toggleTema = () => {
    setModo((prevModo) => {
      const novoModo = prevModo === 'light' ? 'dark' : 'light';
      localStorage.setItem('tema', novoModo); // Salva localmente
      salvarTemaNoBackend(novoModo); // Salva no backend
      return novoModo;
    });
  };
  
  // Recria o tema do MUI apenas se o 'modo' (light/dark) mudar
  const tema = useMemo(() =>
    createTheme({
      palette: {
        mode: modo,
        primary: { 
          main: '#0A2463', // Nosso azul profissional
        },
        secondary: { 
          main: '#E74C3C', // Nosso vermelho/accent
        },
        // Define fundos customizados para o modo dark
        background: {
          paper: modo === 'dark' ? '#1E293B' : '#ffffff', // Cards (Azul-acinzentado escuro)
          default: modo === 'dark' ? '#0F172A' : '#f6f7f8', // Fundo da página (Azul-marinho)
        }
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
      },
    }),
  [modo]);

  return (
    <TemaContext.Provider value={{ toggleTema, modo }}>
      <MuiThemeProvider theme={tema}>
        <CssBaseline /> {/* Aplica o fundo e normaliza o CSS */}
        {children}
      </MuiThemeProvider>
    </TemaContext.Provider>
  );
}

// 4. Hook customizado (para facilitar o uso em outros componentes)
export const useTema = () => useContext(TemaContext);