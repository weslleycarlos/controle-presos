import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Importamos o Axios
import { useAuth } from '../AuthContext';

import { 
  Box, Button, TextField, Typography, Container, Link, 
  InputAdornment, Alert // Alert para mensagens de erro
} from '@mui/material';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

// Lê a variável de ambiente VITE_API_URL definida no Railway (ou outro deploy).
// Se ela não existir (estamos rodando localmente), usa o endereço local como padrão.
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function PaginaLogin() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''); // Estado para guardar mensagens de erro
  const navigate = useNavigate(); // <-- 3. INICIE O HOOK
  const { login } = useAuth(); // <-- 4. PEGUE A FUNÇÃO DE LOGIN

  const fazerLogin = async (e) => {
    e.preventDefault();
    setErro(''); 

    const params = new URLSearchParams();
    params.append('username', cpf);
    params.append('password', senha);

    try {
      const response = await axios.post(`${API_URL}/api/token`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const token = response.data.access_token;
      
      // --- 5. ATUALIZE A LÓGICA DE LOGIN ---
      login(token); // Passa o token para o Contexto
      navigate('/'); // Navega para o Dashboard
      
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        setErro(error.response.data.detail);
      } else {
        setErro('Erro ao tentar conectar ao servidor.');
      }
      console.error('Erro no login:', error);
    }
  };

  return (
    <Container 
      component="main" 
      maxWidth="xs" // Limita a largura para "extra-small" (ótimo para forms)
      sx={{ // 'sx' é como o atributo "style", mas com superpoderes
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <Box
        sx={{
          backgroundColor: '#ffffff',
          padding: '40px 32px', // 40px em cima/baixo, 32px nos lados
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          width: '100%',
        }}
      >
        {/* Cabeçalho */}
        <Box sx={{ textAlign: 'center', marginBottom: '32px' }}>
          <Typography 
            component="h1" 
            variant="h5" // h5 é um estilo de título pré-definido
            sx={{ fontWeight: '700', color: '#0A2463' }}
          >
            Controle de Presos
          </Typography>
          <Typography 
            component="p" 
            sx={{ color: '#6c757d', marginTop: '8px' }}
          >
            Acesso ao Sistema
          </Typography>
        </Box>

        {/* --- Formulário Atualizado --- */}
        <Box component="form" onSubmit={fazerLogin} noValidate>
          
          {/* Exibe a mensagem de erro, se houver */}
          {erro && (
            <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
              {erro}
            </Alert>
          )}

          <TextField
            margin="normal"
            required
            fullWidth
            id="cpf"
            label="Usuário / CPF"
            name="cpf"
            autoFocus
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineOutlinedIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="senha"
            label="Senha"
            type="password"
            id="senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ 
              mt: 3, // mt = margin-top (3 * 8px = 24px)
              mb: 2, // mb = margin-bottom
              padding: '10px',
              fontWeight: '600',
              backgroundColor: '#0A2463', // Nosso azul
              // Estilo :hover
              '&:hover': {
                backgroundColor: '#0D47A1', // Um azul um pouco mais claro
              }
            }}
          >
            Entrar
          </Button>
          
          <Link 
            href="#" 
            variant="body2" 
            sx={{ textAlign: 'center', display: 'block' }}
          >
            Esqueceu sua senha?
          </Link>
        </Box>
      </Box>
    </Container>
  );
}