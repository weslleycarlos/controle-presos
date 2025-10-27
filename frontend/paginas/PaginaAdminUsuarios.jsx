import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Snackbar, Alert
} from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const initialState = {
  nome_completo: '',
  cpf: '',
  email: '',
  password: '',
  role: 'advogado' // Padrão
};

export function PaginaAdminUsuarios() {
  const [form, setForm] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCloseSnack = () => {
    setSnack(prev => ({ ...prev, open: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Pega o CPF e remove a máscara (se houver - não adicionamos aqui para simplificar)
    const payload = {
      ...form,
      cpf: form.cpf.replace(/[^\d]+/g, '') // Limpa o CPF
    };

    try {
      // O token já está no Axios (do AuthContext)
      const response = await axios.post(`${API_URL}/api/users/`, payload);

      setSnack({ open: true, message: `Usuário '${response.data.nome_completo}' criado com sucesso!`, severity: 'success' });
      setForm(initialState); // Limpa o formulário

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      setSnack({ open: true, message: error.response?.data?.detail || 'Erro ao criar usuário.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', color: '#333', mb: 3 }}>
        Gerenciar Usuários
      </Typography>

      <Paper 
        component="form" 
        onSubmit={handleSubmit} 
        sx={{ p: 4, maxWidth: '600px', margin: 'auto' }} // Centraliza o form
      >
        <Typography variant="h6" sx={{ mb: 2 }}>Criar Novo Usuário</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField 
              name="nome_completo"
              label="Nome Completo" 
              value={form.nome_completo}
              onChange={handleChange}
              variant="outlined" 
              fullWidth 
              required 
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField 
              name="cpf"
              label="CPF (será o login)" 
              value={form.cpf}
              onChange={handleChange}
              variant="outlined" 
              fullWidth 
              required 
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField 
              name="email"
              label="Email" 
              type="email"
              value={form.email}
              onChange={handleChange}
              variant="outlined" 
              fullWidth 
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField 
              name="password"
              label="Senha Provisória" 
              type="password"
              value={form.password}
              onChange={handleChange}
              variant="outlined" 
              fullWidth 
              required 
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="role-label">Papel</InputLabel>
              <Select
                labelId="role-label"
                label="Papel"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <MenuItem value="advogado">Advogado (Padrão)</MenuItem>
                <MenuItem value="admin">Administrador</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              type="submit" 
              variant="contained" 
              size="large"
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Criar Usuário'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Snackbar (Alerta de Feedback) */}
      <Snackbar open={snack.open} autoHideDuration={6000} onClose={handleCloseSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnack} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}