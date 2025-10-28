import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Grid, TextField, Button, Skeleton,
  FormControl, InputLabel, Select, MenuItem, Snackbar, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Modal, Fade, Backdrop,
  Switch, // Para o tema
  ListItemText // Para o tema
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Estilo do Modal
const styleModal = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 500 },
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

const createInitialState = {
  nome_completo: '',
  cpf: '',
  email: '',
  password: '',
  role: 'user'
};

export function PaginaAdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Estados do Modal de Criação ---
  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [formCreate, setFormCreate] = useState(createInitialState);
  const [isSaving, setIsSaving] = useState(false);
  
  // --- Estados do Modal de Edição ---
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [formEdit, setFormEdit] = useState(null); // Armazena dados do usuário para editar
  const [isUpdating, setIsUpdating] = useState(false);

  // --- Estados do Modal de Reset de Senha ---
  const [modalResetOpen, setModalResetOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [isReseting, setIsReseting] = useState(false);

  // --- Estado do Snackbar ---
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // --- Carregamento de Dados ---
  const fetchUsuarios = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/users/`);
      setUsuarios(response.data);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      setSnack({ open: true, message: 'Erro ao carregar lista de usuários.', severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  // --- Handlers do Snackbar ---
  const handleCloseSnack = () => setSnack(prev => ({ ...prev, open: false }));

  // --- Handlers do Modal de Criação ---
  const handleOpenModalCreate = () => {
    setFormCreate(createInitialState);
    setModalCreateOpen(true);
  };
  const handleCloseModalCreate = () => setModalCreateOpen(false);
  const handleChangeCreate = (e) => {
    setFormCreate(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = { ...formCreate, cpf: formCreate.cpf.replace(/[^\d]+/g, '') };

    try {
      await axios.post(`${API_URL}/api/users/`, payload);
      setSnack({ open: true, message: `Usuário '${payload.nome_completo}' criado com sucesso!`, severity: 'success' });
      handleCloseModalCreate();
      fetchUsuarios(); // Recarrega a lista
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      setSnack({ open: true, message: error.response?.data?.detail || 'Erro ao criar usuário.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handlers do Modal de Edição (NOVOS) ---
  const handleOpenModalEdit = (user) => {
    setFormEdit({ // Preenche o formulário com os dados do usuário clicado
      id: user.id,
      nome_completo: user.nome_completo,
      email: user.email || '',
      preferencia_tema: user.preferencia_tema || 'light'
    });
    setModalEditOpen(true);
  };
  const handleCloseModalEdit = () => setModalEditOpen(false);
  const handleChangeEdit = (e) => {
    const { name, value } = e.target;
    setFormEdit(prev => ({ ...prev, [name]: value }));
  };
  const handleToggleTemaEdit = () => {
    setFormEdit(prev => ({ 
      ...prev, 
      preferencia_tema: prev.preferencia_tema === 'light' ? 'dark' : 'light' 
    }));
  };
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      // O payload SÓ envia os campos que o schema UserUpdate permite
      const payload = {
        nome_completo: formEdit.nome_completo,
        email: formEdit.email,
        preferencia_tema: formEdit.preferencia_tema
      };
      await axios.put(`${API_URL}/api/users/${formEdit.id}`, payload);
      setSnack({ open: true, message: "Usuário atualizado com sucesso!", severity: 'success' });
      handleCloseModalEdit();
      fetchUsuarios(); // Recarrega a lista
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      setSnack({ open: true, message: error.response?.data?.detail || 'Erro ao atualizar.', severity: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };


  // --- Handlers do Modal de Reset de Senha (Sem mudanças) ---
  const handleOpenModalReset = (user) => {
    setUsuarioSelecionado(user);
    setNovaSenha('');
    setModalResetOpen(true);
  };
  const handleCloseModalReset = () => setModalResetOpen(false);
  const handleSubmitReset = async (e) => {
    e.preventDefault();
    if (novaSenha.length < 8) {
      setSnack({ open: true, message: 'Nova senha deve ter pelo menos 8 caracteres.', severity: 'warning' });
      return;
    }
    setIsReseting(true);
    try {
      await axios.post(`${API_URL}/api/users/${usuarioSelecionado.id}/reset-password`, {
        nova_senha: novaSenha
      });
      setSnack({ open: true, message: `Senha do usuário '${usuarioSelecionado.nome_completo}' resetada com sucesso!`, severity: 'success' });
      handleCloseModalReset();
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      setSnack({ open: true, message: error.response?.data?.detail || 'Erro ao resetar senha.', severity: 'error' });
    } finally {
      setIsReseting(false);
    }
  };


  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800' }}>
          Gerenciar Usuários
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenModalCreate}
        >
          Adicionar Usuário
        </Button>
      </Box>

      {/* Tabela de Usuários */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nome Completo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>CPF (Login)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Papel (Role)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}><Skeleton variant="rounded" height={60} /></TableCell></TableRow>
              ) : (
                usuarios.map((user) => (
                  <TableRow hover key={user.id}>
                    <TableCell>{user.nome_completo}</TableCell>
                    <TableCell>{user.cpf}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell> {/* Corrigido no backend para novos usuários */}
                    <TableCell>{user.role}</TableCell>
                    <TableCell sx={{ textAlign: 'center', p: 0 }}>
                      <Tooltip title="Editar Usuário">
                        {/* --- BOTÃO DE LÁPIS AGORA FUNCIONA --- */}
                        <IconButton 
                          color="primary" 
                          onClick={() => handleOpenModalEdit(user)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Resetar Senha">
                        <IconButton
                          color="secondary"
                          onClick={() => handleOpenModalReset(user)}
                        >
                          <LockResetIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* --- Modal de CRIAR Usuário --- */}
      <Modal open={modalCreateOpen} onClose={handleCloseModalCreate} closeAfterTransition BackdropComponent={Backdrop}>
        <Fade in={modalCreateOpen}>
          <Box sx={styleModal} component="form" onSubmit={handleSubmitCreate}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Criar Novo Usuário</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField name="nome_completo" label="Nome Completo" value={formCreate.nome_completo} onChange={handleChangeCreate} variant="outlined" fullWidth required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField name="cpf" label="CPF (será o login)" value={formCreate.cpf} onChange={handleChangeCreate} variant="outlined" fullWidth required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField name="email" label="Email" type="email" value={formCreate.email} onChange={handleChangeCreate} variant="outlined" fullWidth required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField name="password" label="Senha Provisória" type="password" value={formCreate.password} onChange={handleChangeCreate} variant="outlined" fullWidth required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel id="role-label">Papel</InputLabel>
                  <Select labelId="role-label" label="Papel" name="role" value={formCreate.role} onChange={handleChangeCreate}>
                    <MenuItem value="user">Usuário (Padrão)</MenuItem>
                    <MenuItem value="admin">Administrador</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={handleCloseModalCreate} variant="text" color="secondary">Cancelar</Button>
                <Button type="submit" variant="contained" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Criar Usuário'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      </Modal>

      {/* --- NOVO: Modal de EDITAR Usuário --- */}
      {formEdit && (
        <Modal open={modalEditOpen} onClose={handleCloseModalEdit} closeAfterTransition BackdropComponent={Backdrop}>
          <Fade in={modalEditOpen}>
            <Box sx={styleModal} component="form" onSubmit={handleSubmitEdit}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Editar Usuário</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField name="nome_completo" label="Nome Completo" value={formEdit.nome_completo} onChange={handleChangeEdit} variant="outlined" fullWidth required />
                </Grid>
                <Grid item xs={12}>
                  <TextField name="email" label="Email" type="email" value={formEdit.email} onChange={handleChangeEdit} variant="outlined" fullWidth required />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <MenuItem onClick={handleToggleTemaEdit}>
                      <ListItemText primary="Tema do Usuário" secondary={formEdit.preferencia_tema === 'dark' ? 'Escuro' : 'Claro'} />
                      <Switch
                        edge="end"
                        checked={formEdit.preferencia_tema === 'dark'}
                        onChange={handleToggleTemaEdit}
                      />
                    </MenuItem>
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={handleCloseModalEdit} variant="text" color="secondary">Cancelar</Button>
                <Button type="submit" variant="contained" disabled={isUpdating}>
                  {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </Box>
            </Box>
          </Fade>
        </Modal>
      )}

      {/* --- Modal de RESETAR Senha (Sem mudanças) --- */}
      {usuarioSelecionado && (
        <Modal open={modalResetOpen} onClose={handleCloseModalReset} closeAfterTransition BackdropComponent={Backdrop}>
          <Fade in={modalResetOpen}>
            <Box sx={styleModal} component="form" onSubmit={handleSubmitReset}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Resetar Senha</Typography>
              <Typography sx={{ mb: 2 }}>Para: <strong>{usuarioSelecionado.nome_completo}</strong></Typography>
              <TextField
                name="novaSenha"
                label="Digite a Nova Senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                variant="outlined"
                fullWidth
                required
                autoFocus
              />
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={handleCloseModalReset} variant="text" color="secondary">Cancelar</Button>
                <Button type="submit" variant="contained" color="secondary" disabled={isReseting}>
                  {isReseting ? 'Salvando...' : 'Salvar Nova Senha'}
                </Button>
              </Box>
            </Box>
          </Fade>
        </Modal>
      )}

      {/* Snackbar (Alerta de Feedback) */}
      <Snackbar open={snack.open} autoHideDuration={6000} onClose={handleCloseSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnack} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}