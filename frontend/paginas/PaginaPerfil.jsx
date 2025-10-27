import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  CircularProgress, Snackbar, Alert
} from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function PaginaPerfil() {
  const [userForm, setUserForm] = useState({ nome_completo: '', email: '' });
  const [passForm, setPassForm] = useState({ senha_antiga: '', nova_senha: '', confirmar_nova_senha: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // 1. Busca os dados do usuário ao carregar
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users/me`);
        setUserForm({
          nome_completo: response.data.nome_completo,
          email: response.data.email || '' // Usa string vazia se for null
        });
      } catch (error) {
        setSnack({ open: true, message: "Erro ao carregar dados do perfil.", severity: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []); // Roda só uma vez

  // 2. Handlers para o formulário de perfil
  const handleChangeUser = (e) => {
    setUserForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setIsSavingUser(true);
    try {
      await axios.put(`${API_URL}/api/users/me`, userForm);
      setSnack({ open: true, message: 'Perfil atualizado com sucesso!', severity: 'success' });
    } catch (error) {
      setSnack({ open: true, message: error.response?.data?.detail || 'Erro ao atualizar perfil.', severity: 'error' });
    } finally {
      setIsSavingUser(false);
    }
  };

  // 3. Handlers para o formulário de senha
  const handleChangePass = (e) => {
    setPassForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleSalvarSenha = async (e) => {
    e.preventDefault();
    if (passForm.nova_senha !== passForm.confirmar_nova_senha) {
      setSnack({ open: true, message: 'As novas senhas não conferem.', severity: 'error' });
      return;
    }
    setIsSavingPass(true);
    try {
      await axios.post(`${API_URL}/api/users/me/change-password`, {
        senha_antiga: passForm.senha_antiga,
        nova_senha: passForm.nova_senha,
      });
      setSnack({ open: true, message: 'Senha alterada com sucesso!', severity: 'success' });
      setPassForm({ senha_antiga: '', nova_senha: '', confirmar_nova_senha: '' }); // Limpa o form
    } catch (error) {
      setSnack({ open: true, message: error.response?.data?.detail || 'Erro ao alterar senha.', severity: 'error' });
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleCloseSnack = () => setSnack(prev => ({ ...prev, open: false }));

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: '#333', mb: 3 }}>
        Meu Perfil
      </Typography>

      <Grid container spacing={3}>
        {/* Card de Atualizar Perfil */}
        <Grid item xs={12} md={6}>
          <Paper component="form" onSubmit={handleSalvarPerfil} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Atualizar Informações</Typography>
            <TextField
              label="Nome Completo"
              name="nome_completo"
              value={userForm.nome_completo}
              onChange={handleChangeUser}
              fullWidth
              required
              margin="normal"
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={userForm.email}
              onChange={handleChangeUser}
              fullWidth
              required
              margin="normal"
            />
            <Button 
              type="submit" 
              variant="contained" 
              sx={{ mt: 2 }}
              disabled={isSavingUser}
            >
              {isSavingUser ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </Paper>
        </Grid>

        {/* Card de Mudar Senha */}
        <Grid item xs={12} md={6}>
          <Paper component="form" onSubmit={handleSalvarSenha} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Alterar Senha</Typography>
            <TextField
              label="Senha Antiga"
              name="senha_antiga"
              type="password"
              value={passForm.senha_antiga}
              onChange={handleChangePass}
              fullWidth
              required
              margin="normal"
            />
            <TextField
              label="Nova Senha"
              name="nova_senha"
              type="password"
              value={passForm.nova_senha}
              onChange={handleChangePass}
              fullWidth
              required
              margin="normal"
            />
            <TextField
              label="Confirmar Nova Senha"
              name="confirmar_nova_senha"
              type="password"
              value={passForm.confirmar_nova_senha}
              onChange={handleChangePass}
              fullWidth
              required
              margin="normal"
            />
            <Button 
              type="submit" 
              variant="contained" 
              sx={{ mt: 2 }}
              disabled={isSavingPass}
            >
              {isSavingPass ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Snackbar (Alerta de Feedback) */}
      <Snackbar open={snack.open} autoHideDuration={6000} onClose={handleCloseSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnack} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}